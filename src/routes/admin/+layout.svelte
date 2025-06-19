<script>
	import { onMount, onDestroy } from 'svelte';
	import { auth } from '$lib/firebase';
	import { fetchMedicines, fetchStaff, fetchBatchesForMedicine } from '$lib/api/fetchdata.js';
	import { medicines, requests, staff, userLocation } from '$lib/store/dataStore';
	import { goto } from '$app/navigation';
	import { collection, onSnapshot, query } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { page } from '$app/stores';

	// Phosphor icons
	import {
		ChartBar,
		Archive,
		ClipboardText,
		ArrowsLeftRight,
		IdentificationBadge
	} from 'phosphor-svelte';

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

<nav class="fixed h-16 top-0 z-50 w-full bg-(--green_dark)">
	<div class="px-3 py-3 lg:px-5 lg:pl-3 flex items-center justify-between">
		<a href="/admin" class="flex ms-2 md:me-24">
			<img src="/logo.svg" class="h-14 me-3" alt="" />
		</a>
	</div>
</nav>

<aside
	id="logo-sidebar"
	class="fixed top-0 right-0 z-40 w-64 h-screen pt-20 bg-(--green_dark)"
	aria-label="Sidebar"
>
	<div class="h-auto px-3 pb-4 overflow-y-auto">
		<h3 class="text-white text-center pb-4 text-xl">لوحة تحكم المدير</h3>
		<ul class="space-y-2 font-medium">
			<li>
				<a
					href="/admin"
					class="{$page.url.pathname === '/admin'
						? 'bg-(--green_light)/30'
						: ''} text-white flex items-center p-2 mb-3 rounded-lg dark0:text-white hover:bg-(--green_light)/30 dark0:hover:bg-gray-700 group"
				>
					<ChartBar size={24} class="mr-2" />
					<span class="ms-3">الاحصائيات</span>
				</a>
			</li>
			<li>
				<a
					href="/admin/inventory"
					class="{$page.url.pathname === '/admin/inventory'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark0:text-white hover:bg-(--green_light)/30 dark0:hover:bg-gray-700 group"
				>
					<Archive size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">المخزون</span>
				</a>
			</li>
			<li>
				<a
					href="/admin/requests"
					class="{$page.url.pathname === '/admin/requests'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark0:text-white hover:bg-(--green_light)/30 dark0:hover:bg-gray-700 group"
				>
					<ClipboardText size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">الطلبيات</span>
				</a>
			</li>
			<li>
				<a
					href="/admin/exchange"
					class="{$page.url.pathname === '/admin/exchange'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark0:text-white hover:bg-(--green_light)/30 dark0:hover:bg-gray-700 group"
				>
					<ArrowsLeftRight size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">التبادل</span>
				</a>
			</li>
			<li>
				<a
					href="/admin/guests"
					class="{$page.url.pathname === '/admin/guests'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg dark0:text-white hover:bg-(--green_light)/30 dark0:hover:bg-gray-700 group"
				>
					<IdentificationBadge size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">النزلاء</span>
				</a>
			</li>
		</ul>
		<div class="h-80 flex flex-col-reverse items-center justify-center">
			<div class=" flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
				<button
					on:click={logout}
					type="button"
					class="cursor-pointer text-white bg-(--green_light) hover:bg-(--green_light)/80 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-center dark0:bg-blue-600 dark0:hover:bg-blue-700 dark0:focus:ring-blue-800"
					>تسجيل الخروج</button
				>
			</div>
		</div>
	</div>
</aside>

<div class="p-2 mt-19 mr-67 bg-(--grey)/8 m-3 rounded-lg" style="margin-right: 17rem;">
	<slot />
</div>
