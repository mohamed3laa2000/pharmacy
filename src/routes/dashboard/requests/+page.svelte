<script>
	import { onMount } from 'svelte';
	import {
		collection,
		addDoc,
		getDocs,
		doc,
		updateDoc,
		deleteDoc,
		query,
		orderBy,
		limit,
		startAfter
	} from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { get } from 'svelte/store';
	import { userLocation } from '$lib/store/dataStore';
	import { fetchMedicines, fetchStaff, fetchBatchesForMedicine } from '$lib/api/fetchdata';

	let requests = [];
	let lastVisible = null;
	let pageSize = 10;
	let hasMore = true;
	let isLoadingPage = false;
	let medicines = [];
	let staff = [];
	let guests = [];
	let showAddRequestModal = false;
	let isSubmitting = false;
	let showRequestModal = false;
	let selectedRequest = null;

	let newRequest = {
		description: '',
		requestedBy: '',
		guestId: '',
		medicines: [{ medicineId: '', medicineName: '', quantity: '' }]
	};

	async function loadData(initial = true) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;

		let q = query(
			collection(db, 'Pharmacies', location.pharmacyId, 'requests'),
			orderBy('createdAt', 'desc'),
			limit(pageSize)
		);

		if (!initial && lastVisible) {
			q = query(
				collection(db, 'Pharmacies', location.pharmacyId, 'requests'),
				orderBy('createdAt', 'desc'),
				startAfter(lastVisible),
				limit(pageSize)
			);
		}

		isLoadingPage = true;
		const reqSnap = await getDocs(q);
		const newRequests = reqSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

		if (initial) {
			requests = newRequests;
		} else {
			requests = [...requests, ...newRequests];
		}

		lastVisible = reqSnap.docs[reqSnap.docs.length - 1];
		hasMore = reqSnap.docs.length === pageSize;
		isLoadingPage = false;

		medicines = (await fetchMedicines()).map((m) => ({
			id: m.id,
			name: m.name ?? 'بدون اسم'
		}));
		staff = await fetchStaff();

		guests = [];
		if (location && location.pharmacyId) {
			const guestsSnap = await getDocs(collection(db, 'Pharmacies', location.pharmacyId, 'guests'));
			guests = guestsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
		}
	}
	onMount(() => loadData(true));

	function addMedicineField() {
		newRequest.medicines.push({ medicineId: '', medicineName: '', quantity: '' });
		newRequest.medicines = [...newRequest.medicines];
	}
	function removeMedicineField(idx) {
		if (newRequest.medicines.length > 1) {
			newRequest.medicines.splice(idx, 1);
			newRequest.medicines = [...newRequest.medicines];
		}
	}

	async function addRequest() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}
		if (
			!newRequest.description.trim() ||
			!newRequest.requestedBy ||
			!newRequest.guestId ||
			newRequest.medicines.some((m) => !m.medicineId || !m.quantity)
		) {
			alert('يرجى ملء جميع الحقول المطلوبة');
			return;
		}
		isSubmitting = true;
		await addDoc(collection(db, 'Pharmacies', location.pharmacyId, 'requests'), {
			description: newRequest.description,
			requestedBy: newRequest.requestedBy, // staff subcollection ID
			guestId: newRequest.guestId,
			medicines: newRequest.medicines.map((m) => ({
				medicineId: m.medicineId,
				quantity: m.quantity
			})),
			status: 'pending',
			createdAt: new Date()
		});
		newRequest = {
			description: '',
			requestedBy: '',
			guestId: '',
			medicines: [{ medicineId: '', medicineName: '', quantity: '' }]
		};
		showAddRequestModal = false;
		isSubmitting = false;
		await loadData();
	}

	async function approveRequest(request) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;

		// Check inventory for each medicine
		for (const item of request.medicines) {
			const batches = await fetchBatchesForMedicine(item.medicineId);
			const totalAvailable = batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
			if (Number(item.quantity) > totalAvailable) {
				alert(
					`الكمية المطلوبة للدواء "${medicines.find((m) => m.id === item.medicineId)?.name || ''}" أكبر من المتوفر في المخزون (${totalAvailable})`
				);
				return;
			}
		}

		// Deduct quantities from inventory
		for (const item of request.medicines) {
			const batches = await fetchBatchesForMedicine(item.medicineId);
			let qtyToDeduct = Number(item.quantity);
			for (const batch of batches.sort((a, b) => {
				const aDate = a.expiryDate?.toDate?.() ? a.expiryDate.toDate() : new Date(2100, 0, 1);
				const bDate = b.expiryDate?.toDate?.() ? b.expiryDate.toDate() : new Date(2100, 0, 1);
				return aDate - bDate;
			})) {
				if (qtyToDeduct <= 0) break;
				if (!batch.id) continue;
				const deduct = Math.min(batch.quantity, qtyToDeduct);
				const newQty = batch.quantity - deduct;
				try {
					await updateDoc(
						doc(
							db,
							'Pharmacies',
							location.pharmacyId,
							'medicines',
							item.medicineId,
							'batches',
							batch.id
						),
						{ quantity: newQty }
					);
					await updateDoc(doc(db, 'Pharmacies', location.pharmacyId, 'batches', batch.id), {
						quantity: newQty
					});
					if (newQty <= 0) {
						await deleteDoc(
							doc(
								db,
								'Pharmacies',
								location.pharmacyId,
								'medicines',
								item.medicineId,
								'batches',
								batch.id
							)
						);
						await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'batches', batch.id));
					}
				} catch (e) {
					console.warn('Batch not found, skipping:', batch.id, e);
				}
				qtyToDeduct -= deduct;
			}
		}
		// Mark request as approved
		await updateDoc(doc(db, 'Pharmacies', location.pharmacyId, 'requests', request.id), {
			status: 'approved',
			approvedAt: new Date()
		});
		await loadData();
	}

	async function denyRequest(request) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;
		await updateDoc(doc(db, 'Pharmacies', location.pharmacyId, 'requests', request.id), {
			status: 'denied',
			deniedAt: new Date()
		});
		await loadData();
	}

	function openRequestModal(req) {
		selectedRequest = req;
		showRequestModal = true;
	}

	async function deleteRequest(requestId) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;
		if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
			await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'requests', requestId));
			showRequestModal = false;
			await loadData();
		}
	}

	function closeAddRequestModal() {
		showAddRequestModal = false;
		newRequest = {
			description: '',
			requestedBy: '',
			guestId: '',
			medicines: [{ medicineId: '', medicineName: '', quantity: '' }]
		};
	}
