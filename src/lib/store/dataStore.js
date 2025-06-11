import { writable } from 'svelte/store';

export const medicines = writable([]);
export const requests = writable([]);
export const staff = writable([]);
export const searchMedicines = writable([]);
export const searchQuery = writable('');
export const userLocation = writable('');
