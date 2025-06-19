<script>
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { collection, getDocs, orderBy, query, limit, startAfter } from 'firebase/firestore';

	let pharmacies = [];
	let selectedPharmacy = '';
	let medicines = [];
	let searchQuery = '';
	let filteredMedicines = [];
	let loading = false;
	let lastVisible = null;
	let pageSize = 10;
	let hasMore = false;
	let isLoadingPage = false;

	onMount(async () => {
		const snapshot = await getDocs(collection(db, 'Pharmacies'));
		pharmacies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
	});

	async function loadMedicines(initial = true) {
		if (!selectedPharmacy) {
			medicines = [];
			filteredMedicines = [];
			return;
		}
		let q = query(
			collection(db, 'Pharmacies', selectedPharmacy, 'medicines'),
			orderBy('name'),
			limit(pageSize)
		);
		if (!initial && lastVisible) {
			q = query(
				collection(db, 'Pharmacies', selectedPharmacy, 'medicines'),
				orderBy('name'),
				startAfter(lastVisible),
				limit(pageSize)
			);
		}
		isLoadingPage = true;
		loading = initial;
		const snap = await getDocs(q);
		const newMeds = await Promise.all(
			snap.docs.map(async (doc) => {
				const batchesSnap = await getDocs(
					collection(db, 'Pharmacies', selectedPharmacy, 'medicines', doc.id, 'batches')
				);
				const totalQuantity = batchesSnap.docs.reduce(
					(sum, batch) => sum + (batch.data().quantity || 0),
					0
				);
				return { id: doc.id, ...doc.data(), quantity: totalQuantity };
			})
		);
		if (initial) {
			medicines = newMeds;
		} else {
			medicines = [...medicines, ...newMeds];
		}
		filterMedicines();
		lastVisible = snap.docs[snap.docs.length - 1];
		hasMore = snap.docs.length === pageSize;
		isLoadingPage = false;
		loading = false;
	}

	function filterMedicines() {
		let meds = medicines;
		if (searchQuery.trim()) {
			meds = meds.filter((med) => med.name?.toLowerCase().includes(searchQuery.toLowerCase()));
		}
		filteredMedicines = meds
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));
	}

	$: if (searchQuery !== undefined) filterMedicines();
</script>

<h1 class="text-2xl font-bold mb-6">مخزون الصيدليات</h1>

<div class="mb-6 flex items-center gap-3">
	<label class="font-semibold text-gray-700 whitespace-nowrap">اختر صيدلية:</label>
	<select
		bind:value={selectedPharmacy}
		on:change={() => loadMedicines(true)}
		class="cursor-pointer p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-(--green_light) transition bg-white text-gray-900"
		style="width: 140px;"
	>
		<option value="">-- اختر --</option>
		{#each pharmacies as pharmacy}
			<option value={pharmacy.id}>{pharmacy.location || pharmacy.id}</option>
		{/each}
	</select>
</div>

{#if selectedPharmacy}
	<div class="flex mb-5">
		<input
			type="text"
			placeholder="ابحث عن دواء..."
			bind:value={searchQuery}
			class="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-600 transition bg-white text-gray-900"
		/>
	</div>
{/if}

{#if loading}
	<p>جاري تحميل المخزون...</p>
{:else if filteredMedicines.length}
	<div class="relative overflow-x-auto">
		<table class="w-full text-lg text-center rtl:text-right text-gray-500">
			<thead class="text-3xs text-gray-700 uppercase bg-gray-50">
				<tr>
					<th class="px-6 py-3">الاسم</th>
					<th class="px-6 py-3">الفئة</th>
					<th class="px-6 py-3">النوع</th>
					<th class="px-6 py-3">الكمية المتوفرة</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredMedicines as med}
					<tr class="bg-white border-b border-gray-200">
						<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{med.name}</td>
						<td class="px-6 py-4">{med.category ?? 'غير محدد'}</td>
						<td class="px-6 py-4">{med.unit ?? 'غير محدد'}</td>
						<td class="px-6 py-4">{med.quantity ?? 'غير متاح'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if selectedPharmacy}
	<p>لا يوجد بيانات.</p>
{/if}

{#if hasMore}
	<div class="flex justify-center my-4">
		<button
			class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
			disabled={isLoadingPage}
			on:click={() => loadMedicines(false)}
		>
			{isLoadingPage ? 'جاري التحميل...' : 'تحميل المزيد'}
		</button>
	</div>
{/if}