</script>

<!-- Add Request Button -->
<!-- <div class="flex mb-5">
	<button
		on:click={() => (showAddRequestModal = true)}
		class="w-32 py-2 cursor-pointer bg-(--green_lighter) text-white rounded hover:bg-green-700"
	>
		إضافة طلب
	</button>
</div> -->

<!-- Requests Table -->
<div class="relative overflow-x-auto">
	<table class="w-full text-lg text-center rtl:text-right text-gray-500">
		<thead>
			<tr>
				<th class="px-6 py-3">العضو</th>
				<th class="px-6 py-3">الأدوية المطلوبة</th>
				<th class="px-6 py-3">الحالة</th>
				<th class="px-6 py-3">المريض</th>
				<th class="px-6 py-3">إجراءات</th>
			</tr>
		</thead>
		<tbody>
			{#each requests as req}
				<tr
					class="bg-white border-b border-gray-200 cursor-pointer hover:bg-gray-100"
					on:click={() => openRequestModal(req)}
				>
					<td class="px-6 py-4">
						{#if staff.length}
							{#each staff as s}
								{#if s.id === req.requestedBy}
									{(s.role === 'doctor' ? 'دكتور' : 'ممرض') + ' - ' + s.name}
								{/if}
							{/each}
						{:else}
							-
						{/if}
					</td>
					<td class="px-6 py-4">
						<ul>
							{#each req.medicines as m}
								<li>
									{#each medicines as med}
										{#if med.id === m.medicineId}
											{med.name} ({m.quantity})
										{/if}
									{/each}
								</li>
							{/each}
						</ul>
					</td>
					<td class="px-6 py-4">
						{#if req.status === 'pending'}
							<span class="text-yellow-600">قيد الانتظار</span>
						{:else if req.status === 'approved'}
							<span class="text-green-600">تمت الموافقة</span>
						{:else if req.status === 'denied'}
							<span class="text-red-600">مرفوض</span>
						{/if}
					</td>
					<td class="px-6 py-4">
						{#if req.guestId}
							{#each guests as g}
								{#if g.id === req.guestId}
									{g.name}
								{/if}
							{/each}
						{:else}
							-
						{/if}
					</td>
					<td class="px-6 py-4">
						{#if req.status === 'pending'}
							<button
								on:click|stopPropagation={() => approveRequest(req)}
								class="bg-green-600 cursor-pointer text-white px-2 py-1 rounded hover:bg-green-700 mx-1"
								>موافقة</button
							>
							<button
								on:click|stopPropagation={() => denyRequest(req)}
								class="bg-red-600 cursor-pointer text-white px-2 py-1 rounded hover:bg-red-700 mx-1"
								>رفض</button
							>
						{:else}
							-
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Add Request Modal -->
{#if showAddRequestModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
		<div class="bg-white p-6 rounded-lg w-[90%] md:w-[500px]">
			<h2 class="text-xl font-bold mb-4">إضافة طلب جديد</h2>
			<form on:submit|preventDefault={addRequest}>
				<textarea
					bind:value={newRequest.description}
					placeholder="وصف الطلب"
					required
					class="w-full p-2 mb-2 border rounded"
				></textarea>
				<select
					bind:value={newRequest.requestedBy}
					required
					class="w-full p-2 mb-2 border rounded cursor-pointer"
				>
					<option value="">اختر العضو</option>
					{#each staff as s}
						<option value={s.id}>{(s.role === 'doctor' ? 'دكتور' : 'ممرض') + ' - ' + s.name}</option
						>
					{/each}
				</select>
				<select
					bind:value={newRequest.guestId}
					required
					class="w-full p-2 mb-2 border rounded cursor-pointer"
				>
					<option value="">اختر المريض</option>
					{#each guests as g}
						<option value={g.id}>{g.name} {g.nationalId ? `(${g.nationalId})` : ''}</option>
					{/each}
				</select>
				<h3 class="font-bold mb-2">الأدوية المطلوبة:</h3>
				{#each newRequest.medicines as med, idx}
					<div class="flex mb-2 gap-2 flex-col">
						<div class="relative">
							<input
								type="text"
								bind:this={med.inputRef}
								bind:value={med.medicineName}
								placeholder="ابحث واختر الدواء..."
								class="w-full p-2 border rounded"
								autocomplete="off"
								on:focus={() => (med.showDropdown = true)}
								on:input={() => (med.showDropdown = true)}
								on:blur={() => setTimeout(() => (med.showDropdown = false), 100)}
							/>
							{#if med.showDropdown}
								<ul class="absolute z-10 bg-white border w-full max-h-40 overflow-auto">
									{#each medicines.filter((m) => !med.medicineName || m.name
												.toLowerCase()
												.includes(med.medicineName.toLowerCase())) as m}
										<li
											class="p-2 hover:bg-gray-200 cursor-pointer"
											on:mousedown={() => {
												med.medicineId = m.id;
												med.medicineName = m.name;
												med.showDropdown = false;
												med.inputRef && med.inputRef.blur();
											}}
										>
											{m.name}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						<div class="flex gap-2">
							<input
								type="number"
								bind:value={med.quantity}
								min="1"
								required
								class="w-1/3 p-2 border rounded"
								placeholder="الكمية"
							/>
							{#if newRequest.medicines.length > 1}
								<button
									type="button"
									on:click={() => removeMedicineField(idx)}
									class="bg-red-500 cursor-pointer text-white px-2 rounded w-10">-</button
								>
							{/if}
						</div>
					</div>
				{/each}
				<button
					type="button"
					on:click={addMedicineField}
					class="bg-blue-500 cursor-pointer text-white px-2 py-1 rounded mb-2"
					>إضافة دواء آخر</button
				>
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
						type="button"
						on:click={closeAddRequestModal}
						class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 cursor-pointer"
					>
						إغلاق
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Request Details Modal -->
{#if showRequestModal && selectedRequest}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
		<div class="bg-white p-6 rounded-lg w-[90%] md:w-[500px]">
			<h2 class="text-xl font-bold mb-4">تفاصيل الطلب</h2>
			<p class="mb-2 break-words whitespace-pre-line">
				<b>الوصف:</b>
				{selectedRequest.description}
			</p>
			<p class="mb-2">
				<b>تاريخ الطلب:</b>
				{selectedRequest.createdAt
					? new Date(
							selectedRequest.createdAt.seconds
								? selectedRequest.createdAt.seconds * 1000
								: selectedRequest.createdAt
						).toLocaleString('ar-EG')
					: '-'}
			</p>
			<p class="mb-2">
				<b>العضو:</b>
				{#each staff as s}
					{#if s.id === selectedRequest.requestedBy}
						{(s.role === 'doctor' ? 'دكتور' : 'ممرض') + ' - ' + s.name}
					{/if}
				{/each}
			</p>
			<p class="mb-2"><b>الأدوية المطلوبة:</b></p>
			<ul class="mb-2">
				{#each selectedRequest.medicines as m}
					<li>
						<b>الفئة:</b>
						{m.category || (medicines.find((med) => med.id === m.medicineId)?.category ?? '')}
						-
						{#each medicines as med}
							{#if med.id === m.medicineId}
								<b>الدواء:</b> {med.name}
							{/if}
						{/each}
						- <b>الكمية:</b> {m.quantity}
					</li>
				{/each}
			</ul>
			<p class="mb-2">
				<b>المريض:</b>
				{#if selectedRequest.guestId}
					{#each guests as g}
						{#if g.id === selectedRequest.guestId}
							{g.name}
						{/if}
					{/each}
				{:else}
					-
				{/if}
			</p>
			<p class="mb-2">
				<b>الحالة:</b>
				{selectedRequest.status === 'pending'
					? 'قيد الانتظار'
					: selectedRequest.status === 'approved'
						? 'تمت الموافقة'
						: selectedRequest.status === 'denied'
							? 'مرفوض'
							: selectedRequest.status === 'deleted'
								? 'محذوف'
								: ''}
			</p>
			<div class="flex justify-end space-x-4 mt-6">
				<button
					on:click={() => deleteRequest(selectedRequest.id)}
					class="bg-red-600 cursor-pointer text-white px-4 py-2 rounded hover:bg-red-700"
				>
					حذف
				</button>
				<button
					on:click={() => (showRequestModal = false)}
					class="bg-gray-500 cursor-pointer text-white px-4 py-2 rounded hover:bg-gray-600"
				>
					إغلاق
				</button>
			</div>
		</div>
	</div>
{/if}

{#if hasMore}
	<div class="flex justify-center my-6">
		<button
			on:click={() => loadData(false)}
			class="bg-(--green_lighter) text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
			disabled={isLoadingPage}
		>
			{isLoadingPage ? 'جاري التحميل...' : 'تحميل المزيد'}
		</button>
	</div>
{/if}
