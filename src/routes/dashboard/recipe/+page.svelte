<script>
	import { onMount } from 'svelte';
	import { fetchMedicines, fetchBatchesForMedicine } from '$lib/api/fetchdata';
	import {
		collection,
		doc,
		deleteDoc,
		addDoc,
		setDoc,
		getDoc,
		getDocs,
		query,
		orderBy,
		limit,
		startAfter,
		where,
		collectionGroup
	} from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { writable, derived, get } from 'svelte/store';
	import { userLocation } from '$lib/store/dataStore';

	export const searchMedicines = writable([]);
	export const searchQuery = writable('');

	export const filteredMedicines = derived(
		[searchMedicines, searchQuery],
		([$searchMedicines, $searchQuery]) => {
			let meds = $searchMedicines;
			if ($searchQuery.trim()) {
				meds = meds.filter((med) => med.name.toLowerCase().includes($searchQuery.toLowerCase()));
			}
			return meds
				.slice()
				.sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));
		}
	);

	let medicines = [];
	let selectedMedicine = null;
	let batches = [];

	async function getTotalAvailableAmount(medicineId) {
		const batches = await fetchBatchesForMedicine(medicineId);
		return batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
	}

	let lastVisible = null;
	let pageSize = 10;
	let hasMore = true;
	let isLoadingPage = false;

	async function loadMedicines(initial = true) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;

		let q = query(
			collection(db, 'Pharmacies', location.pharmacyId, 'medicines'),
			where('category', '==', 'أدوية وصفتي'),
			orderBy('name'),
			limit(pageSize)
		);

		if (!initial && lastVisible) {
			q = query(
				collection(db, 'Pharmacies', location.pharmacyId, 'medicines'),
				where('category', '==', 'أدوية وصفتي'),
				orderBy('name'),
				startAfter(lastVisible),
				limit(pageSize)
			);
		}

		isLoadingPage = true;
		const snap = await getDocs(q);
		const newMeds = await Promise.all(
			snap.docs.map(async (doc) => {
				const total = await getTotalAvailableAmount(doc.id);
				return { id: doc.id, ...doc.data(), totalAvailable: total };
			})
		);

		if (initial) {
			medicines = newMeds;
		} else {
			medicines = [...medicines, ...newMeds];
		}
		searchMedicines.set(medicines);

		lastVisible = snap.docs[snap.docs.length - 1];
		hasMore = snap.docs.length === pageSize;
		isLoadingPage = false;
	}

	async function openModal(medicine) {
		selectedMedicine = medicine;
		batches = await fetchBatchesForMedicine(medicine.id);
		showModal = true;
	}

	async function deleteMedicine(id) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}
		if (confirm('هل أنت متأكد من أنك تريد حذف هذا الدواء؟')) {
			// 1. Get all batches for this medicine (subcollection)
			const batchesSnapshot = await getDocs(
				collection(db, 'Pharmacies', location.pharmacyId, 'medicines', id, 'batches')
			);

			// 2. Delete each batch from the medicine's subcollection
			const deleteSubPromises = batchesSnapshot.docs.map((batchDoc) =>
				deleteDoc(
					doc(db, 'Pharmacies', location.pharmacyId, 'medicines', id, 'batches', batchDoc.id)
				)
			);
			await Promise.all(deleteSubPromises);

			// 3. Delete each batch from the main batches collection (if you have this)
			const deleteMainPromises = batchesSnapshot.docs.map((batchDoc) =>
				deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'batches', batchDoc.id))
			);
			await Promise.all(deleteMainPromises);

			// 4. Get the catalogId before deleting the medicine
			const medDoc = await getDoc(doc(db, 'Pharmacies', location.pharmacyId, 'medicines', id));
			const catalogId = medDoc.exists() ? medDoc.data().catalogId : null;

			// 5. Delete the medicine itself
			await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'medicines', id));

			// 6. Try to delete the catalog entry if orphaned
			if (catalogId) {
				await tryDeleteCatalogIfOrphan(catalogId);
			}

			showModal = false;
			await loadMedicines();
		}
	}

	let showModal = false;
	let showAddMedicineModal = false;
	let newMedicine = { name: '', category: 'أدوية وصفتي', unit: '' };

	async function addMedicine() {
		if (!newMedicine.name.trim()) {
			alert('يرجى إدخال اسم الدواء.');
			return;
		}
		// Prevent duplicate in pharmacy
		if (
			medicines.some((m) => m.name.trim().toLowerCase() === newMedicine.name.trim().toLowerCase())
		) {
			alert('هذا الدواء موجود بالفعل.');
			return;
		}
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}

		// 1. Check if exists in catalog by name only
		const catalogRef = collection(db, 'medicinesCatalog');
		const q = query(catalogRef, where('name', '==', newMedicine.name.trim()));
		const snap = await getDocs(q);

		let catalogId;
		if (!snap.empty) {
			// Exists in catalog
			catalogId = snap.docs[0].id;
		} else {
			// Add to catalog
			const docRef = await addDoc(catalogRef, {
				name: newMedicine.name.trim(),
				createdAt: new Date()
			});
			catalogId = docRef.id;
		}

		// 2. Add to pharmacy, linking to catalog
		await addDoc(collection(db, 'Pharmacies', location.pharmacyId, 'medicines'), {
			...newMedicine,
			catalogId,
			createdAt: new Date()
		});
		newMedicine = { name: '', category: 'أدوية وصفتي', unit: '' };
		showAddMedicineModal = false;
		await loadMedicines();
	}

	let showAddBatchModal = false;
	let newBatch = {
		quantity: '',
		production: '',
		expiry: '',
		received: '',
		supplier: ''
	};

	async function addBatch() {
		if (!selectedMedicine) return alert('لم يتم تحديد دواء');
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}

		const { quantity, production, expiry, received, supplier } = newBatch;
		if (!quantity || !production || !expiry || !received) {
			alert('يرجى ملء جميع الحقول المطلوبة');
			return;
		}

		const batchData = {
			quantity: Number(quantity),
			productionDate: new Date(production),
			expiryDate: new Date(expiry),
			receivedDate: new Date(received),
			supplier: supplier || 'غير معروف'
		};

		// Generate a new batch doc ref (same id for both locations)
		const batchDocRef = doc(
			collection(db, 'Pharmacies', location.pharmacyId, 'medicines', selectedMedicine.id, 'batches')
		);
		const batchId = batchDocRef.id;

		// Write to medicine's subcollection
		await setDoc(batchDocRef, { ...batchData, id: batchId });

		// Write to main batches collection (add medicineId for reference)
		await setDoc(doc(db, 'Pharmacies', location.pharmacyId, 'batches', batchId), {
			...batchData,
			medicineId: selectedMedicine.id,
			id: batchId
		});

		newBatch = { quantity: '', production: '', expiry: '', received: '', supplier: '' };
		showAddBatchModal = false;

		batches = await fetchBatchesForMedicine(selectedMedicine.id);
		await loadMedicines();
	}

	async function deleteBatch(medicineId, batchId) {
		const confirmed = confirm('هل أنت متأكد من أنك تريد حذف هذه الدفعة؟');
		if (!confirmed) return;

		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}

		try {
			// Delete from medicine's subcollection
			await deleteDoc(
				doc(db, 'Pharmacies', location.pharmacyId, 'medicines', medicineId, 'batches', batchId)
			);
			// Delete from main batches collection
			await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'batches', batchId));

			alert('تم حذف الدفعة بنجاح');
			batches = await fetchBatchesForMedicine(medicineId);
			await loadMedicines();
		} catch (error) {
			console.error('خطأ أثناء حذف الدفعة:', error);
			alert('حدث خطأ أثناء الحذف');
		}
	}
	// the submitting handler
	let isSubmitting = false;

	async function handleSubmit(submitFn) {
		if (isSubmitting) return;

		isSubmitting = true;
		try {
			await submitFn(); // This is the actual logic for adding medicine or batch
		} catch (error) {
			console.error('Error during submission:', error);
		} finally {
			isSubmitting = false;
		}
	}

	onMount(() => loadMedicines(true));

	async function tryDeleteCatalogIfOrphan(catalogId) {
		const q = query(collectionGroup(db, 'medicines'), where('catalogId', '==', catalogId));
		const snap = await getDocs(q);
		if (snap.empty) {
			await deleteDoc(doc(db, 'medicinesCatalog', catalogId));
		}
	}
