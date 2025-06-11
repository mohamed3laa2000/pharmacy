import { getAuth } from 'firebase/auth';
import { app } from '$lib/firebase';
import { redirect } from '@sveltejs/kit';

export async function load() {
	const auth = getAuth(app);

	return new Promise((resolve) => {
		const unsubscribe = auth.onAuthStateChanged((user) => {
			unsubscribe();

			if (!user) {
				// 🚫 Not logged in → redirect to login
				throw redirect(302, '/login');
			}

			// ✅ Logged in → continue loading the page
			resolve({ user });
		});
	});
}
