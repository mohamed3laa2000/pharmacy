<script>
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import {
		collection,
		addDoc,
		getDocs,
		getDoc,
		query,
		where,
		orderBy,
		updateDoc,
		doc,
		deleteDoc
	} from 'firebase/firestore';
	import { fetchMedicines, fetchPharmacies } from '$lib/api/fetchdata';
	import { userLocation } from '$lib/store/dataStore';
	import { get } from 'svelte/store';

	let medicines = [];
	let pharmacies = [];
	let exchangeRequests = [];
	let outgoingRequests = [];
	let selectedMedicine = '';
	let selectedPharmacy = '';
	let quantity = 1;
	let note = '';
	let loading = false;

	// Fetch medicines and requests on mount
	onMount(async () => {
		medicines = await fetchMedicines();
		pharmacies = await fetchPharmacies();
		await loadRequests();
	});

	async function loadRequests() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;
		const ref = collection(db, 'exchangeRequests');
		const qIncoming = query(
			ref,
			where('toPharmacyId', '==', location.pharmacyId),
			orderBy('createdAt', 'desc')
		);
		const qOutgoing = query(
			ref,
			where('fromPharmacyId', '==', location.pharmacyId),
			orderBy('createdAt', 'desc')
		);
		exchangeRequests = (await getDocs(qIncoming)).docs.map((doc) => ({
			id: doc.id,
			...doc.data()
		}));
		outgoingRequests = (await getDocs(qOutgoing)).docs.map((doc) => ({
			id: doc.id,
			...doc.data()
		}));
	}

	async function createExchangeRequest() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;
		loading = true;

		const selectedMed = medicines.find((m) => m.id === selectedMedicine);
		if (!selectedMed) {
			alert('يرجى اختيار دواء صحيح.');
			loading = false;
			return;
		}

		// Check for existing pending request for same medicine, sender, receiver
		const ref = collection(db, 'exchangeRequests');
		const q = query(
			ref,
			where('fromPharmacyId', '==', location.pharmacyId),
			where('toPharmacyId', '==', selectedPharmacy),
			where('catalogId', '==', selectedMed.catalogId),
			where('status', '==', 'pending')
		);
		const snap = await getDocs(q);
		if (!snap.empty) {
			alert('هناك طلب معلق بالفعل لهذا الدواء بين نفس الصيدليتين.');
			loading = false;
			return;
		}

		await addDoc(collection(db, 'exchangeRequests'), {
			medicineId: selectedMedicine,
			catalogId: selectedMed.catalogId,
			quantity: Number(quantity),
			fromPharmacyId: location.pharmacyId,
			toPharmacyId: selectedPharmacy,
			note,
			status: 'pending',
			createdAt: new Date()
		});
		loading = false;
		selectedMedicine = '';
		selectedPharmacy = '';
		quantity = 1;
		note = '';
		await loadRequests();
	}

	async function handleApprove(req) {
		loading = true;
		try {
			const supplierId = req.toPharmacyId;
			const requesterId = req.fromPharmacyId;
			const catalogId = req.catalogId;
			const qtyNeeded = req.quantity;

			// Find supplier's medicineId by catalogId
			const supplierMedsRef = collection(db, 'Pharmacies', supplierId, 'medicines');
			const supplierMedsSnap = await getDocs(supplierMedsRef);
			const supplierMedDoc = supplierMedsSnap.docs.find(
				(doc) => doc.data().catalogId === catalogId
			);

			if (!supplierMedDoc) {
				alert('الصيدلية الموردة لا تملك هذا الدواء.');
				return;
			}
			const supplierMedicineId = supplierMedDoc.id;

			// 1. Fetch supplier's batches for this medicine, sorted by expiry
			const supplierBatchesRef = collection(
				db,
				'Pharmacies',
				supplierId,
				'medicines',
				supplierMedicineId,
				'batches'
			);
			const supplierBatchesSnap = await getDocs(supplierBatchesRef);
			let supplierBatches = supplierBatchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
			supplierBatches = supplierBatches
				.filter((b) => b.quantity > 0)
				.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

			let qtyToDeduct = qtyNeeded;
			let batchesUsed = [];
			for (const batch of supplierBatches) {
				if (qtyToDeduct <= 0) break;
				const deduct = Math.min(batch.quantity, qtyToDeduct);
				batchesUsed.push({ ...batch, deduct });
				qtyToDeduct -= deduct;
			}

			if (qtyToDeduct > 0) {
				alert('لا يوجد كمية كافية في الصيدلية الموردة.');
				return;
			}

			// 2. Deduct from supplier's batches (and delete if 0)
			for (const batch of batchesUsed) {
				const newQty = batch.quantity - batch.deduct;
				const batchDocRef = doc(
					db,
					'Pharmacies',
					supplierId,
					'medicines',
					supplierMedicineId,
					'batches',
					batch.id
				);
				const mainBatchDocRef = doc(db, 'Pharmacies', supplierId, 'batches', batch.id);
				if (newQty <= 0) {
					await deleteDoc(batchDocRef);
					await deleteDoc(mainBatchDocRef);
				} else {
					await updateDoc(batchDocRef, { quantity: newQty });
					await updateDoc(mainBatchDocRef, { quantity: newQty });
				}
			}

			// 3. Find or create the medicine in the requester pharmacy
			const requesterMedsRef = collection(db, 'Pharmacies', requesterId, 'medicines');
			const requesterMedsSnap = await getDocs(requesterMedsRef);
			let requesterMedDoc = requesterMedsSnap.docs.find(
				(doc) => doc.data().catalogId === catalogId
			);

			let requesterMedicineId;
			if (!requesterMedDoc) {
				// Create the medicine in the requester pharmacy
				const supplierMedData = supplierMedDoc.data();
				const newMedDoc = await addDoc(requesterMedsRef, {
					...supplierMedData,
					createdAt: new Date()
				});
				requesterMedicineId = newMedDoc.id;
			} else {
				requesterMedicineId = requesterMedDoc.id;
			}

			// 4. Add a batch to the requester pharmacy (use expiry of first batch used)
			const firstBatch = batchesUsed[0];
			const requesterBatchRef = collection(
				db,
				'Pharmacies',
				requesterId,
				'medicines',
				requesterMedicineId,
				'batches'
			);
			await addDoc(requesterBatchRef, {
				medicineId: requesterMedicineId,
				quantity: qtyNeeded,
				expiryDate: firstBatch.expiryDate,
				note: `تم الاستلام من صيدلية أخرى (${supplierId}) عبر التبادل`,
				supplier: supplierId, // Add the supplier pharmacy ID
				sentAt: new Date(), // Add the timestamp of sending
				createdAt: new Date()
			});

			// 5. Update request status
			await updateDoc(doc(db, 'exchangeRequests', req.id), { status: 'approved' });
			await loadRequests();
		} catch (e) {
			alert('حدث خطأ');
		} finally {
			loading = false;
		}
	}

	async function handleReject(req) {
		await updateDoc(doc(db, 'exchangeRequests', req.id), { status: 'denied' });
		await loadRequests();
	}

	async function handleCancel(req) {
		await deleteDoc(doc(db, 'exchangeRequests', req.id));
		await loadRequests();
	}
