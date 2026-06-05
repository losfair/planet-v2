<script lang="ts">
	import '../app.css';
	import { setContext, untrack } from 'svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import type { ApiBasicUserInfo } from '$lib/types';

	let { data, children } = $props();

	// Expose the current (logged-in) user to descendant components.
	const currentUser = { value: untrack(() => data.user) as ApiBasicUserInfo | null };
	setContext('currentUser', currentUser);
	$effect(() => {
		currentUser.value = data.user as ApiBasicUserInfo | null;
	});

</script>

<Toaster />
{@render children()}
