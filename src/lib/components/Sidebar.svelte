<script lang="ts">
	import { untrack } from 'svelte';
	import TagList from './TagList.svelte';
	import LensPanel from './LensPanel.svelte';
	import { urlRegex } from '$lib/client/format';

	let {
		username,
		description = '',
		defaultActive = 0,
		allowUnselect = false
	}: {
		username: string;
		description?: string;
		defaultActive?: number | null;
		allowUnselect?: boolean;
	} = $props();

	type Tab = { name: string; kind: 'tags' | 'lens' | 'author' };
	const tabs = $derived(
		[
			{ name: 'Tags', kind: 'tags' as const },
			{ name: 'Lens', kind: 'lens' as const },
			description ? { name: 'Author', kind: 'author' as const } : null
		].filter(Boolean) as Tab[]
	);

	let active = $state<number | null>(untrack(() => defaultActive));
	$effect(() => {
		if (active !== null && active >= tabs.length) active = defaultActive;
	});

	function selectTab(index: number) {
		active = allowUnselect && active === index ? null : index;
	}

	// Linkify description text.
	function linkify(text: string): { text: string; href?: string }[] {
		const out: { text: string; href?: string }[] = [];
		let last = 0;
		let m: RegExpExecArray | null;
		urlRegex.lastIndex = 0;
		while ((m = urlRegex.exec(text))) {
			out.push({ text: text.slice(last, m.index) });
			out.push({ text: m[0], href: m[0] });
			last = m.index + m[0].length;
		}
		out.push({ text: text.slice(last) });
		return out;
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
		{:else if active !== null && tabs[active]?.kind === 'author'}
			<div class="author">
				<p class="bio">
					{#each linkify(description) as part}{#if part.href}<a
								href={part.href}
								target="_blank"
								rel="noopener">{part.text}</a
							>{:else}{part.text}{/if}{/each}
				</p>
				<p class="handle">@{username}</p>
			</div>
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
	.author {
		background: var(--author-bg);
		border-radius: var(--radius-lg);
		padding: 20px;
	}
	.bio {
		white-space: pre-line;
		margin: 0;
	}
	.bio a {
		text-decoration: underline;
		color: var(--accent);
	}
	.handle {
		font-size: 14px;
		opacity: 0.6;
		margin: 8px 0 0;
	}
</style>
