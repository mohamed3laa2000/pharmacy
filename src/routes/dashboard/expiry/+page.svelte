<script>
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
	import { userLocation } from '$lib/store/dataStore';
	import jsPDF from 'jspdf';
	import { FilePdf, Trash } from 'phosphor-svelte';
	import html2pdf from 'html2pdf.js';
	import PrintArea from './PrintArea.svelte';

	let expired = [];
	let nearExpiry = [];
	let loading = true;
	let forms = [];
	let formLoading = false;

	const NEAR_EXPIRY_DAYS = 30;

	// Pagination for forms
	let formsPage = 1;
	let formsPerPage = 5;
	let paginatedForms = [];
	let totalPages = 1;

	function paginateForms() {
		// Sort forms by createdAt descending (latest first)
		forms = forms.slice().sort((a, b) => {
			const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
			const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
			return bDate - aDate;
		});
		totalPages = Math.ceil(forms.length / formsPerPage) || 1;
		const start = (formsPage - 1) * formsPerPage;
		const end = start + formsPerPage;
		paginatedForms = forms.slice(start, end);
	}

	async function loadBatches() {
		loading = true;
		expired = [];
		nearExpiry = [];
		const location = $userLocation;
		if (!location || !location.pharmacyId) return;

		const medicinesSnap = await getDocs(
			collection(db, 'Pharmacies', location.pharmacyId, 'medicines')
		);
		const medicines = medicinesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

		for (const med of medicines) {
			const batchesSnap = await getDocs(
				collection(db, 'Pharmacies', location.pharmacyId, 'medicines', med.id, 'batches')
			);
			for (const batchDoc of batchesSnap.docs) {
				const batch = batchDoc.data();
				const expiry = batch.expiryDate?.toDate
					? batch.expiryDate.toDate()
					: new Date(batch.expiryDate);
				const today = new Date();
				const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
				const batchInfo = {
					medicineId: med.id,
					medicineName: med.name,
					batchId: batchDoc.id,
					quantity: batch.quantity,
					expiry: expiry.toLocaleDateString(),
					expiryRaw: expiry,
					supplier: batch.supplier ?? '',
					production: batch.productionDate?.toDate
						? batch.productionDate.toDate().toLocaleDateString()
						: batch.productionDate,
					received: batch.receivedDate?.toDate
						? batch.receivedDate.toDate().toLocaleDateString()
						: batch.receivedDate
				};
				if (diffDays < 0) {
					expired.push(batchInfo);
				} else if (diffDays <= NEAR_EXPIRY_DAYS) {
					nearExpiry.push(batchInfo);
				}
			}
		}
		loading = false;
	}

	async function loadForms() {
		formLoading = true;
		const location = $userLocation;
		if (!location || !location.pharmacyId) return;
		const formsSnap = await getDocs(
			collection(db, 'Pharmacies', location.pharmacyId, 'expiryForms')
		);
		forms = formsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
		formLoading = false;
	}

	onMount(async () => {
		await loadBatches();
		await loadForms();
	});

	// Ensure pagination updates when forms or page changes
	$: [forms, formsPage], paginateForms();

	function generateFormData(type) {
		const list = type === 'expired' ? expired : nearExpiry;
		return list.map((b) => ({
			medicineId: b.medicineId,
			medicineName: b.medicineName,
			batchId: b.batchId,
			quantity: b.quantity,
			expiry: b.expiry,
			supplier: b.supplier
		}));
	}

	async function printForm(type) {
		if (type !== 'expired') return; // Only allow PDF for expired
		const location = $userLocation;
		if (!location || !location.pharmacyId) return;
		const formData = generateFormData(type);
		if (!formData.length) {
			alert('لا توجد بيانات للطباعة');
			return;
		}
		// Generate PDF
		const docPdf = new jsPDF();
		docPdf.text('نموذج الأدوية المنتهية', 10, 10);
		formData.forEach((item, idx) => {
			docPdf.text(
				`${idx + 1}. ${item.medicineName} - دفعة: ${item.batchId} - كمية: ${item.quantity} - انتهاء: ${item.expiry} - المورد: ${item.supplier}`,
				10,
				20 + idx * 10
			);
		});
		docPdf.save(`منتهية_${Date.now()}.pdf`);

		// Save form request in Firestore
		await addDoc(collection(db, 'Pharmacies', location.pharmacyId, 'expiryForms'), {
			type,
			createdAt: new Date(),
			items: formData,
			accepted: false
		});
		await loadForms();
	}

	async function acceptForm(form) {
		const location = $userLocation;
		if (!location || !location.pharmacyId) return;
		// Delete all batches in the form from both subcollection and main batches
		for (const item of form.items) {
			// Delete from medicine's subcollection
			await deleteDoc(
				doc(
					db,
					'Pharmacies',
					location.pharmacyId,
					'medicines',
					item.medicineId,
					'batches',
					item.batchId
				)
			);
			// Delete from main batches collection
			await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'batches', item.batchId));
		}
		await updateDoc(doc(db, 'Pharmacies', location.pharmacyId, 'expiryForms', form.id), {
			accepted: true,
			acceptedAt: new Date()
		});
		await loadBatches();
		await loadForms();
	}

	function downloadFormPdf(form) {
		const docPdf = new jsPDF();
		docPdf.text(
			form.type === 'expired' ? 'نموذج الأدوية المنتهية' : 'نموذج الأدوية قريبة الانتهاء',
			10,
			10
		);
		form.items.forEach((item, idx) => {
			docPdf.text(
				`${idx + 1}. ${item.medicineName} - دفعة: ${item.batchId} - كمية: ${item.quantity} - انتهاء: ${item.expiry} - المورد: ${item.supplier}`,
				10,
				20 + idx * 10
			);
		});
		docPdf.save(
			`${form.type === 'expired' ? 'منتهية' : 'قريبة_الانتهاء'}_${form.createdAt?.seconds || Date.now()}.pdf`
		);
	}

	async function printCustomPdf() {
		const element = document.getElementById('print-area');
		await html2pdf()
			.set({
				margin: 0,
				filename: 'محضر اتلاف.pdf',
				image: { type: 'jpeg', quality: 0.98 },
				html2canvas: { scale: 2 },
				jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
			})
			.from(element)
			.save();

		// Add to expiryForms collection
		const location = $userLocation;
		if (location && location.pharmacyId && expired.length > 0) {
			await addDoc(collection(db, 'Pharmacies', location.pharmacyId, 'expiryForms'), {
				type: 'expired',
				createdAt: new Date(),
				items: expired.map((item) => ({
					medicineId: item.medicineId,
					medicineName: item.medicineName,
					batchId: item.batchId,
					quantity: item.quantity,
					expiry: item.expiry,
					supplier: item.supplier
				})),
				accepted: false
			});
			await loadForms(); // Refresh the list
		}
	}

	// Function to delete a form
	async function deleteForm(form) {
		const location = $userLocation;
		if (!location || !location.pharmacyId) return;
		if (!confirm('هل أنت متأكد من حذف هذا النموذج؟')) return;
		await deleteDoc(doc(db, 'Pharmacies', location.pharmacyId, 'expiryForms', form.id));
		await loadForms();
	}
