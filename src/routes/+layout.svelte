<script lang="ts">
	import '../app.css';
	import { onMount, setContext } from 'svelte';
	import { colorMode } from '$lib/client/colorMode.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import type { ApiBasicUserInfo } from '$lib/types';

	let { data, children } = $props();

	// Expose the current (logged-in) user to descendant components.
	const currentUser = { value: data.user as ApiBasicUserInfo | null };
	setContext('currentUser', currentUser);
	$effect(() => {
		currentUser.value = data.user as ApiBasicUserInfo | null;
	});

	onMount(() => colorMode.init());
</script>

<Toaster />
{@render children()}
