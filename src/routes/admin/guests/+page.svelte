<script>
    import { onMount } from 'svelte';
    import { collection, getDocs } from 'firebase/firestore';
    import { db } from '$lib/firebase';

    let pharmacies = [];
    let selectedPharmacy = '';
    let guests = [];

    onMount(async () => {
        const snapshot = await getDocs(collection(db, 'Pharmacies'));
        pharmacies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    });

    async function loadGuests() {
        if (!selectedPharmacy) {
            guests = [];
            return;
        }
        const guestsSnap = await getDocs(collection(db, 'Pharmacies', selectedPharmacy, 'guests'));
        guests = guestsSnap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name ?? 'بدون اسم',
            nationalId: doc.data().nationalId ?? '',
            age: doc.data().age ?? '',
            phone: doc.data().phone ?? '',
            notes: doc.data().notes ?? '',
            diagnoses: doc.data().diagnoses ?? []
        }));
    }
</script>

<h1 class="text-2xl font-bold mb-6">مرضى الصيدليات</h1>

<div class="mb-6 flex items-center gap-3">
    <label class="font-semibold text-gray-700 whitespace-nowrap">اختر صيدلية:</label>
    <select
        bind:value={selectedPharmacy}
        on:change={loadGuests}
        class="cursor-pointer p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-400 transition bg-white text-gray-900"
        style="width: 140px;"
        disabled={pharmacies.length === 0}
    >
        <option value="">-- اختر --</option>
        {#each pharmacies as pharmacy}
            <option value={pharmacy.id}>{pharmacy.location || pharmacy.id}</option>
        {/each}
    </select>
</div>

{#if !selectedPharmacy}
    <p class="text-gray-500">يرجى اختيار صيدلية لعرض المرضى.</p>
{:else}
    <div class="relative overflow-x-auto">
        <table class="w-full text-lg text-center rtl:text-right text-gray-500">
            <thead>
                <tr>
                    <th class="px-6 py-3">الاسم</th>
                    <th class="px-6 py-3">الرقم المدني</th>
                    <th class="px-6 py-3">العمر</th>
                    <th class="px-6 py-3">الهاتف</th>
                    <th class="px-6 py-3">ملاحظات</th>
                    <th class="px-6 py-3">التشخيصات</th>
                </tr>
            </thead>
            <tbody>
                {#each guests as guest}
                    <tr class="bg-white border-b border-gray-200">
                        <td class="px-6 py-4">{guest.name}</td>
                        <td class="px-6 py-4">{guest.nationalId}</td>
                        <td class="px-6 py-4">{guest.age}</td>
                        <td class="px-6 py-4">{guest.phone}</td>
                        <td class="px-6 py-4">{guest.notes && guest.notes.trim() !== '' ? guest.notes : 'لا يوجد'}</td>
                        <td class="px-6 py-4">
                            {#if guest.diagnoses && guest.diagnoses.length > 0}
                                <ul class="list-disc pr-5 mt-2 space-y-1 text-right">
                                    {#each guest.diagnoses as diag}
                                        <li>
                                            <span>{diag.date} - {diag.text}</span>
                                        </li>
                                    {/each}
                                </ul>
                            {:else}
                                <span class="text-gray-500">لا يوجد</span>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}