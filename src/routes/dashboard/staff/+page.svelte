<script>
	import { onMount } from 'svelte';
	import { collection, doc, addDoc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { get } from 'svelte/store';
	import { userLocation } from '$lib/store/dataStore';
	import {
		getAuth,
		createUserWithEmailAndPassword,
		deleteUser,
		signInWithEmailAndPassword
	} from 'firebase/auth';

	let staff = [];
	let showModal = false;
	let selectedStaff = null;
	let showAddStaffModal = false;
	let newStaff = { name: '', role: '', phone: '', email: '', password: '' };
	let isSubmitting = false;
	let emailError = '';
	let passwordError = '';

	function isValidEmail(email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	$: emailError =
		newStaff.email && !isValidEmail(newStaff.email) ? 'يرجى إدخال بريد إلكتروني صحيح' : '';

	$: passwordError =
		newStaff.password && newStaff.password.length < 6
			? 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر'
			: '';

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
		try {
			// 1. Create user in Firebase Auth
			const auth = getAuth();
			const userCredential = await createUserWithEmailAndPassword(
				auth,
				newStaff.email,
				newStaff.password
			);
			const uid = userCredential.user.uid;

			const staffData = {
				name: newStaff.name,
				role: newStaff.role,
				phone: newStaff.phone,
				email: newStaff.email,
				password: newStaff.password // as requested
			};

			// 2. Add to pharmacy staff subcollection
			const staffDocRef = await addDoc(
				collection(db, 'Pharmacies', location.pharmacyId, 'staff'),
				staffData
			);

			// 3. Add to main Users collection
			await setDoc(doc(db, 'Users', uid), {
				...staffData,
				role: 'staff',
				pharmacyId: location.pharmacyId,
				staffId: staffDocRef.id
			});

			newStaff = { name: '', role: '', phone: '', email: '', password: '' };
			showAddStaffModal = false;
			isSubmitting = false;
			await loadStaff();
			alert('تمت إضافة العضو بنجاح');
		} catch (error) {
			console.error(error);
			alert('حدث خطأ أثناء إضافة العضو: ' + (error.message || error));
			isSubmitting = false;
		}
	}

	async function deleteStaff(id, email, password) {
		const location = get(userLocation);
		if (!location || !location.pharmacyId) {
			alert('لم يتم تحديد الصيدلية');
			return;
		}
		if (!confirm('هل أنت متأكد من أنك تريد حذف هذا العضو؟')) return;

		try {
			// 1. Find the user in Auth by signing in (since client SDK can't delete by email directly)
			const auth = getAuth();
			// Save current user to re-login after deletion
			const currentUser = auth.currentUser;

			// Sign in as the staff user to delete
			await signInWithEmailAndPassword(auth, email, password);
			if (auth.currentUser) {
				await deleteUser(auth.currentUser);
			}

			// Re-sign in as the original user (admin)
			if (currentUser && currentUser.email && currentUser.password) {
				await signInWithEmailAndPassword(auth, currentUser.email, currentUser.password);
			}
		} catch (e) {
			// If can't sign in as staff, skip Auth deletion
			console.warn('لم يتم حذف المستخدم من المصادقة (ربما تم حذفه بالفعل):', e.message);
		}

		// 2. Delete from pharmacy staff subcollection
		await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'staff', id));
		// 3. Delete from main Users collection
		await deleteDoc(doc(db, 'Users', id));
		showModal = false;
		await loadStaff();
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
	<table class="w-full text-lg text-center rtl:text-right text-gray-500 dark0:text-gray-400">
		<thead
			class="text-3xs text-gray-700 uppercase bg-gray-50 dark0:bg-gray-700 dark0:text-gray-400"
		>
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
					class="hover:bg-black/10 cursor-pointer bg-white border-b dark0:bg-gray-800 dark0:border-gray-700 border-gray-200"
				>
					<td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark0:text-white">
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
		<div class="bg-white dark0:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[400px]">
			<h2 class="text-2xl font-bold mb-4">{selectedStaff.name}</h2>
			<p class="mb-2">الدور: {selectedStaff.role === 'doctor' ? 'دكتور' : 'ممرض'}</p>
			<p class="mb-2">الهاتف: {selectedStaff.phone ?? 'غير متاح'}</p>
			<p class="mb-2">البريد الإلكتروني: {selectedStaff.email ?? 'غير متاح'}</p>
			<p class="mb-2">كلمة المرور: {selectedStaff.password ?? 'غير متاح'}</p>
			<div class="flex justify-end space-x-4 mt-6">
				<button
					on:click={() =>
						deleteStaff(selectedStaff.id, selectedStaff.email, selectedStaff.password)}
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

<!-- Add Staff Modal -->
{#if showAddStaffModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
		<div class="bg-white dark0:bg-gray-800 p-6 rounded-lg w-[90%] md:w-[400px]">
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
					class="w-full p-2 mb-1 border rounded"
				/>
				{#if emailError}
					<div class="text-red-600 text-xs mb-2">{emailError}</div>
				{/if}
				<input
					type="text"
					bind:value={newStaff.password}
					placeholder="كلمة المرور"
					required
					class="w-full p-2 mb-1 border rounded"
				/>
				{#if passwordError}
					<div class="text-red-600 text-xs mb-2">{passwordError}</div>
				{/if}
				<div class="flex justify-end space-x-4">
					<button
						disabled={isSubmitting || emailError || passwordError}
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
