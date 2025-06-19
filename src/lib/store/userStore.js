import { writable } from 'svelte/store';

export const userStore = writable({
    uid: null,
    displayName: '',
    email: '',
    role: '',
});