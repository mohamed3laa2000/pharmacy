<script>
	import { onMount, onDestroy } from 'svelte';
	import { auth } from '$lib/firebase';
	import { fetchMedicines, fetchStaff, fetchBatchesForMedicine } from '$lib/api/fetchdata.js';
	import { medicines, requests, staff, userLocation } from '$lib/store/dataStore';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { collection, onSnapshot, query } from 'firebase/firestore';
	import { db } from '$lib/firebase';

	let loading = true;
	let unsubscribeRequests;

	$: if ($userLocation && $userLocation.pharmacyId && loading) {
		loadData();
	}

	async function loadData() {
		loading = true;
		const meds = await fetchMedicines();
		for (const med of meds) {
			med.batches = await fetchBatchesForMedicine(med.id);
		}
		medicines.set(meds);
		staff.set(await fetchStaff());

		// Real-time requests subscription
		if (unsubscribeRequests) unsubscribeRequests();
		const q = query(collection(db, 'Pharmacies', $userLocation.pharmacyId, 'requests'));
		unsubscribeRequests = onSnapshot(q, (snapshot) => {
			const reqs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
			requests.set(reqs);
		});

		loading = false;
	}

	onDestroy(() => {
		if (unsubscribeRequests) unsubscribeRequests();
	});

	async function logout() {
		await auth.signOut();
		goto('/login');
	}
</script>

<nav class="fixed h-16 top-0 z-50 w-full bg-(--green_dark) dark:bg-gray-800 dark:border-gray-700">
	<div class="px-3 py-3 lg:px-5 lg:pl-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center justify-start rtl:justify-end">
				<a href="/dashboard" class="flex ms-2 md:me-24">
					<img src="/logo.svg" class="h-14 me-3" alt="" />
				</a>
			</div>
		</div>
	</div>
</nav>

<aside
	id="logo-sidebar"
	class="fixed top-0 right-0 z-40 w-64 h-screen pt-20 bg-(--green_dark) sm:translate-x-0 dark:bg-gray-800 dark:border-gray-700"
	aria-label="Sidebar"
>
	<div class="h-auto px-3 pb-4 overflow-y-auto bg-(--green_dark) dark:bg-gray-800">
		<h3 class="text-white text-center pb-4 text-xl">
			صيدلية مركز التأهيل الشامل ب<span>{$userLocation?.location}</span>
		</h3>
		<ul class="space-y-2 font-medium">
			<li>
				<a
					href="/dashboard"
					class="{$page.url.pathname === '/dashboard'
						? 'bg-(--green_light)/30'
						: ''} text-white flex items-center p-2 mb-3 rounded-lg dark:text-white hover:bg-(--green_light)/30 dark:hover:bg-gray-700 group"
				>
					<svg
						class="w-5 h-5 text-white transition duration-75 dark:text-gray-400 dark:group-hover:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						viewBox="0 0 22 21"
					>
						<path
							d="M16.975 11H10V4.025a1 1 0 0 0-1.066-.998 8.5 8.5 0 1 0 9.039 9.039.999.999 0 0 0-1-1.066h.002Z"
						/>
						<path
							d="M12.5 0c-.157 0-.311.01-.565.027A1 1 0 0 0 11 1.02V10h8.975a1 1 0 0 0 1-.935c.013-.188.028-.374.028-.565A8.51 8.51 0 0 0 12.5 0Z"
						/>
					</svg>
					<span class="ms-3">الاحصائيات</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/requests"
					class="{$page.url.pathname === '/dashboard/requests'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark:text-white hover:bg-(--green_light)/30 dark:hover:bg-gray-700 group"
				>
					<svg
						class="w-6 h-6 text-white dark:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							d="M15.133 10.632v-1.8a5.407 5.407 0 0 0-4.154-5.262.955.955 0 0 0 .021-.106V1.1a1 1 0 0 0-2 0v2.364a.944.944 0 0 0 .021.106 5.406 5.406 0 0 0-4.154 5.262v1.8C4.867 13.018 3 13.614 3 14.807 3 15.4 3 16 3.538 16h12.924C17 16 17 15.4 17 14.807c0-1.193-1.867-1.789-1.867-4.175Zm-13.267-.8a1 1 0 0 1-1-1 9.424 9.424 0 0 1 2.517-6.39A1.001 1.001 0 1 1 4.854 3.8a7.431 7.431 0 0 0-1.988 5.037 1 1 0 0 1-1 .995Zm16.268 0a1 1 0 0 1-1-1A7.431 7.431 0 0 0 15.146 3.8a1 1 0 0 1 1.471-1.354 9.425 9.425 0 0 1 2.517 6.391 1 1 0 0 1-1 .995ZM6.823 17a3.453 3.453 0 0 0 6.354 0H6.823Z"
						/>
					</svg>
					<span class="flex-1 ms-3 whitespace-nowrap">الطلبيات</span>
					<span
						class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-300"
					>
						{$requests.filter((r) => r.status === 'pending').length}
					</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/inventory"
					class="{$page.url.pathname === '/dashboard/inventory'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark:text-white hover:bg-(--green_light)/30 dark:hover:bg-gray-700 group"
				>
					<svg
						class="w-6 h-6 text-white dark:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						viewBox="0 0 20 16"
					>
						<path
							d="M19 0H1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1ZM2 6v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6H2Zm11 3a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 2 0h2a1 1 0 0 1 2 0v1Z"
						/>
					</svg>
					<span class="flex-1 ms-3 whitespace-nowrap">المخزون</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/staff"
					class="{$page.url.pathname === '/dashboard/staff'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark:text-white hover:bg-(--green_light)/30 dark:hover:bg-gray-700 group"
				>
					<svg
						class="shrink-0 w-5 h-5 text-white transition duration-75 dark:text-gray-400 dark:group-hover:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						viewBox="0 0 20 18"
					>
						<path
							d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z"
						/>
					</svg>
					<span class="flex-1 ms-3 whitespace-nowrap">الدكتور / الممرض</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/exchange"
					class="{$page.url.pathname === '/dashboard/exchange'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark:text-white hover:bg-(--green_light)/30 dark:hover:bg-gray-700 group"
				>
					<svg
						class="w-6 h-6 text-white dark:text-white"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 20 18"
					>
						<path
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="m1 14 3-3m-3 3 3 3m-3-3h16v-3m2-7-3 3m3-3-3-3m3 3H3v3"
						/>
					</svg>
					<span class="flex-1 ms-3 whitespace-nowrap">التبادل</span>
				</a>
			</li>
		</ul>
		<div class="h-80 flex flex-col-reverse items-center justify-center">
			<div class=" flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
				<button
					on:click={logout}
					type="button"
					class="cursor-pointer text-white bg-(--green_light) hover:bg-(--green_light)/80 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
					>تسجيل الخروج</button
				>
			</div>
		</div>
	</div>
</aside>

{#if loading}
	<div class="flex h-150 justify-center items-center p-4 pt-16 mr-64">
		<h1 class="text-2xl">جاري تحميل البيانات...</h1>
	</div>
{:else}
	<div class="p-2 mt-19 mr-67 bg-(--grey)/8 m-3 rounded-lg">
		<slot />
	</div>
{/if}
