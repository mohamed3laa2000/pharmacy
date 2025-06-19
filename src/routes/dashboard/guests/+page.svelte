<script>
	import { onMount } from 'svelte';
	import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { writable, derived, get } from 'svelte/store';
	import { userLocation } from '$lib/store/dataStore';

	let guests = [];
	let showAddModal = false;
	let newGuest = { name: '', nationalId: '', age: '', phone: '', notes: '' };
	let errors = {};
	let newDiagnosis = '';

	// Search logic
	export const searchGuests = writable([]);
	export const searchQuery = writable('');

	export const filteredGuests = derived(
		[searchGuests, searchQuery],
		([$searchGuests, $searchQuery]) => {
			let gs = $searchGuests;
			if ($searchQuery.trim()) {
				gs = gs.filter((g) => (g.name || '').toLowerCase().includes($searchQuery.toLowerCase()));
			}
			return gs
				.slice()
				.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' }));
		}
	);

	async function loadGuests() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;
		const snap = await getDocs(collection(db, 'Pharmacies', location.pharmacyId, 'guests'));
		guests = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
		searchGuests.set(guests);
	}

	function validateGuest(guest) {
		let errs = {};
		if (!String(guest.name).trim()) errs.name = 'الاسم مطلوب';
		if (!String(guest.nationalId).trim() || !/^\d{10,}$/.test(guest.nationalId))
			errs.nationalId = 'رقم مدني صالح مطلوب (10 أرقام أو أكثر)';
		if (String(guest.age).trim() === '' || isNaN(Number(guest.age)) || Number(guest.age) < 0)
			errs.age = 'العمر يجب أن يكون رقمًا صحيحًا';
		if (!String(guest.phone).trim() || !/^05\d{8}$/.test(guest.phone))
			errs.phone = 'رقم هاتف سعودي صحيح مطلوب (05xxxxxxxx)';
		return errs;
	}

	let addSubmitting = false;
	async function addGuest() {
		if (addSubmitting) return;
		errors = validateGuest(newGuest);
		if (Object.keys(errors).length > 0) return;
		addSubmitting = true;
		try {
			const location = get(userLocation);
			if (!location || !location.pharmacyId) return;
			await addDoc(collection(db, 'Pharmacies', location.pharmacyId, 'guests'), {
				...newGuest,
				createdAt: new Date()
			});
			showAddModal = false;
			newGuest = { name: '', nationalId: '', age: '', phone: '', notes: '' };
			errors = {};
			await loadGuests();
		} finally {
			addSubmitting = false;
		}
	}

	let selectedGuest = null;
	let showGuestModal = false;
	let editMode = false;
	let editGuest = {};
	let editSubmitting = false;
	let deleteSubmitting = false;

	function openModal(guest) {
		selectedGuest = guest;
		editGuest = { ...guest };
		editMode = false;
		showGuestModal = true;
		errors = {};
		newDiagnosis = '';
	}

	function closeModal() {
		selectedGuest = null;
		showGuestModal = false;
		editMode = false;
		errors = {};
		newDiagnosis = '';
	}

	async function saveEditGuest() {
		if (editSubmitting) return;
		errors = validateGuest(editGuest);
		if (Object.keys(errors).length > 0) return;
		editSubmitting = true;
		try {
			const location = get(userLocation);
			if (!location || !location.pharmacyId) return;
			await updateDoc(doc(db, 'Pharmacies', location.pharmacyId, 'guests', selectedGuest.id), {
				...editGuest
			});
			selectedGuest = { ...editGuest };
			editMode = false;
			errors = {};
			await loadGuests();
		} finally {
			editSubmitting = false;
		}
	}

	async function deleteGuest() {
		if (deleteSubmitting) return;
		if (!window.confirm('هل أنت متأكد أنك تريد حذف هذا المريض؟ لا يمكن التراجع عن هذا الإجراء.')) {
			return;
		}
		deleteSubmitting = true;
		try {
			const location = get(userLocation);
			if (!location || !location.pharmacyId) return;
			await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'guests', selectedGuest.id));
			closeModal();
			await loadGuests();
		} finally {
			deleteSubmitting = false;
		}
	}

	onMount(loadGuests);
</script>

<h1 class="text-2xl font-bold mb-6">قائمة المرضى</h1>

<!-- Search & Add Guest -->
<div class="flex mb-5">
	<input
		type="text"
		placeholder="ابحث عن مريض..."
		bind:value={$searchQuery}
		class="ml-3 w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-600"
	/>
	<button
		on:click={() => (showAddModal = true)}
		class="w-28 cursor-pointer bg-green-600 text-white rounded hover:bg-green-700 transition"
	>
		+ إضافة مريض
	</button>