</script>

<!-- Search & Add Medicine -->
<div class="flex mb-5">
	<input
		type="text"
		placeholder="ابحث عن دواء..."
		bind:value={$searchQuery}
		class="ml-3 w-full p-2 border rounded"
	/>
	<button
		on:click={() => (showAddMedicineModal = true)}
		class="w-24 cursor-pointer bg-(--green_lighter) text-white rounded hover:bg-green-700"
	>
		إضافة دواء
	</button>
</div>

<!-- Medicine Table -->
<div class="relative overflow-x-auto">
	<table class="w-full text-lg text-center rtl:text-right text-gray-500 dark:text-gray-400">
		<thead class="text-3xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
			<tr>
				<th class="px-6 py-3">الاسم</th>
				<th class="px-6 py-3">الفئة</th>
				<th class="px-6 py-3">النوع</th>
				<th class="px-6 py-3">الكمية المتوفرة</th>
			</tr>
		</thead>
		<tbody>
			{#each $filteredMedicines as med}
				<tr
					on:click={() => openModal(med)}
					class="hover:bg-black/10 cursor-pointer bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200"
				>
					<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
						{med.name}
					</td>
					<td class="px-6 py-4">{med.category ?? 'غير محدد'}</td>
					<td class="px-6 py-4">{med.unit ?? 'غير محدد'}</td>
					<td class="px-6 py-4">{med.totalAvailable}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Medicine Detail Modal -->
{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
		<div
			class="bg-white dark:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[600px] max-h-[80vh] overflow-y-auto"
		>
			<h2 class="text-3xl font-bold mb-4">{selectedMedicine.name}</h2>
			<button
				on:click={() => (showAddBatchModal = true)}
				class="w-24 mb-3 cursor-pointer bg-(--green_lighter) text-white rounded hover:bg-green-700"
			>
				إضافة دفعة
			</button>

			<h3 class="text-2xl font-semibold mb-2">الدفعات:</h3>
			{#if batches.length > 0}
				<ul class="space-y-1 text-lg">
					{#each batches as batch}
						<li class="mb-3 border-b pb-2">
							<p>📦 كمية: {batch.quantity}</p>
							<p>
								📆 إنتاج:
								{batch.productionDate?.toDate?.()
									? batch.productionDate.toDate().toLocaleDateString()
									: 'غير متاح'}
							</p>
							<p>
								📅 انتهاء:
								{batch.expiryDate?.toDate?.()
									? batch.expiryDate.toDate().toLocaleDateString()
									: 'غير متاح'}
							</p>
							<p>
								📥 استلام:
								{batch.receivedDate?.toDate?.()
									? batch.receivedDate.toDate().toLocaleDateString()
									: 'غير متاح'}
							</p>
							<p>المورد: {batch.supplier}</p>
							<button
								on:click={() => deleteBatch(selectedMedicine.id, batch.id)}
								class="cursor-pointer bg-red-600 text-white text-sm px-2 py-1 rounded hover:bg-red-700"
							>
								حذف
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-gray-400">لا توجد دفعات لهذا الدواء.</p>
			{/if}

			<div class="flex justify-end space-x-4 mt-6">
				<button
					on:click={() => deleteMedicine(selectedMedicine.id)}
					class="cursor-pointer bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
				>
					حذف
				</button>
				<button
					on:click={() => (showModal = false)}
					class="cursor-pointer bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
				>
					إغلاق
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Add Medicine Modal -->
{#if showAddMedicineModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[500px]">
			<h2 class="text-xl font-bold mb-4">إضافة دواء جديد</h2>
			<form on:submit|preventDefault={() => handleSubmit(addMedicine)}>
				<input
					type="text"
					bind:value={newMedicine.name}
					placeholder="اسم الدواء"
					required
					class="w-full p-2 mb-2 border rounded"
				/>
				<input
					type="text"
					bind:value={newMedicine.unit}
					placeholder="النوع"
					required
					class="w-full p-2 mb-4 border rounded"
				/>
				<input
					type="text"
					value="أدوية وصفتي"
					readonly
					disabled
					class="w-full p-2 mb-4 border rounded bg-gray-100"
				/>
				<div class="flex justify-end space-x-4">
					<button
						disabled={isSubmitting}
						type="submit"
						class="bg-(--green_lighter) text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
					>
						{#if isSubmitting}
							<span>جاري الإضافة...</span>
						{:else}
							<span>إضافة</span>
						{/if}
					</button>
					<button
						on:click={() => (showAddMedicineModal = false)}
						class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 cursor-pointer"
						>إغلاق</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Add Batch Modal -->
{#if showAddBatchModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
		<div class="bg-white dark:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[500px]">
			<h2 class="text-xl font-bold mb-4">إضافة دفعة جديدة</h2>
			<form on:submit|preventDefault={addBatch} class="space-y-3">
				<label class="block">
					<span class="text-right block mb-1">الكمية</span>
					<input
						type="number"
						bind:value={newBatch.quantity}
						required
						class="w-full p-2 border rounded"
						placeholder="الكمية"
					/>
				</label>
				<label class="block">
					<span class="text-right block mb-1">تاريخ الإنتاج</span>
					<input
						type="date"
						bind:value={newBatch.production}
						required
						class="w-full p-2 border rounded"
					/>
				</label>
				<label class="block">
					<span class="text-right block mb-1">تاريخ الانتهاء</span>
					<input
						type="date"
						bind:value={newBatch.expiry}
						required
						class="w-full p-2 border rounded"
					/>
				</label>
				<label class="block">
					<span class="text-right block mb-1">تاريخ الاستلام</span>
					<input
						type="date"
						bind:value={newBatch.received}
						required
						class="w-full p-2 border rounded"
					/>
				</label>
				<label class="block">
					<span class="text-right block mb-1">المورد</span>
					<input
						type="text"
						bind:value={newBatch.supplier}
						required
						class="w-full p-2 border rounded"
						placeholder="اسم المورد"
					/>
				</label>
				<div class="flex justify-end space-x-4 pt-4">
					<button
						disabled={isSubmitting}
						on:click={() => handleSubmit(addBatch)}
						type="submit"
						class="bg-(--green_lighter) text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
					>
						{#if isSubmitting}
							<span>جاري الإضافة...</span>
						{:else}
							<span>إضافة</span>
						{/if}
					</button>
					<button
						type="button"
						on:click={() => (showAddBatchModal = false)}
						class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 cursor-pointer"
					>
						إغلاق
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if hasMore}
	<div class="flex justify-center my-4">
		<button
			class="bg-(--green_lighter) text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
			disabled={isLoadingPage}
			on:click={() => loadMedicines(false)}
		>
			{isLoadingPage ? 'جاري التحميل...' : 'تحميل المزيد'}
		</button>
	</div>
{/if}
