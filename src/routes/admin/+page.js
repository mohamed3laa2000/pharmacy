import { get } from 'svelte/store';
import { userStore } from '$lib/store/userStore';
import { redirect } from '@sveltejs/kit';

export function load() {
    if (get(userStore).role !== 'admin') {
        throw redirect(302, '/dashboard');
    }
}
