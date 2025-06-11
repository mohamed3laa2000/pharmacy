<script>
	import { onMount, tick } from 'svelte';
	import Chart from 'chart.js/auto';
	import {
		fetchMedicines,
		fetchRequests,
		fetchStaff,
		fetchBatchesForMedicine,
		fetchAllBatches
	} from '$lib/api/fetchData';

	let medicines = [];
	let requests = [];
	let users = [];
	let allBatches = [];

	// Chart refs
	let statusChart, statusChartCanvas;
	let timeChart, timeChartCanvas;
	let topMedChart, topMedChartCanvas;
	let staffChart, staffChartCanvas;
	let stockCatChart, stockCatChartCanvas;
	let catChart, catChartCanvas;

	// Data for KPIs and tables
	let recentRequests = [];

	// Helper: Staff activity
	function getStaffActivity() {
		const staffIds = users.map((u) => u.id);
		const counts = staffIds.map((id) => requests.filter((r) => r.requestedBy === id).length);
		const labels = staffIds.map((id) => {
			const u = users.find((u) => u.id === id);
			return (u?.role === 'doctor' ? 'د.' : 'م.') + (u?.name || '');
		});
		return { labels, counts };
	}

	// Helper: Stock by category (for doughnut chart)
	function getStockByCategory() {
		const catTotals = {};
		for (const med of medicines) {
			const cat = med.category || 'غير مصنف';
			catTotals[cat] = (catTotals[cat] || 0) + (med.totalAvailable ?? 0);
		}
		return {
			labels: Object.keys(catTotals),
			counts: Object.values(catTotals)
		};
	}

	// Helper: Most requested categories
	function getMostRequestedCategories(topN = 5) {
		const catCounts = {};
		for (const req of requests) {
			for (const med of req.medicines || []) {
				const m = medicines.find((x) => x.id === med.medicineId);
				if (m) {
					const cat = m.category || 'غير مصنف';
					catCounts[cat] = (catCounts[cat] || 0) + 1;
				}
			}
		}
		const sorted = Object.entries(catCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, topN);
		return {
			labels: sorted.map(([cat]) => cat),
			counts: sorted.map(([, count]) => count)
		};
	}

	// Helper: Requests per day (last 14 days)
	function getRequestsOverTime() {
		const days = [];
		const counts = [];
		const now = new Date();
		for (let i = 13; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(now.getDate() - i);
			const label = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
			days.push(label);
			const count = requests.filter((r) => {
				const created = new Date(r.createdAt?.toDate ? r.createdAt.toDate() : r.createdAt);
				return created.toDateString() === d.toDateString();
			}).length;
			counts.push(count);
		}
		return { days, counts };
	}

	// Helper: Top requested medicines
	function getTopRequestedMedicines(topN = 5) {
		const medCounts = {};
		for (const req of requests) {
			for (const m of req.medicines || []) {
				medCounts[m.medicineId] = (medCounts[m.medicineId] || 0) + (parseInt(m.quantity) || 1);
			}
		}
		const sorted = Object.entries(medCounts)
			.map(([id, count]) => ({
				name: medicines.find((med) => med.id === id)?.name || 'غير معروف',
				count
			}))
			.sort((a, b) => b.count - a.count)
			.slice(0, topN);
		return {
			labels: sorted.map((x) => x.name),
			counts: sorted.map((x) => x.count)
		};
	}

	// Helper: Lowest stock medicines
	function getLowestStockMedicines(topN = 10) {
		return medicines
			.filter((m) => typeof m.totalAvailable === 'number')
			.sort((a, b) => a.totalAvailable - b.totalAvailable)
			.slice(0, topN);
	}

	// Helper: All medicines by stock
	function getAllMedicinesByStock() {
		return medicines.slice().sort((a, b) => (a.totalAvailable ?? 0) - (b.totalAvailable ?? 0));
	}

	// Helper: All medicines by expiry
	function getAllMedicinesByExpiry() {
		return medicines
			.filter((med) => med.expiryDate)
			.map((med) => ({
				name: med.name,
				expiry: med.expiryDate?.toDate ? med.expiryDate.toDate().toISOString() : med.expiryDate,
				category: med.category,
				totalAvailable: med.totalAvailable
			}))
			.filter((med) => med.expiry && !isNaN(new Date(med.expiry)))
			.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
	}

	// Helper: All batches by expiry (main collection)
	function getNearestExpiryBatches(n = 10) {
		return allBatches
			.filter((b) => b.expiry && !isNaN(new Date(b.expiry)))
			.sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
			.slice(0, n);
	}

	// Most requested category (reactive)
	$: mostRequestedCategory = (() => {
		const catCounts = {};
		for (const req of requests) {
			for (const med of req.medicines || []) {
				const m = medicines.find((x) => x.id === med.medicineId);
				if (m) {
					const cat = m.category || 'غير مصنف';
					catCounts[cat] = (catCounts[cat] || 0) + 1;
				}
			}
		}
		let maxCat = '';
		let maxCount = 0;
		for (const [cat, count] of Object.entries(catCounts)) {
			if (count > maxCount) {
				maxCat = cat;
				maxCount = count;
			}
		}
		return maxCat || 'غير مصنف';
	})();

	// Unique categories and their counts (reactive)
	$: categoryCounts = (() => {
		const counts = {};
		for (const med of medicines) {
			const cat = med.category || 'غير مصنف';
			counts[cat] = (counts[cat] || 0) + 1;
		}
		return counts;
	})();

	$: statusCounts = {
		pending: requests.filter((r) => r.status === 'pending').length,
		approved: requests.filter((r) => r.status === 'approved').length,
		denied: requests.filter((r) => r.status === 'denied').length
	};
	onMount(async () => {
		medicines = await fetchMedicines();
		for (const med of medicines) {
			med.batches = await fetchBatchesForMedicine(med.id);
			med.batches = med.batches.map((batch) => ({
				...batch,
				expiry: batch.expiryDate?.toDate
					? batch.expiryDate.toDate().toISOString()
					: batch.expiryDate
			}));
			med.totalAvailable = (med.batches || []).reduce(
				(sum, batch) => sum + (parseInt(batch.quantity) || 0),
				0
			);
		}

		requests = await fetchRequests();
		users = await fetchStaff();

		recentRequests = [...requests]
			.sort((a, b) => {
				const ad = new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt);
				const bd = new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt);
				return bd - ad;
			})
			.slice(0, 10);

		const fetched = await fetchAllBatches();
		allBatches = fetched.map((batch) => ({
			...batch,
			expiry: batch.expiryDate?.toDate ? batch.expiryDate.toDate().toISOString() : batch.expiryDate
		}));
		await tick();

		// Chart 1: Requests by status
		if (statusChartCanvas) {
			if (statusChart) statusChart.destroy();
			statusChart = new Chart(statusChartCanvas, {
				type: 'bar',
				data: {
					labels: ['قيد الانتظار', 'تمت الموافقة', 'مرفوض'],
					datasets: [
						{
							label: 'عدد الطلبات',
							data: [statusCounts.pending, statusCounts.approved, statusCounts.denied],
							backgroundColor: ['#fbbf24', '#4ade80', '#f87171']
						}
					]
				},
				options: { responsive: true, plugins: { legend: { display: false } } }
			});
		}

		// Chart 2: Requests over time
		const { days, counts } = getRequestsOverTime();
		if (timeChartCanvas) {
			if (timeChart) timeChart.destroy();
			timeChart = new Chart(timeChartCanvas, {
				type: 'line',
				data: {
					labels: days,
					datasets: [
						{
							label: 'عدد الطلبات يومياً',
							data: counts,
							borderColor: '#60a5fa',
							backgroundColor: '#bae6fd',
							fill: true
						}
					]
				},
				options: { responsive: true }
			});
		}

		// Chart 3: Top requested medicines
		const topMed = getTopRequestedMedicines();
		if (topMedChartCanvas) {
			if (topMedChart) topMedChart.destroy();
			topMedChart = new Chart(topMedChartCanvas, {
				type: 'bar',
				data: {
					labels: topMed.labels,
					datasets: [
						{
							label: 'الأكثر طلباً',
							data: topMed.counts,
							backgroundColor: '#a78bfa'
						}
					]
				},
				options: { responsive: true, plugins: { legend: { display: false } } }
			});
		}

		// Chart 4: Stock by category
		const stockCat = getStockByCategory();
		if (stockCatChartCanvas) {
			if (stockCatChart) stockCatChart.destroy();
			stockCatChart = new Chart(stockCatChartCanvas, {
				type: 'doughnut',
				data: {
					labels: stockCat.labels,
					datasets: [
						{
							label: 'المخزون حسب الفئة',
							data: stockCat.counts,
							backgroundColor: [
								'#60a5fa',
								'#fbbf24',
								'#4ade80',
								'#a78bfa',
								'#f87171',
								'#f472b6',
								'#34d399'
							]
						}
					]
				},
				options: { responsive: true }
			});
		}

		// Chart 5: Staff activity
		const staff = getStaffActivity();
		if (staffChartCanvas) {
			if (staffChart) staffChart.destroy();
			staffChart = new Chart(staffChartCanvas, {
				type: 'bar',
				data: {
					labels: staff.labels,
					datasets: [
						{
							label: 'عدد الطلبات لكل موظف',
							data: staff.counts,
							backgroundColor: '#fbbf24'
						}
					]
				},
				options: { responsive: true, plugins: { legend: { display: false } } }
			});
		}

		// Chart: Most Requested Categories
		const catData = getMostRequestedCategories();
		if (catChartCanvas) {
			if (catChart) catChart.destroy();
			catChart = new Chart(catChartCanvas, {
				type: 'bar',
				data: {
					labels: catData.labels,
					datasets: [
						{
							label: 'عدد الطلبات لكل فئة',
							data: catData.counts,
							backgroundColor: ['#60a5fa', '#fbbf24', '#4ade80', '#a78bfa', '#f87171']
						}
					]
				},
				options: { responsive: true, plugins: { legend: { display: false } } }
			});
		}
	});

	function getMedicineNameById(id) {
		const med = medicines.find((m) => m.id === id);
		return med ? med.name : '-';
	}
