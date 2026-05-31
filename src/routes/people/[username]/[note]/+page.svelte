<script lang="ts">
	import PeoplePage from '$lib/components/PeoplePage.svelte';
	let { data } = $props();
</script>

<PeoplePage
	username={data.username}
	publicInfo={data.publicInfo}
	data={data.data}
	openNoteId={data.noteId}
/>
