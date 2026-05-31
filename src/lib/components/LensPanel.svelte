<script lang="ts">
	import { getContext } from 'svelte';
	import { loadJson } from '$lib/client/api';
	import type { ApiBasicUserInfo, ApiLensInfo } from '$lib/types';
	import SkeletonText from './SkeletonText.svelte';

	let { username }: { username: string } = $props();
	const currentUser = getContext<{ value: ApiBasicUserInfo | null }>('currentUser');
	const isOwner = $derived(currentUser?.value?.username === username);

	let lenses = $state<ApiLensInfo[] | null>(null);

	$effect(() => {
		let cancelled = false;
		loadJson<{ lenses: ApiLensInfo[] }>(`/api/v1/lens/list?username=${encodeURIComponent(username)}`)
			.then((r) => {
				if (!cancelled) lenses = r.lenses;
			})
			.catch(() => {
				if (!cancelled) lenses = [];
			});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if lenses === null}
	<SkeletonText />
{:else}
	<div class="lenses">
		{#if lenses.length === 0}
			<p class="empty">
				No <a class="link" href="https://docs.planet.ink/organizing-notes/lens">lenses</a> yet
			</p>
		{/if}
		{#each lenses as lens (lens.id)}
			<a class="lens" href={`/people/${username}/lens/${lens.id}`}>
				<div class="lens-name">{lens.description || lens.id}</div>
				<div class="lens-q">{lens.query}</div>
				<div class="lens-access">{lens.access}</div>
			</a>
		{/each}
		{#if isOwner}
			<a class="new-lens" href={`/people/${username}/lens/new`}>＋ New lens</a>
		{/if}
	</div>
{/if}

<style>
	.lenses {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.empty {
		color: var(--text-secondary);
		font-size: 15px;
	}
	.link {
		color: var(--accent);
	}
	.lens {
		display: block;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 10px 12px;
		text-decoration: none;
		color: var(--text);
	}
	.lens:hover {
		background: var(--hover-bg);
	}
	.lens-name {
		font-weight: 600;
	}
	.lens-q {
		font-size: 13px;
		color: var(--text-secondary);
		font-family: monospace;
		margin-top: 2px;
		word-break: break-word;
	}
	.lens-access {
		font-size: 11px;
		color: var(--text-secondary);
		text-transform: uppercase;
		margin-top: 4px;
	}
	.new-lens {
		font-size: 14px;
		color: var(--accent);
		text-decoration: none;
		padding: 4px 0;
	}
</style>
