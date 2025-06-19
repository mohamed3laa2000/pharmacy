<script>
	import { onMount, onDestroy } from 'svelte';
	import { auth } from '$lib/firebase';
	import { fetchMedicines, fetchStaff, fetchBatchesForMedicine } from '$lib/api/fetchdata.js';
	import { medicines, requests, staff, userLocation } from '$lib/store/dataStore';
	import { userStore } from '$lib/store/userStore';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { collection, onSnapshot, query } from 'firebase/firestore';
	import { db } from '$lib/firebase';

	// Phosphor icons
	import {
		ChartBar,
		ClipboardText,
		Archive,
		Pill,
		ShieldCheck,
		FileText,
		Receipt,
		Package,
		Skull,
		Users,
		ArrowsLeftRight,
		IdentificationBadge,
		List
	} from 'phosphor-svelte';

	let loading = true;
	let unsubscribeRequests;
	let sidebarOpen = true;

	// Only load data if user is authenticated and userLocation is set
	$: if ($userStore.uid && $userLocation && $userLocation.pharmacyId && loading) {
		loadData();
	}

	// Redirect to login if not authenticated
	$: if (!$userStore.uid && !loading) {
		goto('/login');
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

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}
</script>

<nav class="fixed h-16 top-0 z-50 w-full bg-(--green_dark) dark0:bg-gray-800 dark0:border-gray-700">
	<div class="px-3 py-3 lg:px-5 lg:pl-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center justify-start rtl:justify-end">
				<a href="/dashboard" class="flex ms-2 md:me-24">
					<img src="/logo.svg" class="h-14 me-3" alt="" />
				</a>
			</div>
			<!-- Sidebar toggle button -->
			<button
				class="block md:hidden text-white focus:outline-none"
				on:click={toggleSidebar}
				aria-label="Toggle sidebar"
			>
				<List size={28} />
			</button>
		</div>
	</div>
</nav>

<aside
	id="logo-sidebar"
	class="fixed top-0 right-0 z-40 w-64 h-screen pt-20 bg-(--green_dark) transition-transform duration-200 ease-in-out
		{sidebarOpen
		? 'translate-x-0'
		: 'translate-x-full'} sm:translate-x-0 dark0:bg-gray-800 dark0:border-gray-700"
	aria-label="Sidebar"
>
	<div class="h-auto px-3 pb-4 overflow-y-auto bg-(--green_dark) dark0:bg-gray-800">
		<h3 class="text-white text-center pb-4 text-xl">
			صيدلية مركز التأهيل الشامل ب<span>{$userLocation?.location}</span>
		</h3>
		<ul class="space-y-2 font-medium">
			<li>
				<a
					href="/dashboard"
					class="{$page.url.pathname === '/dashboard'
						? 'bg-(--green_light)/30'
						: ''} text-white flex items-center p-2 mb-3 rounded-lg hover:bg-(--green_light)/30 group"
				>
					<ChartBar size={24} class="mr-2" />
					<span class="ms-3">الاحصائيات</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/requests"
					class="{$page.url.pathname === '/dashboard/requests'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<ClipboardText size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">الطلبيات</span>
					<span
						class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-blue-800 bg-blue-100 rounded-full"
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
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<Archive size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">المخزون</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/psychic"
					class="{$page.url.pathname === '/dashboard/psychic'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<Pill size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">المؤثرات العقلية</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/supervision"
					class="{$page.url.pathname === '/dashboard/supervision'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<ShieldCheck size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">الأدوية الخاضعة للرقابة</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/interior"
					class="{$page.url.pathname === '/dashboard/interior'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<FileText size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">أدوية الوصفات الداخلية</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/recipe"
					class="{$page.url.pathname === '/dashboard/recipe'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<Receipt size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">أدوية وصفتي</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/supplies"
					class="{$page.url.pathname === '/dashboard/supplies'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<Package size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">المستلزمات الطبية</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/expiry"
					class="{$page.url.pathname === '/dashboard/expiry'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<Skull size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">الأدوية منتهية الصلاحية</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/staff"
					class="{$page.url.pathname === '/dashboard/staff'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<Users size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">الدكتور / الممرض</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/exchange"
					class="{$page.url.pathname === '/dashboard/exchange'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<ArrowsLeftRight size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">التبادل</span>
				</a>
			</li>
			<li>
				<a
					href="/dashboard/guests"
					class="{$page.url.pathname === '/dashboard/guests'
						? 'bg-(--green_light)/30'
						: ''} flex items-center p-2 mb-3 text-white rounded-lg hover:bg-(--green_light)/30 group"
				>
					<IdentificationBadge size={24} class="mr-2" />
					<span class="flex-1 ms-3 whitespace-nowrap">النزلاء</span>
				</a>
			</li>
		</ul>
		<div class="mt-15 flex flex-col-reverse items-center justify-center">
			<div class=" flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
				<button
					on:click={logout}
					type="button"
					class="cursor-pointer text-white bg-(--green_light) hover:bg-(--green_light)/80 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 text-center"
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

<style>
	@media (max-width: 768px) {
		#logo-sidebar {
			transform: translateX(100%);
		}
		#logo-sidebar.translate-x-0 {
			transform: translateX(0);
		}
	}
</style>
