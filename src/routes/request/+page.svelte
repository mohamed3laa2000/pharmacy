<script>
	import { onMount } from 'svelte';
	import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
	import { db, auth } from '$lib/firebase';
	import { userLocation } from '$lib/store/dataStore';
	import { userStore } from '$lib/store/userStore';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';

	let requests = [];
	let medicines = [];
	let guests = [];
	let showAddRequestModal = false;
	let isSubmitting = false;
	let showDetailsModal = false;
	let selectedRequest = null;

	let staffRole = '';
	let staffId = '';

	const allCategories = [
		'المؤثرات العقلية',
		'الأدوية الخاضعة للرقابة',
		'أدوية الوصفات الداخلية',
		'أدوية وصفتي',
		'المستلزمات الطبية'
	];

	let allowedCategories = [];

	let newRequest = {
		description: '',
		guestId: '',
		medicines: [{ category: '', medicineId: '', quantity: '' }]
	};

	// Only allow staff
	onMount(async () => {
		const user = get(userStore);
		const location = get(userLocation);
		if (!user || !location?.pharmacyId) {
			goto('/login');
			return;
		}
		// Find staff subcollection document for this user
		const staffSnap = await getDocs(collection(db, 'Pharmacies', location.pharmacyId, 'staff'));
		staffSnap.forEach((doc) => {
			const data = doc.data();
			if (data.email === user.email) {
				staffId = doc.id;
				staffRole = data.role; // 'doctor' or 'nurse'
			}
		});
		if (!staffId) {
			goto('/login');
			return;
		}
		allowedCategories =
			staffRole === 'doctor'
				? ['الأدوية الخاضعة للرقابة', 'أدوية الوصفات الداخلية']
				: staffRole === 'nurse'
					? ['المؤثرات العقلية', 'أدوية وصفتي', 'المستلزمات الطبية']
					: [];
		await loadData();
	});

	async function loadData() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId || !staffId) return;

		const q = query(
			collection(db, 'Pharmacies', location.pharmacyId, 'requests'),
			orderBy('createdAt', 'desc')
		);
		const reqSnap = await getDocs(q);
		requests = reqSnap.docs
			.map((doc) => ({ id: doc.id, ...doc.data() }))
			.filter((r) => r.requestedBy === staffId);

		const medsSnap = await getDocs(collection(db, 'Pharmacies', location.pharmacyId, 'medicines'));
		medicines = medsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

		const guestsSnap = await getDocs(collection(db, 'Pharmacies', location.pharmacyId, 'guests'));
		guests = guestsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
	}

	function addMedicineField() {
		newRequest.medicines.push({ category: '', medicineId: '', quantity: '' });
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
		if (!location || !location.pharmacyId || !staffId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}
		if (
			!newRequest.description.trim() ||
			!newRequest.guestId ||
			newRequest.medicines.some((m) => !m.category || !m.medicineId || !m.quantity)
		) {
			alert('يرجى ملء جميع الحقول المطلوبة');
			return;
		}
		isSubmitting = true;
		await addDoc(collection(db, 'Pharmacies', location.pharmacyId, 'requests'), {
			description: newRequest.description,
			guestId: newRequest.guestId,
			requestedBy: staffId,
			medicines: newRequest.medicines.map((m) => ({
				category: m.category,
				medicineId: m.medicineId,
				quantity: m.quantity
			})),
			status: 'pending',
			createdAt: new Date()
		});
		newRequest = {
			description: '',
			guestId: '',
			medicines: [{ category: '', medicineId: '', quantity: '' }]
		};
		showAddRequestModal = false;
		isSubmitting = false;
		await loadData();
	}

	async function logout() {
		await auth.signOut();
		goto('/login');
	}

	function openDetailsModal(req) {
		selectedRequest = req;
		showDetailsModal = true;
	}
</script>