</script>

{#if loading}
	<div class="flex justify-center items-center h-40">
		<span class="text-lg text-gray-500">جاري التحميل...</span>
	</div>
{:else}
	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<!-- Expired -->
		<div class="bg-white rounded-lg shadow p-5">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-red-700 flex items-center gap-2">الأدوية المنتهية</h2>
				<button
					class="cursor-pointer bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition"
					on:click={printCustomPdf}
				>
					طباعة نموذج
				</button>
			</div>
			<div class="overflow-x-auto">
				<div class="overflow-y-auto" style="max-height: 15rem;">
					<table class="w-full text-base text-center rtl:text-right text-gray-700">
						<thead class="bg-red-50">
							<tr>
								<th class="px-4 py-2">الدواء</th>
								<th class="px-4 py-2">الدفعة</th>
								<th class="px-4 py-2">الكمية</th>
								<th class="px-4 py-2">تاريخ الانتهاء</th>
								<th class="px-4 py-2">المورد</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each expired as b}
								<tr class="hover:bg-red-50">
									<td class="px-4 py-2">{b.medicineName}</td>
									<td class="px-4 py-2">{b.batchId}</td>
									<td class="px-4 py-2">{b.quantity}</td>
									<td class="px-4 py-2">{b.expiry}</td>
									<td class="px-4 py-2">{b.supplier}</td>
								</tr>
							{/each}
							{#if expired.length === 0}
								<tr><td colspan="5" class="text-gray-400 py-4">لا يوجد</td></tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
		<!-- Near Expiry -->
		<div class="bg-white rounded-lg shadow p-5">
			<div class="flex items-center mb-4">
				<h2 class="text-lg font-semibold text-yellow-700 flex items-center gap-2">
					الأدوية قريبة الانتهاء (خلال {NEAR_EXPIRY_DAYS} يوم)
				</h2>
			</div>
			<div class="overflow-x-auto">
				<div class="overflow-y-auto" style="max-height: 15rem;">
					<table class="w-full text-base text-center rtl:text-right text-gray-700">
						<thead class="bg-yellow-50">
							<tr>
								<th class="px-4 py-2">الدواء</th>
								<th class="px-4 py-2">الدفعة</th>
								<th class="px-4 py-2">الكمية</th>
								<th class="px-4 py-2">تاريخ الانتهاء</th>
								<th class="px-4 py-2">المورد</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each nearExpiry as b}
								<tr class="hover:bg-yellow-50">
									<td class="px-4 py-2">{b.medicineName}</td>
									<td class="px-4 py-2">{b.batchId}</td>
									<td class="px-4 py-2">{b.quantity}</td>
									<td class="px-4 py-2">{b.expiry}</td>
									<td class="px-4 py-2">{b.supplier}</td>
								</tr>
							{/each}
							{#if nearExpiry.length === 0}
								<tr><td colspan="5" class="text-gray-400 py-4">لا يوجد</td></tr>
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Forms List -->
<div class="mt-12 bg-white rounded-lg shadow p-6">
	<h2 class="text-lg font-bold mb-4 text-gray-700">نماذج الطباعة السابقة</h2>
	{#if formLoading}
		<div class="flex justify-center items-center h-20">
			<span class="text-gray-500">جاري التحميل...</span>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg shadow bg-white">
			<table class="w-full text-base text-center rtl:text-right text-gray-700">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-2">تاريخ الإنشاء</th>
						<th class="px-4 py-2">عدد العناصر</th>
						<th class="px-4 py-2">الحالة</th>
						<th class="px-4 py-2">إجراءات</th>
						<th class="px-4 py-2"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200">
					{#each paginatedForms as form}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-2"
								>{form.createdAt?.toDate ? form.createdAt.toDate().toLocaleString() : ''}</td
							>
							<td class="px-4 py-2">{form.items?.length}</td>
							<td class="px-4 py-2">
								{#if form.accepted}
									<span class="text-green-700 font-bold">تم القبول</span>
								{:else}
									<span class="text-yellow-700 font-bold">بانتظار القبول</span>
								{/if}
							</td>
							<td class="px-4 py-2 flex items-center gap-2">
								{#if !form.accepted && form.type === 'expired'}
									<button
										class="cursor-pointer bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
										on:click={() => acceptForm(form)}
									>
										قبول وحذف الدفعات
									</button>
								{:else}
									<span class="text-gray-400">-</span>
								{/if}
							</td>
							<td
								><button
									class="cursor-pointer ml-2 text-red-500 hover:text-red-900"
									title="تحميل PDF"
									on:click={() => downloadFormPdf(form)}
								>
									<FilePdf size={24} />
								</button><button
									class="cursor-pointer ml-2 text-red-500 hover:text-red-600"
									title="حذف النموذج"
									on:click={() => deleteForm(form)}
								>
									<Trash size={24} />
								</button></td
							>
						</tr>
					{/each}
					{#if paginatedForms.length === 0}
						<tr><td colspan="5" class="text-gray-400 py-4">لا يوجد</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
		<!-- Pagination Controls -->
		<div class="flex justify-center items-center gap-2 mt-4">
			<button
				class="cursor-pointer px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-default disabled:cursor-default disabled:hover:bg-gray-200"
				on:click={() => (formsPage = Math.max(1, formsPage - 1))}
				disabled={formsPage === 1}
			>
				السابق
			</button>
			<span class="mx-2 text-gray-700">صفحة {formsPage} من {totalPages}</span>
			<button
				class="cursor-pointer px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-default disabled:cursor-default disabled:hover:bg-gray-200"
				on:click={() => (formsPage = Math.min(totalPages, formsPage + 1))}
				disabled={formsPage === totalPages}
			>
				التالي
			</button>
		</div>
	{/if}
</div>

<!-- HTML PDF -->
{#if !loading}
	<div style=" position: absolute; top: 1000px; display: none;">
		<div
			id="print-area"
			style="background: #fff; color: #222; padding: 2rem; width: 21cm; height: 29.65cm; direction: rtl; font-family: 'Tajawal', Arial, sans-serif;"
		>
			<div style="display: flex; justify-content: space-between; align-items: flex-start;">
				<img src="/logo.svg" alt="logo" style="height: 60px;" />
				<!-- <img src="/2030.png" alt="vision 2030" style="height: 60px;"> -->
			</div>
			<h2
				style="font-weight: bold; text-align: center; margin: 1rem 0; color: #007a3d; font-size: 1.5rem;"
			>
				محضر إتلاف
			</h2>
			<div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
				<span
					>انه في يوم ................. بتاريخ ................. هـ، وفي الساعة ( .................
					) تم اتلاف الادوية ادناه:</span
				>
				<span></span>
			</div>
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
				<thead>
					<tr style="background: #e5e7eb;">
						<th style="border: 1px solid #999; padding: 4px;">م</th>
						<th style="border: 1px solid #999; padding: 4px;">البيان/الوصف</th>
						<th style="border: 1px solid #999; padding: 4px;">العدد/الكمية</th>
						<th style="border: 1px solid #999; padding: 4px;">تاريخ الانتهاء</th>
						<th style="border: 1px solid #999; padding: 4px;">رقم التشغيله</th>
					</tr>
				</thead>
				<tbody>
					{#each expired.slice(0, 10) as item, i}
						<tr>
							<td style="border: 1px solid #999; padding: 4px;">{i + 1}</td>
							<td style="border: 1px solid #999; padding: 4px;">{item.medicineName}</td>
							<td style="border: 1px solid #999; padding: 4px;">{item.quantity}</td>
							<td style="border: 1px solid #999; padding: 4px;">{item.expiry}</td>
							<td style="border: 1px solid #999; padding: 4px;">{item.batchId}</td>
						</tr>
					{/each}
					{#each Array(10 - expired.length) as _, i}
						<tr>
							<td style="border: 1px solid #999; padding: 4px;">{expired.length + i + 1}</td>
							<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
							<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
							<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
							<td style="border: 1px solid #999; padding: 4px;">&nbsp;</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div style="margin-bottom: 1rem;">وذلك لعدم صلاحيتها للاستعمال. وهذا محضر بما تم ...</div>
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
				<thead>
					<tr style="background: #e5e7eb;">
						<th style="border: 1px solid #999; padding: 4px;">المهنة</th>
						<th style="border: 1px solid #999; padding: 4px;">الاسم</th>
						<th style="border: 1px solid #999; padding: 4px;">التوقيع</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td style="border: 1px solid #999; padding: 4px;">صيدلي</td>
						<td style="border: 1px solid #999; padding: 4px;"></td>
						<td style="border: 1px solid #999; padding: 4px;"></td>
					</tr>
					<tr>
						<td style="border: 1px solid #999; padding: 4px;">طبيب</td>
						<td style="border: 1px solid #999; padding: 4px;"></td>
						<td style="border: 1px solid #999; padding: 4px;"></td>
					</tr>
					<tr>
						<td style="border: 1px solid #999; padding: 4px;">ممرض</td>
						<td style="border: 1px solid #999; padding: 4px;"></td>
						<td style="border: 1px solid #999; padding: 4px;"></td>
					</tr>
				</tbody>
			</table>
			<div style="margin-bottom: 1rem;">
				وتم تسليمها للشركة: ...........................................
			</div>
			<div style="margin-bottom: 1rem;">
				الموظف المسؤول: ...........................................
			</div>
			<div>التوقيع: ...........................................</div>
		</div>
	</div>
{/if}
