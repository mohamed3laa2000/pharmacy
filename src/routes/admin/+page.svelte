<script>
	import { onMount, tick } from 'svelte';
	import Chart from 'chart.js/auto';
	import { db } from '$lib/firebase';
	import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

	let pharmacies = [];
	let pharmacyLabels = [];
	let loading = true;

	// Chart data
	let requestsPerPharmacy = [];
	let medicinesPerPharmacy = [];
	let mostRequestedCategory = [];

	let categoryQuantitiesPerPharmacy = {}; // { pharmacyId: { category: quantity } }
	let requestCountsPerPharmacy = {}; // { pharmacyId: { category: count } }
	let categorySet = new Set();

	// Chart.js refs
	let requestsChart, requestsCanvas;
	let medicinesChart, medicinesCanvas;
	let quantitiesBarChart, quantitiesBarCanvas;
	let requestsBarChart, requestsBarCanvas;

	onMount(async () => {
		const pharmacySnap = await getDocs(collection(db, 'Pharmacies'));
		pharmacies = pharmacySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
		pharmacyLabels = pharmacies.map((p) => p.location || p.id);

		let reqCounts = [];
		let medCounts = [];
		let catStats = [];

		// For grouped bar charts
		let catQuantitiesPerPharmacy = {};
		let reqCountsPerPharmacy = {};

		for (const pharmacy of pharmacies) {
			const reqsSnap = await getDocs(collection(db, 'Pharmacies', pharmacy.id, 'requests'));
			const medsSnap = await getDocs(collection(db, 'Pharmacies', pharmacy.id, 'medicines'));

			reqCounts.push(reqsSnap.size);
			medCounts.push(medsSnap.size);

			// Most requested category
			let catCount = {};
			// For quantities and request counts per category
			let catQuantities = {};
			let catReqCounts = {};

			for (const reqDoc of reqsSnap.docs) {
				const reqData = reqDoc.data();
				const medObjs = reqData.medicines || [];
				let categoriesInRequest = new Set();

				for (const medObj of medObjs) {
					const medId = medObj.medicineId;
					const quantity = medObj.quantity || 0;
					if (typeof medId !== 'string' || !medId) continue;
					const medRef = doc(db, 'Pharmacies', pharmacy.id, 'medicines', medId);
					const medSnap = await getDoc(medRef);
					if (medSnap.exists()) {
						const medData = medSnap.data();
						const cat = medData.category || 'غير محدد';
						categorySet.add(cat);

						// For most requested category
						catCount[cat] = (catCount[cat] || 0) + 1;

						// For quantities per category
						catQuantities[cat] = (catQuantities[cat] || 0) + quantity;

						// For requests per category (count unique per request)
						categoriesInRequest.add(cat);
					}
				}
				// For each category in this request, increment the count by 1
				for (const cat of categoriesInRequest) {
					catReqCounts[cat] = (catReqCounts[cat] || 0) + 1;
				}
			}
			let topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
			catStats.push(topCat ? topCat[0] : 'غير محدد');

			catQuantitiesPerPharmacy[pharmacy.id] = catQuantities;
			reqCountsPerPharmacy[pharmacy.id] = catReqCounts;
		}

		requestsPerPharmacy = reqCounts;
		medicinesPerPharmacy = medCounts;
		mostRequestedCategory = catStats;
		categoryQuantitiesPerPharmacy = catQuantitiesPerPharmacy;
		requestCountsPerPharmacy = reqCountsPerPharmacy;

		loading = false;
		await tick();

		drawRequestsChart();
		drawMedicinesChart();
		drawQuantitiesBarChart();
		drawRequestsBarChart();
	});

	function drawRequestsChart() {
		if (requestsChart) requestsChart.destroy();
		if (!requestsCanvas) return;
		requestsChart = new Chart(requestsCanvas, {
			type: 'bar',
			data: {
				labels: pharmacyLabels,
				datasets: [
					{
						label: 'عدد الطلبات',
						data: requestsPerPharmacy,
						backgroundColor: 'rgba(54, 162, 235, 0.7)'
					}
				]
			},
			options: { responsive: true, plugins: { legend: { display: false } } }
		});
	}

	function drawMedicinesChart() {
		if (medicinesChart) medicinesChart.destroy();
		if (!medicinesCanvas) return;
		medicinesChart = new Chart(medicinesCanvas, {
			type: 'bar',
			data: {
				labels: pharmacyLabels,
				datasets: [
					{
						label: 'عدد الأدوية',
						data: medicinesPerPharmacy,
						backgroundColor: 'rgba(75, 192, 192, 0.7)'
					}
				]
			},
			options: { responsive: true, plugins: { legend: { display: false } } }
		});
	}

	function drawQuantitiesBarChart() {
		if (quantitiesBarChart) quantitiesBarChart.destroy();
		if (!quantitiesBarCanvas) return;
		const categories = Array.from(categorySet);
		const datasets = categories.map((cat, idx) => ({
			label: cat,
			backgroundColor: [
				'#36A2EB',
				'#FF6384',
				'#FFCE56',
				'#4BC0C0',
				'#9966FF',
				'#FF9F40',
				'#C9CBCF'
			][idx % 7],
			data: pharmacies.map((pharmacy) => categoryQuantitiesPerPharmacy[pharmacy.id][cat] || 0)
		}));
		quantitiesBarChart = new Chart(quantitiesBarCanvas, {
			type: 'bar',
			data: {
				labels: pharmacyLabels,
				datasets
			},
			options: {
				responsive: true,
				plugins: { legend: { position: 'bottom' } },
				scales: { x: { stacked: false }, y: { beginAtZero: true } }
			}
		});
	}

	function drawRequestsBarChart() {
		if (requestsBarChart) requestsBarChart.destroy();
		if (!requestsBarCanvas) return;
		const categories = Array.from(categorySet);
		const datasets = categories.map((cat, idx) => ({
			label: cat,
			backgroundColor: [
				'#36A2EB',
				'#FF6384',
				'#FFCE56',
				'#4BC0C0',
				'#9966FF',
				'#FF9F40',
				'#C9CBCF'
			][idx % 7],
			data: pharmacies.map((pharmacy) => requestCountsPerPharmacy[pharmacy.id][cat] || 0)
		}));
		requestsBarChart = new Chart(requestsBarCanvas, {
			type: 'bar',
			data: {
				labels: pharmacyLabels,
				datasets
			},
			options: {
				responsive: true,
				plugins: { legend: { position: 'bottom' } },
				scales: { x: { stacked: false }, y: { beginAtZero: true } }
			}
		});
	}
</script>

<h1 class="text-2xl font-bold mb-6">إحصائيات عامة</h1>

{#if loading}
	<p>جاري تحميل البيانات...</p>
{:else}
	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold mb-4">عدد الطلبات لكل صيدلية</h2>
			<canvas bind:this={requestsCanvas} width="400" height="200"></canvas>
		</div>
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold mb-4">عدد الأدوية لكل صيدلية</h2>
			<canvas bind:this={medicinesCanvas} width="400" height="200"></canvas>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold mb-4">كمية كل فئة في كل صيدلية</h2>
			<canvas bind:this={quantitiesBarCanvas} width="600" height="400"></canvas>
		</div>
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold mb-4">عدد الطلبات لكل فئة في كل صيدلية</h2>
			<canvas bind:this={requestsBarCanvas} width="600" height="400"></canvas>
		</div>
	</div>
{/if}
