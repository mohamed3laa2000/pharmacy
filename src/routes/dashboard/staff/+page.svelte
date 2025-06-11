<script>
	import { onMount } from 'svelte';
	import { collection, doc, addDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { get } from 'svelte/store';
	import { userLocation } from '$lib/store/dataStore';

	let staff = [];
	let showModal = false;
	let selectedStaff = null;
	let showAddStaffModal = false;
	let showEditStaffModal = false;
	let newStaff = { name: '', role: '', phone: '', email: '', password: '' };
	let editStaff = { id: '', name: '', role: '', phone: '', email: '', password: '' };
	let isSubmitting = false;

	async function loadStaff() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) return;
		const staffCol = collection(db, 'Pharmacies', location.pharmacyId, 'staff');
		const snapshot = await getDocs(staffCol);
		staff = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
	}

	onMount(loadStaff);

	function openModal(member) {
		selectedStaff = member;
		showModal = true;
	}

	function openEditModal(member) {
		editStaff = { ...member }; // id, name, role, phone, email, password
		showEditStaffModal = true;
	}

	async function addStaff() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}
		if (
			!newStaff.name.trim() ||
			!newStaff.role ||
			!newStaff.phone.trim() ||
			!newStaff.email.trim() ||
			!newStaff.password.trim()
		) {
			alert('يرجى ملء جميع الحقول المطلوبة');
			return;
		}
		isSubmitting = true;
		const staffData = {
			name: newStaff.name,
			role: newStaff.role,
			phone: newStaff.phone,
			email: newStaff.email,
			password: newStaff.password
		};
		await addDoc(collection(db, 'Pharmacies', location.pharmacyId, 'staff'), staffData);
		newStaff = { name: '', role: '', phone: '', email: '', password: '' };
		showAddStaffModal = false;
		isSubmitting = false;
		await loadStaff();
	}

	async function updateStaff() {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}
		if (
			!editStaff.name.trim() ||
			!editStaff.role ||
			!editStaff.phone.trim() ||
			!editStaff.email.trim() ||
			!editStaff.password.trim()
		) {
			alert('يرجى ملء جميع الحقول المطلوبة');
			return;
		}
		isSubmitting = true;
		const staffRef = doc(db, 'Pharmacies', location.pharmacyId, 'staff', editStaff.id);
		await updateDoc(staffRef, {
			name: editStaff.name,
			role: editStaff.role,
			phone: editStaff.phone,
			email: editStaff.email,
			password: editStaff.password
		});
		showEditStaffModal = false;
		showModal = false;
		isSubmitting = false;
		await loadStaff();
	}

	async function deleteStaff(id) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}
		if (confirm('هل أنت متأكد من أنك تريد حذف هذا العضو؟')) {
			await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'staff', id));
			showModal = false;
			await loadStaff();
		}
	}
</script>

<!-- Add Staff Button -->
<div class="flex mb-5">
	<button
		on:click={() => (showAddStaffModal = true)}
		class="w-32 py-2 cursor-pointer bg-(--green_lighter) text-white rounded hover:bg-green-700"
	>
		إضافة عضو
	</button>
</div>