<div class="p-10">
	<div class="flex mb-5 justify-between items-center">
		<button
			on:click={() => (showAddRequestModal = true)}
			class="w-32 py-2 cursor-pointer bg-(--green_lighter) text-white rounded hover:bg-green-700"
		>
			إضافة طلب
		</button>
		<button
			on:click={logout}
			type="button"
			class="cursor-pointer text-white bg-(--green_light) hover:bg-(--green_light)/80 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-center"
			>تسجيل الخروج</button
		>
	</div>

	<!-- Requests Table -->
	<div class="relative overflow-x-auto">
		<table
			class="w-full text-lg text-center rtl:text-right text-gray-500 border border-gray-200 rounded-lg"
		>
			<thead class="border-b border-gray-200 bg-gray-50">
				<tr>
					<th class="px-6 py-3">الأدوية المطلوبة</th>
					<th class="px-6 py-3">المريض</th>
					<th class="px-6 py-3">الحالة</th>
				</tr>
			</thead>
			<tbody>
				{#if requests.length === 0}
					<tr>
						<td colspan="5" class="py-8 text-gray-400">لا توجد طلبات بعد</td>
					</tr>
				{:else}
					{#each requests as req}
						<tr
							class="bg-white border-b border-gray-200 cursor-pointer hover:bg-gray-100"
							on:click={() => openDetailsModal(req)}
						>
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
									<span class="text-yellow-600">قيد الانتظار</span>
								{:else if req.status === 'approved'}
									<span class="text-green-600">تمت الموافقة</span>
								{:else if req.status === 'denied'}
									<span class="text-red-600">مرفوض</span>
								{/if}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
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
					<div class="flex mb-2 gap-2 flex-col md:flex-row">
						<!-- Category select for this medicine -->
						<select
							bind:value={med.category}
							class="w-full md:w-1/3 p-2 border rounded cursor-pointer"
							required
						>
							<option value="">اختر الفئة</option>
							{#each allowedCategories as cat}
								<option value={cat}>{cat}</option>
							{/each}
						</select>
						<!-- Medicine select filtered by this row's category -->
						<select
							bind:value={med.medicineId}
							required
							class="w-full md:w-1/3 p-2 border rounded cursor-pointer"
							disabled={!med.category}
						>
							<option value="">اختر الدواء</option>
							{#each medicines.filter((m) => m.category === med.category) as m}
								<option value={m.id}>{m.name}</option>
							{/each}
						</select>
						<div class="flex gap-2 items-center">
							<input
								type="number"
								bind:value={med.quantity}
								min="1"
								required
								class="w-24 p-2 border rounded"
								placeholder="الكمية"
							/>
							{#if newRequest.medicines.length > 1}
								<button
									type="button"
									on:click={() => removeMedicineField(idx)}
									class="bg-red-500 cursor-pointer text-white px-2 rounded w-10"
									title="حذف">-</button
								>
							{/if}
						</div>
					</div>
				{/each}
				<button
					type="button"
					on:click={addMedicineField}
					class="bg-blue-500 cursor-pointer text-white px-2 py-1 rounded mb-2"
				>
					إضافة دواء آخر
				</button>
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
						on:click={() => (showAddRequestModal = false)}
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
{#if showDetailsModal && selectedRequest}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
		<div class="bg-white p-6 rounded-lg w-[90%] md:w-[500px]">
			<h2 class="text-xl font-bold mb-4">تفاصيل الطلب</h2>
			<p class="mb-2 break-words whitespace-pre-line">
				<b>الوصف:</b>
				{selectedRequest.description}
			</p>
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
							: ''}
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
			<p class="mb-2"><b>الأدوية المطلوبة:</b></p>
			<ul class="mb-2">
				{#each selectedRequest.medicines as m}
					<li>
						<b>الفئة:</b>
						{m.category || (medicines.find((med) => med.id === m.medicineId)?.category ?? '')} -
						{#each medicines as med}
							{#if med.id === m.medicineId}
								<b>الدواء:</b> {med.name}
							{/if}
						{/each}
						- <b>الكمية:</b>
						{m.quantity}
					</li>
				{/each}
			</ul>
			<div class="flex justify-end mt-6">
				<button
					on:click={() => (showDetailsModal = false)}
					class="bg-gray-500 cursor-pointer text-white px-4 py-2 rounded hover:bg-gray-600"
				>
					إغلاق
				</button>
			</div>
		</div>
	</div>
{/if}
