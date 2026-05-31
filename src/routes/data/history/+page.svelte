<script lang="ts">
	import { loadJson } from '$lib/client/api';
	import { formatDate } from '$lib/client/format';
	import Button from '$lib/components/Button.svelte';
	import SkeletonText from '$lib/components/SkeletonText.svelte';

	let { data } = $props();

	interface Entry {
		seq: number;
		ts: number;
		type: string;
		noteId: string | null;
		value: string;
	}
	let entries = $state<Entry[] | null>(null);
	let cursor = $state<string | null>(null);
	let busy = $state(false);

	async function load(extend: boolean) {
		busy = true;
		try {
			const r = await loadJson<{ history: Entry[]; cursor: string | null }>(
				`/me/api/v1/history${extend && cursor ? `?cursor=${cursor}` : ''}`
			);
			entries = extend && entries ? [...entries, ...r.history] : r.history;
			cursor = r.cursor;
		} finally {
			busy = false;
		}
	}
	$effect(() => {
		load(false);
	});
</script>

<svelte:head><title>Version history · Planet</title></svelte:head>

<div class="page">
	<header>
		<a class="logo" href={`/people/${data.username}/notes`}><img src="/icon.svg" alt="" width="26" /></a>
		<h1>Version history</h1>
	</header>
	<p class="muted">Mutation logs from the last 90 days. Only visible to you.</p>

	{#if entries === null}
		<SkeletonText lines={6} />
	{:else if entries.length === 0}
		<p class="muted">No history yet.</p>
	{:else}
		<table>
			<thead>
				<tr><th>When</th><th>Event</th><th>Note</th></tr>
			</thead>
			<tbody>
				{#each entries as e (e.seq)}
					<tr>
						<td class="when">{formatDate(new Date(e.ts))}</td>
						<td><span class="ev">{e.type}</span></td>
						<td class="note">
							{#if e.noteId}
								<a href={`/people/${data.username}/${e.noteId}`}>{e.noteId}</a>
							{:else}—{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if cursor}
			<div class="more"><Button colorScheme="gray" loading={busy} onclick={() => load(true)}>Load more</Button></div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
		padding: 24px 16px 60px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h1 {
		font-size: 24px;
		margin: 0;
	}
	.muted {
		color: var(--text-secondary);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 16px;
		font-size: 14px;
	}
	th {
		text-align: left;
		color: var(--text-secondary);
		font-weight: 600;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}
	td {
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}
	.when {
		white-space: nowrap;
		color: var(--text-secondary);
	}
	.ev {
		font-family: monospace;
	}
	.note a {
		color: var(--accent);
		text-decoration: none;
	}
	.more {
		margin-top: 16px;
	}
</style>
