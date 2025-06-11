<script>
	import { auth } from '$lib/firebase'; // Adjust the path to your firebase.js
	import { signInWithEmailAndPassword } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import { userLocation } from '$lib/store/dataStore';
	import { db } from '$lib/firebase';
	import { getDoc, doc } from 'firebase/firestore';
	import { get } from 'svelte/store';

	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	async function setUserPharmacyLocation(userId) {
		// Assuming you store user's assigned pharmacy ID under users collection
		const userDoc = await getDoc(doc(db, 'Users', userId));
		if (userDoc.exists()) {
			const userData = userDoc.data();
			// e.g., userData.pharmacyId is the assigned pharmacy
			userLocation.set(userData || null);
			console.log(get(userLocation));
		} else {
			userLocation.set(null);
		}
	}

	async function login() {
		error = '';
		loading = true;
		try {
			const userCredential = await signInWithEmailAndPassword(auth, email, password);
			const userId = userCredential.user.uid;
			// console.log('User ID:', userId);
			await setUserPharmacyLocation(userId); // set the pharmacy location store
			goto('/dashboard'); // Redirect to the dashboard after successful login
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<!-- <h1 class="text-3xl font-extrabold"> تسجيل الدخول </h1> -->

<!-- <input
    type="email"
    placeholder="Email"
    bind:value={email}
    required
    /> -->

<!-- <input
  type="password"
  placeholder="Password"
  bind:value={password}
    required
    /> -->

<!-- <button on:click={login} disabled={loading}>
    {#if loading} جاري تسجيل الدخول... {:else} تسجيل الدخول {/if}
    </button> -->

<!--
      This example requires updating your template:
      
      ```
      <html class="h-full bg-white">
        <body class="h-full">
          ```
          -->
<div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
	<div class="sm:mx-auto sm:w-full sm:max-w-sm">
		<!-- <img class="mx-auto w20 w-auto" src="logo-short.svg" alt="Your Company"> -->
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
