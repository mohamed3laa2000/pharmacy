<script>
	import { auth } from '$lib/firebase';
	import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import { userLocation } from '$lib/store/dataStore';
	import { db } from '$lib/firebase';
	import { getDoc, doc, query, collection, where, getDocs } from 'firebase/firestore';
	import { get } from 'svelte/store';
	import { userStore } from '$lib/store/userStore';

	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	async function setUserPharmacyLocation(userId) {
		try {
			const userDoc = await getDoc(doc(db, 'Users', userId));
			if (userDoc.exists()) {
				const userData = userDoc.data();
				userLocation.set(userData || null);
			} else {
				userLocation.set(null);
			}
		} catch (err) {
			console.error('Error fetching user pharmacy location:', err);
			userLocation.set(null);
		}
	}

	async function login() {
		error = '';
		loading = true;
		const authInstance = getAuth();
		try {
			// Try Firebase Auth (for admin/pharmacy admin)
			const cred = await signInWithEmailAndPassword(authInstance, email, password);
			const user = cred.user;
			if (!user || !user.uid) {
				error = 'تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى.';
				return;
			}
			const userId = user.uid;
			await setUserPharmacyLocation(userId);
			const userDoc = await getDoc(doc(db, 'Users', userId));
			if (userDoc.exists()) {
				const userData = userDoc.data();
				userStore.set({
					uid: userId,
					displayName: userData.displayName,
					email: userData.email,
					role: userData.role
				});
				if (userData.role === 'admin') {
					goto('/admin');
				} else if (userData.role === 'staff') {
					goto('/request');
				} else {
					goto('/dashboard');
				}
			} else {
				error = 'تعذر العثور على بيانات المستخدم.';
				goto('/dashboard');
			}
		} catch (err) {
			console.error('Firebase Auth error:', err);
			// If Auth fails, try Firestore for staff
			try {
				const q = query(
					collection(db, 'Users'),
					where('email', '==', email),
					where('password', '==', password),
					where('role', '==', 'staff')
				);
				const snap = await getDocs(q);
				if (snap.empty) {
					error = 'بيانات الدخول غير صحيحة';
					return;
				}
				const userDoc = snap.docs[0];
				const user = userDoc.data();
				if (!user) {
					error = 'تعذر العثور على بيانات المستخدم.';
					return;
				}
				userStore.set({
					uid: userDoc.id,
					displayName: user.name,
					email: user.email,
					role: user.role,
					pharmacyId: user.pharmacyId,
					staffId: user.staffId
				});
				goto('/request');
			} catch (err2) {
				console.error('Firestore staff login error:', err2);
				error = 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.';
			}
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8"
	style="margin-top: -60px;"
>
	<div class="sm:mx-auto sm:w-full sm:max-w-sm">
		<img class="mx-auto w-120" src="logo-short.svg" alt="Your Company" />
		<h2 class="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-900">
			تسجيل الدخول
		</h2>
	</div>

	<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
		<form class="space-y-6" action="#" method="POST">
			<div>
				<label for="email" class="block text-sm/6 font-3xl text-gray-900">البريد الالكتروني</label>
				<div class="mt-2">
					<input
						type="email"
						placeholder="Email"
						bind:value={email}
						required
						name="email"
						id="email"
						autocomplete="email"
						class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
					/>
				</div>
			</div>

			<div>
				<div class="flex items-center justify-between">
					<label for="password" class="block text-sm/6 font-3xl text-gray-900">الرقم السري</label>
				</div>
				<div class="mt-2">
					<input
						type="password"
						placeholder="Password"
						bind:value={password}
						name="password"
						id="password"
						autocomplete="current-password"
						required
						class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
					/>
				</div>
			</div>
			<div>
				<button
					on:click|preventDefault={login}
					disabled={loading}
					type="submit"
					class="cursor-pointer flex w-full justify-center rounded-md bg-(--green_dark) px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-(--green_dark)/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>{#if loading}
						جاري تسجيل الدخول...
					{:else}
						تسجيل الدخول
					{/if}</button
				>
			</div>
			{#if error}
				<p
					style="color: red;"
					class="text-center
"
				>
					الرقم السري غير صحيح
				</p>
			{/if}
		</form>
	</div>
</div>
