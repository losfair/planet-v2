<script lang="ts">
	import { loadJson } from '$lib/client/api';
	import { notePopup } from '$lib/client/notePopup.svelte';
	import type { ApiGetSnippetsRsp, RenderableSnippet } from '$lib/types';
	import Modal from './Modal.svelte';
	import Snippet from './Snippet.svelte';
	import SkeletonText from './SkeletonText.svelte';

	let { onChanged = () => {} }: { onChanged?: () => void } = $props();

	let note = $state<RenderableSnippet | null>(null);
	let loading = $state(false);

	$effect(() => {
		const idw = notePopup.idWithUsername;
		if (!idw) {
			note = null;
			return;
		}
		const [u, id] = idw.split('/');
		loading = true;
		note = null;
		loadJson<ApiGetSnippetsRsp>(
			`/api/v1/notes?username=${encodeURIComponent(u)}&id=${encodeURIComponent(id)}`
		)
			.then((r) => (note = r.snippets[0] ?? null))
			.catch(() => (note = null))
			.finally(() => (loading = false));
	});
</script>

<Modal open={!!notePopup.idWithUsername} onClose={() => notePopup.close()} maxWidth="42rem">
	{#if loading}
		<SkeletonText lines={5} />
	{:else if note}
		<Snippet snippet={note} flatBorder expandedView {onChanged} />
	{:else}
		<p>This note does not exist or you do not have permission to view it.</p>
	{/if}
</Modal>
