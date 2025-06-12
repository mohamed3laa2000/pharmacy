import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { writable, derived, get } from 'svelte/store';
import { userLocation } from '$lib/store/dataStore';

// Fetch all medicines
export async function fetchMedicines() {
	const location = get(userLocation);
	if (!location || !location.pharmacyId) {
		throw new Error('Pharmacy location not set');
	}
	const medicinesRef = collection(db, 'Pharmacies', location.pharmacyId, 'medicines');
	const snapshot = await getDocs(medicinesRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function fetchCatalog() {
	const medicinesCatalogRef = collection(db, 'medicinesCatalog');
	const snapshot = await getDocs(medicinesCatalogRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Search medicines by name (case-insensitive)
export async function searchMedicines(searchTerm) {
	const location = get(userLocation);
	if (!location || !location.pharmacyId) {
		throw new Error('Pharmacy location not set');
	}
	const medicinesRef = collection(db, 'Pharmacies', location.pharmacyId, 'medicines');
	const q = query(
		medicinesRef,
		where('name', '>=', searchTerm),
		where('name', '<=', searchTerm + '\uf8ff')
	);
	const snapshot = await getDocs(q);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Fetch batches for a specific medicine
export async function fetchBatchesForMedicine(medicineId) {
	const location = get(userLocation);
	if (!location || !location.pharmacyId) {
		throw new Error('Pharmacy location not set');
	}
	const batchesRef = collection(
		db,
		'Pharmacies',
		location.pharmacyId,
		`medicines/${medicineId}/batches`
	);
	const snapshot = await getDocs(batchesRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Fetch all requests
export async function fetchRequests() {
	const location = get(userLocation);
	if (!location || !location.pharmacyId) {
		throw new Error('Pharmacy location not set');
	}
	const requestsRef = collection(db, 'Pharmacies', location.pharmacyId, 'requests');
	const snapshot = await getDocs(requestsRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Fetch all doctors/nurses
export async function fetchStaff() {
	const location = get(userLocation);
	if (!location || !location.pharmacyId) {
		throw new Error('Pharmacy location not set');
	}
	const usersRef = collection(db, 'Pharmacies', location.pharmacyId, 'staff');
	const snapshot = await getDocs(usersRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function fetchAllBatches() {
	const location = get(userLocation);
	if (!location || !location.pharmacyId) {
		throw new Error('Pharmacy location not set');
	}
	const batchesRef = collection(db, 'Pharmacies', location.pharmacyId, 'batches');
	const snapshot = await getDocs(batchesRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function fetchPharmacies() {
	const pharmaciesRef = collection(db, 'Pharmacies');
	const snapshot = await getDocs(pharmaciesRef);
	return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
