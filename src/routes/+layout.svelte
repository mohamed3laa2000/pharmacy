<script>
	import '../app.css';
	import { onAuthStateChanged } from 'firebase/auth';
	import { auth, db } from '$lib/firebase';
	import { onMount } from 'svelte';
	import { userLocation } from '$lib/store/dataStore';
	import { goto } from '$app/navigation';
	import { doc, getDoc } from 'firebase/firestore';
	import { get } from 'svelte/store';

	let user = null;

	onMount(() => {
		auth.onAuthStateChanged((u) => {
			user = u;
		});
	});

	async function logout() {
		await auth.signOut();
		goto('/login');
	}

	onMount(() => {
		auth.onAuthStateChanged((u) => {
			user = u;
			const path = window.location.pathname;

			if (!user && path !== '/login') {
				goto('/login');
			} else if (user && path === '/login') {
				goto('/dashboard'); // or wherever you want logged-in users to land
			}
		});
	});

	onAuthStateChanged(auth, async (user) => {
		if (user) {
			const userDoc = await getDoc(doc(db, 'Users', user.uid));
			if (userDoc.exists()) {
				userLocation.set(userDoc.data() || null);
			} else {
				userLocation.set(null);
			}
		} else {
			userLocation.set(null);
		}
	});
</script>

<header>
	<!-- optional fot the future -->
	<!-- <nav style="background-color: #0f3144;" class="bg-white dark:bg-gray-900 w-full z-20 top-0 start-0 border-b border-gray-200 dark:border-gray-600">
	<div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
	<a href="/" class="flex items-center space-x-3 rtl:space-x-reverse">
		<img src="/logo.svg" class="h-13" alt="Flowbite Logo">
	</a>

	{#if user}
	<div class="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
		<button on:click={logout} type="button" class="cursor-pointer text-white bg-(--green_light) hover:bg-(--green_light)/80 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">تسجيل الخروج</button>
	</div>
	{/if}

	</div>
  </nav> -->
</header>

<slot></slot>
