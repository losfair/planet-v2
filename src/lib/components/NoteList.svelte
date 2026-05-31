<script lang="ts">
	import type { Snippet as SnippetType } from 'svelte';
	import type { RenderableSnippet } from '$lib/types';
	import { browser } from '$app/environment';
	import Snippet from './Snippet.svelte';
	import SkeletonText from './SkeletonText.svelte';

	let {
		notes,
		topNote = null,
		writeBox = undefined,
		hasMore = false,
		moreBusy = false,
		loadMore = () => {},
		onChanged = () => {}
	}: {
		notes: RenderableSnippet[];
		topNote?: RenderableSnippet | null;
		writeBox?: SnippetType;
		hasMore?: boolean;
		moreBusy?: boolean;
		loadMore?: () => void;
		onChanged?: () => void;
	} = $props();

	let numColumns = $state(1);

	// FNV-1a 32-bit — same stable hash the original used for column placement.
	function fnv1a(str: string): number {
		let h = 0x811c9dc5;
		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}
		return h >>> 0;
	}

	function computeColumns() {
		if (!browser) return;
		const w = window.innerWidth;
		if (w < 768) numColumns = 1;
		else if (w >= 1600) numColumns = 4;
		else if (w >= 1300) numColumns = 3;
		else if (w >= 1050) numColumns = 2;
		else numColumns = 1;
	}

	$effect(() => {
		computeColumns();
		window.addEventListener('resize', computeColumns);
		return () => window.removeEventListener('resize', computeColumns);
	});

	const columns = $derived.by(() => {
		const cols: RenderableSnippet[][] = Array.from({ length: numColumns }, () => []);
		for (const n of notes) {
			const key = `${numColumns}:${n.username}/${n.id}`;
			cols[fnv1a(key) % numColumns].push(n);
		}
		// Balance column lengths (mirrors the original balancing pass).
		for (;;) {
			let maxI = 0,
				minI = 0;
			cols.forEach((c, i) => {
				if (c.length > cols[maxI].length) maxI = i;
				if (c.length < cols[minI].length) minI = i;
			});
			if (cols[maxI].length - cols[minI].length <= 1) break;
			const move = Math.floor((cols[maxI].length - cols[minI].length) / 2);
			cols[minI].push(...cols[maxI].splice(cols[maxI].length - move, move));
		}
		for (const c of cols)
			c.sort((a, b) => -(a.username + '/' + a.id).localeCompare(b.username + '/' + b.id));
		return cols;
	});

	// Infinite scroll: load more when the sentinel approaches the viewport.
	let sentinel = $state<HTMLDivElement>();
	$effect(() => {
		if (!sentinel || !browser) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !moreBusy) loadMore();
			},
			{ rootMargin: '400px' }
		);
		obs.observe(sentinel);
		return () => obs.disconnect();
	});
</script>

<div class="grid" style="grid-template-columns: repeat({numColumns}, 1fr)">
	{#each columns as col, ci (ci)}
		<div class="col">
			{#if ci === 0 && writeBox}
				<div class="item">{@render writeBox()}</div>
			{/if}
			{#if ci === 0 && topNote}
				<div class="item"><Snippet snippet={topNote} pinned isTopNote {onChanged} /></div>
			{/if}
			{#each col as note (note.username + '/' + note.id)}
				<div class="item"><Snippet snippet={note} nested {onChanged} /></div>
			{/each}
		</div>
	{/each}
</div>

{#if hasMore}
	<div bind:this={sentinel} class="sentinel">
		{#if moreBusy}<SkeletonText lines={3} />{/if}
	</div>
{/if}

<style>
	.grid {
		display: grid;
		gap: 8px;
		width: 100%;
	}
	.col {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.item {
		padding-bottom: 10px;
	}
	.sentinel {
		min-height: 20px;
		padding-top: 10px;
	}
</style>