<!-- Staff Table -->
<div class="relative overflow-x-auto">
	<table class="w-full text-lg text-center rtl:text-right text-gray-500 dark:text-gray-400">
		<thead class="text-3xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
			<tr>
				<th class="px-6 py-3">الاسم</th>
				<th class="px-6 py-3">الدور</th>
				<th class="px-6 py-3">الهاتف</th>
				<th class="px-6 py-3">البريد الإلكتروني</th>
			</tr>
		</thead>
		<tbody>
			{#each staff as member}
				<tr
					on:click={() => openModal(member)}
					class="hover:bg-black/10 cursor-pointer bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200"
				>
					<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
						{member.name}
					</td>
					<td class="px-6 py-4">{member.role === 'doctor' ? 'دكتور' : 'ممرض'}</td>
					<td class="px-6 py-4">{member.phone ?? 'غير متاح'}</td>
					<td class="px-6 py-4">{member.email ?? 'غير متاح'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Staff Detail Modal -->
{#if showModal && selectedStaff}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[400px]">
            <h2 class="text-2xl font-bold mb-4">{selectedStaff.name}</h2>
            <p class="mb-2">الدور: {selectedStaff.role === 'doctor' ? 'دكتور' : 'ممرض'}</p>
            <p class="mb-2">الهاتف: {selectedStaff.phone ?? 'غير متاح'}</p>
            <p class="mb-2">البريد الإلكتروني: {selectedStaff.email ?? 'غير متاح'}</p>
            <p class="mb-2">كلمة المرور: {selectedStaff.password ?? 'غير متاح'}</p>
            <div class="flex justify-end space-x-4 mt-6">
                <button
                    on:click={() => openEditModal(selectedStaff)}
                    class="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    تعديل
                </button>
                <button
                    on:click={() => deleteStaff(selectedStaff.id)}
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

<!-- Edit Staff Modal -->
{#if showEditStaffModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[400px]">
            <h2 class="text-xl font-bold mb-4">تعديل بيانات العضو</h2>
            <form on:submit|preventDefault={updateStaff}>
                <input
                    type="text"
                    bind:value={editStaff.name}
                    placeholder="اسم العضو"
                    required
                    class="w-full p-2 mb-2 border rounded"
                />
                <select
                    bind:value={editStaff.role}
                    required
                    class="w-full p-2 mb-2 border rounded cursor-pointer"
                >
                    <option value="">اختر الدور</option>
                    <option value="doctor">دكتور</option>
                    <option value="nurse">ممرض</option>
                </select>
                <input
                    type="text"
                    bind:value={editStaff.phone}
                    placeholder="رقم الهاتف"
                    required
                    class="w-full p-2 mb-2 border rounded"
                />
                <input
                    type="email"
                    bind:value={editStaff.email}
                    placeholder="البريد الإلكتروني"
                    required
                    class="w-full p-2 mb-2 border rounded"
                />
                <input
                    type="text"
                    bind:value={editStaff.password}
                    placeholder="كلمة المرور"
                    required
                    class="w-full p-2 mb-4 border rounded"
                />
                <div class="flex justify-end space-x-4">
                    <button
                        disabled={isSubmitting}
                        type="submit"
                        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer"
                    >
                        {#if isSubmitting}
                            <span>جاري الحفظ...</span>
                        {:else}
                            <span>حفظ</span>
                        {/if}
                    </button>
                    <button
                        type="button"
                        on:click={() => (showEditStaffModal = false)}
                        class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 cursor-pointer"
                    >
                        إغلاق
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Add Staff Modal -->
{#if showAddStaffModal}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[400px]">
            <h2 class="text-xl font-bold mb-4">إضافة عضو جديد</h2>
            <form on:submit|preventDefault={addStaff}>
                <input
                    type="text"
                    bind:value={newStaff.name}
                    placeholder="اسم العضو"
                    required
                    class="w-full p-2 mb-2 border rounded"
                />
                <select
                    bind:value={newStaff.role}
                    required
                    class="w-full p-2 mb-2 border rounded cursor-pointer"
                >
                    <option value="">اختر الدور</option>
                    <option value="doctor">دكتور</option>
                    <option value="nurse">ممرض</option>
                </select>
                <input
                    type="text"
                    bind:value={newStaff.phone}
                    placeholder="رقم الهاتف"
                    required
                    class="w-full p-2 mb-2 border rounded"
                />
                <input
                    type="email"
                    bind:value={newStaff.email}
                    placeholder="البريد الإلكتروني"
                    required
                    class="w-full p-2 mb-2 border rounded"
                />
                <input
                    type="text"
                    bind:value={newStaff.password}
                    placeholder="كلمة المرور"
                    required
                    class="w-full p-2 mb-4 border rounded"
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
                        type="button"
                        on:click={() => (showAddStaffModal = false)}
                        class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 cursor-pointer"
                    >
                        إغلاق
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