</script>

<h1 class="text-2xl font-bold mb-6">تبادل الأدوية بين الصيدليات</h1>

<!-- New Exchange Request -->
<div class="bg-white rounded shadow p-4 mb-8">
	<h2 class="font-semibold mb-4">طلب تبادل جديد</h2>
	<div class="flex flex-col md:flex-row gap-4">
		<select bind:value={selectedMedicine} class="p-2 border rounded w-full md:w-1/4">
			<option value="" disabled selected>اختر الدواء</option>
			{#each medicines as med}
				<option value={med.id}>{med.name}</option>
			{/each}
		</select>
		<input
			type="number"
			min="1"
			bind:value={quantity}
			class="p-2 border rounded w-full md:w-1/6"
			placeholder="الكمية"
		/>
		<select bind:value={selectedPharmacy} class="p-2 border rounded w-full md:w-1/4">
			<option value="" disabled selected>اختر الصيدلية</option>
			{#each pharmacies.filter((ph) => ph.id !== get(userLocation)?.pharmacyId) as ph}
				<option value={ph.id}>{ph.location}</option>
			{/each}
		</select>
		<input
			type="text"
			bind:value={note}
			class="p-2 border rounded w-full md:w-1/3"
			placeholder="ملاحظات (اختياري)"
		/>
		<!-- Example for the "إرسال الطلب" button -->
		<button
			on:click={createExchangeRequest}
			class="cursor-pointer bg-(--green_lighter) text-white px-4 rounded hover:bg-green-700"
			disabled={loading || !selectedMedicine || !selectedPharmacy}
		>
			{loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
		</button>
	</div>
</div>

<!-- Incoming Requests -->
<div class="mb-8">
	<h2 class="font-semibold mb-2">الطلبات الواردة</h2>
	<table class="min-w-full bg-white rounded shadow">
		<thead>
			<tr>
				<th class=" text-right px-4 py-2">الدواء</th>
				<th class=" text-right px-4 py-2">الكمية</th>
				<th class=" text-right px-4 py-2">من صيدلية</th>
				<th class=" text-right px-4 py-2">الحالة</th>
				<th class=" text-right px-4 py-2">ملاحظات</th>
				<th class=" text-right px-4 py-2">إجراءات</th>
			</tr>
		</thead>
		<tbody>
			{#each exchangeRequests as req}
				<tr>
					<td class="px-4 py-2">{medicines.find((m) => m.id === req.medicineId)?.name ?? '-'}</td>
					<td class="px-4 py-2">{req.quantity}</td>
					<td class="px-4 py-2"
						>{pharmacies.find((ph) => ph.id === req.fromPharmacyId)?.name ?? req.fromPharmacyId}</td
					>
					<td class="px-4 py-2">{req.status}</td>
					<td class="px-4 py-2">{req.note}</td>
					<td class="px-4 py-2">
						{#if req.status === 'pending' && req.toPharmacyId === get(userLocation)?.pharmacyId}
							<button
								on:click={() => handleApprove(req)}
								class="cursor-pointer bg-green-500 text-white px-2 py-1 rounded mx-1"
								disabled={loading}
							>
								قبول
							</button>
							<button
								on:click={() => handleReject(req)}
								class="cursor-pointer bg-red-500 text-white px-2 py-1 rounded mx-1"
								disabled={loading}
							>
								رفض
							</button>
						{:else}
							<span class="text-gray-400">تم {req.status === 'approved' ? 'القبول' : 'الرفض'}</span>
						{/if}
					</td>
					<td class="px-4 py-2">
						{#if req.status === 'pending'}
							<button
								on:click={() => handleCancel(req)}
								class="cursor-pointer bg-red-500 text-white px-2 py-1 rounded"
								disabled={loading}
							>
								إلغاء
							</button>
						{/if}
					</td>
				</tr>
			{/each}
			{#if exchangeRequests.length === 0}
				<tr><td colspan="6" class="text-center py-4">لا توجد طلبات واردة</td></tr>
			{/if}
		</tbody>
	</table>
</div>

<!-- Outgoing Requests -->
<div>
	<h2 class="font-semibold mb-2">الطلبات الصادرة</h2>
	<table class="min-w-full bg-white rounded shadow">
		<thead>
			<tr>
				<th class=" text-right px-4 py-2">الدواء</th>
				<th class=" text-right px-4 py-2">الكمية</th>
				<th class=" text-right px-4 py-2">إلى صيدلية</th>
				<th class=" text-right px-4 py-2">الحالة</th>
				<th class=" text-right px-4 py-2">ملاحظات</th>
				<th class=" text-right px-4 py-2">إجراءات</th>
			</tr>
		</thead>
		<tbody>
			{#each outgoingRequests as req}
				<tr>
					<td class="px-4 py-2">{medicines.find((m) => m.id === req.medicineId)?.name ?? '-'}</td>
					<td class="px-4 py-2">{req.quantity}</td>
					<td class="px-4 py-2"
						>{pharmacies.find((ph) => ph.id === req.toPharmacyId)?.location ?? req.toPharmacyId}</td
					>
					<td class="px-4 py-2">{req.status}</td>
					<td class="px-4 py-2">{req.note}</td>
					<td class="px-4 py-2">
						{#if req.status === 'pending'}
							<button
								on:click={() => handleCancel(req)}
								class="cursor-pointer bg-red-500 text-white px-2 py-1 rounded"
							>
								إلغاء
							</button>
						{/if}
					</td>
				</tr>
			{/each}
			{#if outgoingRequests.length === 0}
				<tr><td colspan="6" class="text-center py-4">لا توجد طلبات صادرة</td></tr>
			{/if}
		</tbody>
	</table>
</div>
