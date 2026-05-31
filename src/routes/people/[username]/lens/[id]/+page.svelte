<script lang="ts">
	import PeoplePage from '$lib/components/PeoplePage.svelte';
	import LensView from '$lib/components/LensView.svelte';
	let { data } = $props();
</script>

<PeoplePage username={data.username} publicInfo={data.publicInfo} data={data.data}>
	{#snippet primaryContent()}
		{#key data.lensId}
			<LensView username={data.username} lensId={data.lensId} />
		{/key}
	{/snippet}
</PeoplePage>
