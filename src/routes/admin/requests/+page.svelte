<script>
	import { onMount } from 'svelte';
	import {
		collection,
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

	let pharmacies = [];
	let selectedPharmacy = '';
	let requests = [];
	let lastVisible = null;
	let pageSize = 10;
	let hasMore = false;
	let isLoadingPage = false;
	let medicines = [];
	let staff = [];
	let guests = [];

	onMount(async () => {
		const snapshot = await getDocs(collection(db, 'Pharmacies'));
		pharmacies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
	});

	// Custom fetchMedicines for this page
	async function fetchMedicines(pharmacyId) {
		const medsSnap = await getDocs(collection(db, 'Pharmacies', pharmacyId, 'medicines'));
		return medsSnap.docs.map((doc) => ({
			id: doc.id,
			name: doc.data().name ?? 'بدون اسم'
		}));
	}

	// Custom fetchStaff for this page
	async function fetchStaff(pharmacyId) {
		const staffSnap = await getDocs(collection(db, 'Pharmacies', pharmacyId, 'staff'));
		return staffSnap.docs.map((doc) => ({
			id: doc.id,
			name: doc.data().name ?? 'بدون اسم',
			role: doc.data().role ?? ''
		}));
	}

	// Fetch guests for this pharmacy
	async function fetchGuests(pharmacyId) {
		const guestsSnap = await getDocs(collection(db, 'Pharmacies', pharmacyId, 'guests'));
		return guestsSnap.docs.map((doc) => ({
			id: doc.id,
			name: doc.data().name ?? 'بدون اسم',
			nationalId: doc.data().nationalId ?? '',
		}));
	}

	async function loadData(initial = true) {
		if (!selectedPharmacy) {
			requests = [];
			return;
		}
		const pharmacyObj = pharmacies.find((p) => p.id === selectedPharmacy);
		if (!pharmacyObj) {
			medicines = [];
			staff = [];
			guests = [];
			return;
		}
		let q = query(
			collection(db, 'Pharmacies', selectedPharmacy, 'requests'),
			orderBy('createdAt', 'desc'),
			limit(pageSize)
		);

		if (!initial && lastVisible) {
			q = query(
				collection(db, 'Pharmacies', selectedPharmacy, 'requests'),
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

		medicines = await fetchMedicines(selectedPharmacy);
		staff = await fetchStaff(selectedPharmacy);
		guests = await fetchGuests(selectedPharmacy);
	}

	async function approveRequest(request) {
		await updateDoc(doc(db, 'Pharmacies', selectedPharmacy, 'requests', request.id), {
			status: 'approved',
			approvedAt: new Date()
		});
		await loadData();
	}

	async function denyRequest(request) {
		await updateDoc(doc(db, 'Pharmacies', selectedPharmacy, 'requests', request.id), {
			status: 'denied',
			deniedAt: new Date()
		});
		await loadData();
	}
</script>

<h1 class="text-2xl font-bold mb-6">طلبات الصيدليات</h1>

<div class="mb-6 flex items-center gap-3">
	<label class="font-semibold text-gray-700 whitespace-nowrap">اختر صيدلية:</label>
	<select
		bind:value={selectedPharmacy}
		on:change={() => loadData(true)}
		class="cursor-pointer p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-(--green_light) transition bg-white text-gray-900"
		style="width: 140px;"
		disabled={pharmacies.length === 0}
	>
		<option value="">-- اختر --</option>
		{#each pharmacies as pharmacy}
			<option value={pharmacy.id}>{pharmacy.location || pharmacy.id}</option>
		{/each}
	</select>
</div>

{#if !selectedPharmacy}
	<p class="text-gray-500">يرجى اختيار صيدلية لعرض الطلبات.</p>
{:else}
	<div class="relative overflow-x-auto">
		<table class="w-full text-lg text-center rtl:text-right text-gray-500">
			<thead>
				<tr>
					<th class="px-6 py-3">العضو</th>
					<th class="px-6 py-3">الأدوية المطلوبة</th>
					<th class="px-6 py-3">الحالة</th>
					<th class="px-6 py-3">المريض</th>
				</tr>
			</thead>
			<tbody>
				{#each requests as req}
					<tr class="bg-white border-b border-gray-200">
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
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if hasMore}
	<div class="flex justify-center my-4">
		<button
			class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
			disabled={isLoadingPage}
			on:click={() => loadData(false)}
		>
			{isLoadingPage ? 'جاري التحميل...' : 'تحميل المزيد'}
		</button>
	</div>
{/if}
