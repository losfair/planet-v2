<script lang="ts">
	import { untrack } from 'svelte';
	import TagList from './TagList.svelte';
	import LensPanel from './LensPanel.svelte';

	let {
		username,
		defaultActive = 0,
		allowUnselect = false
	}: {
		username: string;
		defaultActive?: number | null;
		allowUnselect?: boolean;
	} = $props();

	type Tab = { name: string; kind: 'tags' | 'lens' };
	const tabs = $derived(
		[
			{ name: 'Tags', kind: 'tags' as const },
			{ name: 'Lens', kind: 'lens' as const }
		].filter(Boolean) as Tab[]
	);

	let active = $state<number | null>(untrack(() => defaultActive));
	$effect(() => {
		if (active !== null && active >= tabs.length) active = defaultActive;
	});

	function selectTab(index: number) {
		active = allowUnselect && active === index ? null : index;
	}
</script>

<div class="sidebar">
	<div class="tablist">
		{#each tabs as tab, i (tab.name)}
			<button class="tab" class:selected={active === i} onclick={() => selectTab(i)}>{tab.name}</button
			>
		{/each}
	</div>
	<div class="panel">
		{#if active !== null && tabs[active]?.kind === 'tags'}
			<TagList {username} />
		{:else if active !== null && tabs[active]?.kind === 'lens'}
			<LensPanel {username} />
		{/if}
	</div>
</div>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 5px 0;
	}
	.tablist {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		flex-wrap: wrap;
	}
	.tab {
		border: none;
		background: transparent;
		color: var(--text);
		font-weight: 600;
		font-size: 14px;
		padding: 6px 12px;
		border-radius: 999px;
		cursor: pointer;
	}
	.tab.selected {
		background: var(--tab-bg);
	}
</style>
