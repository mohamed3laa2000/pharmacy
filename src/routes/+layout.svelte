<script>
	import '../app.css';
	import { onAuthStateChanged } from 'firebase/auth';
	import { auth, db } from '$lib/firebase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { doc, getDoc } from 'firebase/firestore';
	import { userStore } from '$lib/store/userStore';

	let authReady = false;

	onMount(() => {
		onAuthStateChanged(auth, async (user) => {
			if (user) {
				const userDoc = await getDoc(doc(db, 'Users', user.uid));
				if (userDoc.exists()) {
					userStore.set({
						uid: user.uid,
						displayName: userDoc.data().displayName,
						email: userDoc.data().email,
						role: userDoc.data().role
					});
				}
			} else {
				userStore.set({
					uid: null,
					displayName: '',
					email: '',
					role: ''
				});
				if (window.location.pathname !== '/login') {
					goto('/login');
				}
			}
			authReady = true;
		});
	});

	async function logout() {
		await auth.signOut();
		goto('/login');
	}
</script>

{#if !authReady}
	<div class="flex items-center justify-center h-screen">
		<p>جاري التحقق من الجلسة...</p>
	</div>
{:else}
	<slot></slot>
{/if}