</div>

<div class="relative overflow-x-auto">
	<table class="w-full text-lg text-center rtl:text-right text-gray-500 dark:text-gray-400">
		<thead class="text-3xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
			<tr>
				<th class="px-6 py-3">الاسم</th>
				<th class="px-6 py-3">الرقم المدني</th>
				<th class="px-6 py-3">العمر</th>
				<th class="px-6 py-3">الهاتف</th>
			</tr>
		</thead>
		<tbody>
			{#each $filteredGuests as guest}
				<tr
					on:click={() => openModal(guest)}
					class="hover:bg-black/10 cursor-pointer bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200"
				>
					<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
						{guest.name}
					</td>
					<td class="px-6 py-4">{guest.nationalId ?? 'غير محدد'}</td>
					<td class="px-6 py-4">{guest.age ?? 'غير محدد'}</td>
					<td class="px-6 py-4">{guest.phone ?? 'غير محدد'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if showAddModal}
	<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
		<div class="bg-white p-6 rounded shadow-lg w-full max-w-md">
			<h2 class="text-xl mb-4 font-bold text-center">إضافة مريض جديد</h2>
			<form on:submit|preventDefault={addGuest}>
				<div class="mb-3">
					<label class="block mb-1 font-semibold">الاسم <span class="text-red-500">*</span></label>
					<input
						class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
						bind:value={newGuest.name}
					/>
					{#if errors.name}<div class="text-red-500 text-sm mt-1">{errors.name}</div>{/if}
				</div>
				<div class="mb-3">
					<label class="block mb-1 font-semibold"
						>الرقم المدني <span class="text-red-500">*</span></label
					>
					<input
						class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
						bind:value={newGuest.nationalId}
						maxlength="20"
					/>
					{#if errors.nationalId}<div class="text-red-500 text-sm mt-1">
							{errors.nationalId}
						</div>{/if}
				</div>
				<div class="mb-3">
					<label class="block mb-1 font-semibold">العمر <span class="text-red-500">*</span></label>
					<input
						class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
						bind:value={newGuest.age}
						type="number"
						min="0"
					/>
					{#if errors.age}<div class="text-red-500 text-sm mt-1">{errors.age}</div>{/if}
				</div>
				<div class="mb-3">
					<label class="block mb-1 font-semibold">الهاتف <span class="text-red-500">*</span></label>
					<input
						class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
						bind:value={newGuest.phone}
						maxlength="10"
					/>
					{#if errors.phone}<div class="text-red-500 text-sm mt-1">{errors.phone}</div>{/if}
				</div>
				<div class="mb-3">
					<label class="block mb-1 font-semibold">ملاحظات</label>
					<input
						class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
						bind:value={newGuest.notes}
					/>
				</div>
				<div class="flex gap-2 mt-4 justify-center">
					<button
						type="submit"
						class="cursor-pointer bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition font-semibold"
						disabled={addSubmitting}
					>
						{#if addSubmitting}جاري الحفظ...{:else}حفظ{/if}
					</button>
					<button
						type="button"
						class="cursor-pointer bg-gray-300 px-6 py-2 rounded hover:bg-gray-400 transition"
						on:click={() => {
							showAddModal = false;
							errors = {};
						}}
					>
						إلغاء
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if showGuestModal && selectedGuest}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-fadeIn">
			<!-- Close Icon -->
			<button
				class="cursor-pointer absolute top-1 left-5 text-gray-400 hover:text-gray-700 text-6xl"
				on:click={closeModal}
				aria-label="إغلاق">&times;</button
			>

			{#if !editMode}
				<h2 class="text-2xl font-bold mb-6 text-center text-green-700">بيانات المريض</h2>
				<div class="space-y-3 text-lg">
					<div><span class="font-semibold text-gray-700">الاسم:</span> {selectedGuest.name}</div>
					<div>
						<span class="font-semibold text-gray-700">الرقم المدني:</span>
						{selectedGuest.nationalId}
					</div>
					<div><span class="font-semibold text-gray-700">العمر:</span> {selectedGuest.age}</div>
					<div><span class="font-semibold text-gray-700">الهاتف:</span> {selectedGuest.phone}</div>
					<div>
						<span class="font-semibold text-gray-700">ملاحظات:</span>
						{selectedGuest.notes && selectedGuest.notes.trim() !== ''
							? selectedGuest.notes
							: 'لا يوجد'}
					</div>
				</div>
				<div class="mb-3">
					<b>التشخيصات:</b>
					{#if selectedGuest.diagnoses && selectedGuest.diagnoses.length > 0}
						<ul class="list-disc pr-5 mt-2 space-y-1 text-right">
							{#each selectedGuest.diagnoses as diag}
								<li>
									<span>{diag.date} - {diag.text}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<span class="text-gray-500">لا يوجد تشخيصات</span>
					{/if}
				</div>
				<div class="flex gap-2 mt-8 justify-center">
					<button
						type="button"
						class="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
						on:click={() => {
							editMode = true;
						}}
					>
						تعديل
					</button>
					<button
						type="button"
						class="cursor-pointer bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
						on:click={deleteGuest}
						disabled={deleteSubmitting}
					>
						{#if deleteSubmitting}جاري الحذف...{:else}حذف{/if}
					</button>
					<button
						type="button"
						class="cursor-pointer bg-gray-300 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
						on:click={closeModal}
					>
						إلغاء
					</button>
				</div>
			{:else}
				<h2 class="text-2xl font-bold mb-6 text-center text-green-700">تعديل بيانات المريض</h2>
				<form on:submit|preventDefault={saveEditGuest} class="space-y-4">
					<div>
						<label class="block mb-1 font-semibold">الاسم <span class="text-red-500">*</span></label
						>
						<input
							class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
							bind:value={editGuest.name}
						/>
						{#if errors.name}<div class="text-red-500 text-sm mt-1">{errors.name}</div>{/if}
					</div>
					<div>
						<label class="block mb-1 font-semibold"
							>الرقم المدني <span class="text-red-500">*</span></label
						>
						<input
							class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
							bind:value={editGuest.nationalId}
							maxlength="20"
						/>
						{#if errors.nationalId}<div class="text-red-500 text-sm mt-1">
								{errors.nationalId}
							</div>{/if}
					</div>
					<div>
						<label class="block mb-1 font-semibold">العمر <span class="text-red-500">*</span></label
						>
						<input
							class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
							bind:value={editGuest.age}
							type="number"
							min="0"
						/>
						{#if errors.age}<div class="text-red-500 text-sm mt-1">{errors.age}</div>{/if}
					</div>
					<div>
						<label class="block mb-1 font-semibold"
							>الهاتف <span class="text-red-500">*</span></label
						>
						<input
							class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
							bind:value={editGuest.phone}
							maxlength="10"
						/>
						{#if errors.phone}<div class="text-red-500 text-sm mt-1">{errors.phone}</div>{/if}
					</div>
					<div>
						<label class="block mb-1 font-semibold">ملاحظات</label>
						<input
							class="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-600"
							bind:value={editGuest.notes}
						/>
					</div>
					<div>
						<label class="block mb-1 font-semibold">التشخيصات</label>
						<ul class="mb-2">
							{#each editGuest.diagnoses ?? [] as diag, i}
								<li class="flex items-center gap-2 mb-1">
									<span>{diag.date} - {diag.text}</span>
									<button
										type="button"
										class="cursor-pointer bg-red-600 text-white px-1 rounded"
										on:click={() => {
											editGuest.diagnoses = editGuest.diagnoses.filter((_, idx) => idx !== i);
										}}>حذف</button
									>
								</li>
							{/each}
						</ul>
						<div class="flex gap-2">
							<input
								class="w-full border p-2 rounded"
								bind:value={newDiagnosis}
								placeholder="أدخل التشخيص الجديد"
							/>
							<button
								type="button"
								class="cursor-pointer bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
								on:click={() => {
									if (!editGuest.diagnoses) editGuest.diagnoses = [];
									if (newDiagnosis.trim()) {
										editGuest.diagnoses = [
											...editGuest.diagnoses,
											{ date: new Date().toLocaleDateString('ar-EG'), text: newDiagnosis }
										];
										newDiagnosis = '';
									}
								}}
							>
								إضافة تشخيص
							</button>
						</div>
					</div>
					<div class="flex gap-2 mt-6 justify-center">
						<button
							type="submit"
							class="cursor-pointer bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
							disabled={editSubmitting}
						>
							{#if editSubmitting}جاري الحفظ...{:else}حفظ التعديلات{/if}
						</button>
						<button
							type="button"
							class="cursor-pointer bg-gray-300 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
							on:click={() => {
								editMode = false;
								errors = {};
							}}
						>
							إلغاء
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fadeIn {
		animation: fadeIn 0.25s;
	}
</style>
