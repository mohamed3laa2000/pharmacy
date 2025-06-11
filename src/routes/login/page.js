import { getAuth } from 'firebase/auth';
import { app } from '$lib/firebase';
import { redirect } from '@sveltejs/kit';

export async function load() {
	const auth = getAuth(app);

	return new Promise((resolve) => {
		const unsubscribe = auth.onAuthStateChanged((user) => {
			unsubscribe();

			if (user) {
				// ✅ Already logged in → redirect away from login page
				throw redirect(302, '/dashboard');
			}

			// 🚫 Not logged in → allow access to login page
			resolve({});
		});
	});
}
