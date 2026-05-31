<script lang="ts">
	import PeoplePage from '$lib/components/PeoplePage.svelte';
	let { data } = $props();
</script>

{#key data.tag}
	<PeoplePage
		username={data.username}
		publicInfo={data.publicInfo}
		data={data.data}
		initialSearch={'#' + data.tag}
	/>
{/key}