</script>

<!-- Top KPIs: Requests & Categories side by side -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
	<!-- Requests KPI -->
	<div
		class="bg-white rounded-xl shadow hover:shadow-lg p-6 text-center flex flex-col md:flex-row justify-center items-center gap-8 transition"
	>
		<div>
			<div class="text-3xl font-bold mb-1 text-blue-700">{requests.length}</div>
			<div class="text-gray-500 mb-2">عدد الطلبات</div>
		</div>
		<div class="flex flex-row gap-8">
			<div>
				<span class="font-bold text-yellow-600 text-xl"
					>{requests.filter((r) => r.status === 'pending').length}</span
				>
				<span class="text-xs text-gray-500 ms-1 block">قيد الانتظار</span>
			</div>
			<div>
				<span class="font-bold text-green-600 text-xl"
					>{requests.filter((r) => r.status === 'approved').length}</span
				>
				<span class="text-xs text-gray-500 ms-1 block">موافق عليها</span>
			</div>
			<div>
				<span class="font-bold text-red-600 text-xl"
					>{requests.filter((r) => r.status === 'denied').length}</span
				>
				<span class="text-xs text-gray-500 ms-1 block">مرفوضة</span>
			</div>
		</div>
	</div>
	<!-- Categories KPI -->
	<div
		class="bg-white rounded-xl shadow hover:shadow-lg p-6 text-center flex flex-col items-center transition"
	>
		<div class="text-3xl font-bold text-orange-500">{Object.keys(categoryCounts).length}</div>
		<div class="text-gray-500 mb-2">عدد الفئات</div>
		<div class="flex flex-wrap justify-center gap-2 mt-2">
			{#each Object.entries(categoryCounts) as [cat, count]}
				<span class="bg-gray-100 rounded px-2 py-1 text-xs">{cat}: {count}</span>
			{/each}
		</div>
	</div>
</div>

<!-- Other KPIs below -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-6 my-6">
	<div
		class="bg-white rounded-xl shadow hover:shadow-lg p-4 text-center flex flex-col items-center transition"
	>
		<div class="text-2xl font-bold text-blue-600">{medicines.length}</div>
		<div class="text-gray-500">عدد الأدوية</div>
	</div>
	<div
		class="bg-white rounded-xl shadow hover:shadow-lg p-4 text-center flex flex-col items-center transition"
	>
		<div class="text-2xl font-bold text-gray-700">{users.length}</div>
		<div class="text-gray-500">عدد الموظفين</div>
	</div>
	<div
		class="bg-white rounded-xl shadow hover:shadow-lg p-4 text-center flex flex-col items-center transition"
	>
		<div class="text-2xl font-bold text-blue-500">
			{users.filter((u) => u.role === 'doctor').length}
		</div>
		<div class="text-blue-600">عدد الأطباء</div>
	</div>
	<div
		class="bg-white rounded-xl shadow hover:shadow-lg p-4 text-center flex flex-col items-center transition"
	>
		<div class="text-2xl font-bold text-purple-600">
			{users.filter((u) => u.role === 'nurse').length}
		</div>
		<div class="text-purple-600">عدد الممرضين</div>
	</div>
</div>

<!-- Charts -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
	<div class="bg-white rounded-xl shadow p-4 h-[400px] flex flex-col">
		<h2 class="text-lg font-bold mb-2 text-blue-700">الطلبات حسب الحالة</h2>
		<div class="flex-1 flex items-center">
			<canvas bind:this={statusChartCanvas} class="w-full h-full"></canvas>
		</div>
	</div>
	<div class="bg-white rounded-xl shadow p-4 h-[400px] flex flex-col">
		<h2 class="text-lg font-bold mb-2 text-blue-700">الطلبات على مدار الوقت (آخر 14 يوم)</h2>
		<div class="flex-1 flex items-center">
			<canvas bind:this={timeChartCanvas} class="w-full h-full"></canvas>
		</div>
	</div>
	<div class="bg-white rounded-xl shadow p-4 h-[400px] flex flex-col">
		<h2 class="text-lg font-bold mb-2 text-blue-700">الأدوية الأكثر طلباً</h2>
		<div class="flex-1 flex items-center">
			<canvas bind:this={topMedChartCanvas} class="w-full h-full"></canvas>
		</div>
	</div>
	<div class="bg-white rounded-xl shadow p-4 h-[400px] flex flex-col">
		<h2 class="text-lg font-bold mb-2 text-blue-700">نشاط الموظفين</h2>
		<div class="flex-1 flex items-center">
			<canvas bind:this={staffChartCanvas} class="w-full h-full"></canvas>
		</div>
	</div>
	<div class="bg-white rounded-xl shadow p-4 h-[400px] flex flex-col overflow-hidden relative">
		<h2 class="text-lg font-bold mb-2 text-blue-700 z-10">توزيع المخزون حسب الفئة</h2>
		<div class="flex-1 flex items-center relative">
			<canvas
				bind:this={stockCatChartCanvas}
				class="w-full h-full absolute inset-0"
				style="max-width:100%;max-height:100%;"
			></canvas>
		</div>
	</div>
	<div class="bg-white rounded-xl shadow p-4 h-[400px] flex flex-col">
		<h2 class="text-lg font-bold mb-2 text-blue-700">الفئات الأكثر طلباً</h2>
		<div class="flex-1 flex items-center">
			<canvas bind:this={catChartCanvas} class="w-full h-full"></canvas>
		</div>
	</div>
</div>

<!-- Section break -->
<div class="my-8 border-t border-gray-200"></div>

<!-- Recent Requests Table -->
<h2 class="mt-8 mb-2 text-lg font-bold">آخر الطلبات</h2>
<div class="overflow-x-auto">
	<table class="min-w-full bg-white rounded shadow">
		<thead>
			<tr>
				<th class=" text-right px-4 py-2">الأدوية</th>
				<th class=" text-right px-4 py-2">الوصف</th>
				<th class=" text-right px-4 py-2">الحالة</th>
				<th class=" text-right px-4 py-2">تاريخ الإنشاء</th>
				<th class=" text-right px-4 py-2">الموظف</th>
			</tr>
		</thead>
		<tbody>
			{#each recentRequests as req, i}
				<tr class="hover:bg-gray-50 transition border-b border-gray-200">
					<td class="px-4 py-2">
						{#if req.medicines && req.medicines.length}
							<ul>
								{#each req.medicines as med}
									<li>
										{#if medicines.find((m) => m && m.id === med.medicineId)}
											{medicines.find((m) => m && m.id === med.medicineId).name}
										{:else}
											-
										{/if}
										{#if med.quantity}
											<span class="text-xs text-gray-500">({med.quantity})</span>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							-
						{/if}
					</td>
					<td class="px-4 py-2">{req.description}</td>
					<td class="px-4 py-2">
						{#if req.status === 'pending'}
							<span class="text-yellow-600">قيد الانتظار</span>
						{:else if req.status === 'approved'}
							<span class="text-green-600">تمت الموافقة</span>
						{:else if req.status === 'denied'}
							<span class="text-red-600">مرفوض</span>
						{:else}
							{req.status}
						{/if}
					</td>
					<td class="px-4 py-2">
						{#if req.createdAt}
							{new Date(
								req.createdAt?.toDate ? req.createdAt.toDate() : req.createdAt
							).toLocaleDateString('ar-EG')}
						{:else}
							-
						{/if}
					</td>
					<td class="px-4 py-2">
						{#if req.requestedBy}
							{#if users.find((u) => u.id === req.requestedBy)}
								{users.find((u) => u.id === req.requestedBy).name}
							{:else}
								-
							{/if}
						{:else}
							-
						{/if}
					</td>
				</tr>
			{/each}
			{#if recentRequests.length === 0}
				<tr><td class="px-4 py-2" colspan="5">لا توجد طلبات حديثة</td></tr>
			{/if}
		</tbody>
	</table>
</div>

<!-- Section break -->
<div class="my-8 border-t border-gray-200"></div>

<!-- Nearest Expiry Batches Table -->
<h2 class="mt-8 mb-2 text-lg font-bold">أقرب 10 دفعات انتهاءً</h2>
<div class="overflow-x-auto">
	{#if allBatches.length === 0}
		<table class="min-w-full bg-white rounded shadow">
			<thead>
				<tr>
					<th class=" text-right px-4 py-2">اسم الدواء</th>
					<th class=" text-right px-4 py-2">تاريخ الانتهاء</th>
					<th class=" text-right px-4 py-2">الكمية</th>
				</tr>
			</thead>
			<tbody>
				{#each getNearestExpiryBatches() as batch}
					<tr>
						<td class="px-4 py-2">{getMedicineNameById(batch.medicineId)}</td>
						<td class="px-4 py-2">
							{#if batch.expiry && !isNaN(new Date(batch.expiry))}
								{new Date(batch.expiry).toLocaleDateString('ar-EG')}
							{:else}
								-
							{/if}
						</td>
						<td class="px-4 py-2">{batch.quantity}</td>
					</tr>
				{/each}
				{#if getNearestExpiryBatches().length === 0}
					<tr><td class="px-4 py-2" colspan="3">لا توجد دفعات</td></tr>
				{/if}
			</tbody>
		</table>
	{:else}
		<table class="min-w-full bg-white rounded shadow">
			<thead>
				<tr>
					<th class=" text-right px-4 py-2">اسم الدواء</th>
					<th class=" text-right px-4 py-2">تاريخ الانتهاء</th>
					<th class=" text-right px-4 py-2">الكمية</th>
				</tr>
			</thead>
			<tbody>
				{#each getNearestExpiryBatches() as batch}
					<tr>
						<td class="px-4 py-2">{getMedicineNameById(batch.medicineId)}</td>
						<td class="px-4 py-2">
							{#if batch.expiry && !isNaN(new Date(batch.expiry))}
								{new Date(batch.expiry).toLocaleDateString('ar-EG')}
							{:else}
								-
							{/if}
						</td>
						<td class="px-4 py-2">{batch.quantity}</td>
					</tr>
				{/each}
				{#if getNearestExpiryBatches().length === 0}
					<tr><td class="px-4 py-2" colspan="3">لا توجد دفعات</td></tr>
				{/if}
			</tbody>
		</table>
	{/if}
</div>
