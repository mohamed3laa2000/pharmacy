<script>
    import { onMount } from 'svelte';
    import { collection, getDocs, doc, getDoc, query, orderBy, limit, startAfter } from 'firebase/firestore';
    import { db } from '$lib/firebase';

    let exchangeRequests = [];
    let lastVisible = null;
    let pageSize = 15;
    let hasMore = true;
    let isLoadingPage = false;

    let pharmacies = [];
    let catalogNames = {};

    onMount(async () => {
        const pharmacySnap = await getDocs(collection(db, 'Pharmacies'));
        pharmacies = pharmacySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        await loadExchangeRequests(true);
    });

    async function loadExchangeRequests(initial = true) {
        let q = query(
            collection(db, 'exchangeRequests'),
            orderBy('createdAt', 'desc'),
            limit(pageSize)
        );

        if (!initial && lastVisible) {
            q = query(
                collection(db, 'exchangeRequests'),
                orderBy('createdAt', 'desc'),
                startAfter(lastVisible),
                limit(pageSize)
            );
        }

        isLoadingPage = true;
        const snap = await getDocs(q);
        const newRequests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch catalog names for all unique catalogIds in this batch
        const uniqueCatalogIds = Array.from(new Set(newRequests.map(r => r.catalogId).filter(Boolean)));
        for (const catalogId of uniqueCatalogIds) {
            if (!catalogNames[catalogId]) {
                const catalogDoc = await getDoc(doc(db, 'medicinesCatalog', catalogId));
                catalogNames[catalogId] = catalogDoc.exists() ? catalogDoc.data().name : catalogId;
            }
        }

        if (initial) {
            exchangeRequests = newRequests;
        } else {
            exchangeRequests = [...exchangeRequests, ...newRequests];
        }

        lastVisible = snap.docs[snap.docs.length - 1];
        hasMore = snap.docs.length === pageSize;
        isLoadingPage = false;
    }

    function getPharmacyName(id) {
        return pharmacies.find(p => p.id === id)?.location || id;
    }

    function getCatalogName(id) {
        return catalogNames[id] || id;
    }
</script>

<h1 class="text-2xl font-bold mb-6">طلبات التبادل بين الصيدليات</h1>

<div class="relative overflow-x-auto">
    <table class="w-full text-lg text-center rtl:text-right text-gray-500">
        <thead>
            <tr>
                <th class="px-6 py-3">من صيدلية</th>
                <th class="px-6 py-3">إلى صيدلية</th>
                <th class="px-6 py-3">الدواء</th>
                <th class="px-6 py-3">الكمية</th>
                <th class="px-6 py-3">الحالة</th>
                <th class="px-6 py-3">ملاحظة</th>
                <th class="px-6 py-3">تاريخ الإنشاء</th>
            </tr>
        </thead>
        <tbody>
            {#each exchangeRequests as req}
                <tr class="bg-white border-b border-gray-200">
                    <td class="px-6 py-4">{getPharmacyName(req.fromPharmacyId)}</td>
                    <td class="px-6 py-4">{getPharmacyName(req.toPharmacyId)}</td>
                    <td class="px-6 py-4">{getCatalogName(req.catalogId)}</td>
                    <td class="px-6 py-4">{req.quantity}</td>
                    <td class="px-6 py-4">
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
                    <td class="px-6 py-4">{req.note || '-'}</td>
                    <td class="px-6 py-4">
                        {req.createdAt?.toDate?.()
                            ? req.createdAt.toDate().toLocaleString()
                            : '-'}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

{#if exchangeRequests.length === 0}
    <p class="text-gray-500 mt-4">لا توجد طلبات تبادل.</p>
{/if}

{#if hasMore && exchangeRequests.length > 0}
    <div class="flex justify-center my-4">
        <button
            class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 cursor-pointer"
            disabled={isLoadingPage}
            on:click={() => loadExchangeRequests(false)}
        >
            {isLoadingPage ? 'جاري التحميل...' : 'تحميل المزيد'}
        </button>
    </div>
{/if}