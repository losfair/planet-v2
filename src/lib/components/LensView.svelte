<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadJson } from '$lib/client/api';
	import { toast } from '$lib/client/toast.svelte';
	import type {
		ApiBasicUserInfo,
		ApiLensInfo,
		RenderableSnippet
	} from '$lib/types';
	import NoteList from './NoteList.svelte';
	import SkeletonText from './SkeletonText.svelte';
	import Button from './Button.svelte';

	let { username, lensId }: { username: string; lensId: string } = $props();
	const currentUser = getContext<{ value: ApiBasicUserInfo | null }>('currentUser');
	const isOwner = $derived(currentUser?.value?.username === username);
	const isNew = $derived(lensId === 'new');

	let lens = $state<ApiLensInfo | null>(null);
	let notes = $state<RenderableSnippet[] | null>(null);
	let cursor = $state<string | null>(null);
	let numNotes = $state<number | null>(null);
	let busy = $state(false);

	// editor state
	let editing = $state(false);
	let edId = $state('');
	let edDesc = $state('');
	let edQuery = $state('');
	let edAccess = $state<ApiLensInfo['access']>('private');
	let saving = $state(false);

	async function loadResults(extend: boolean) {
		busy = true;
		try {
			const rsp = await loadJson<{
				output: RenderableSnippet[];
				cursor: string | null;
				lens: ApiLensInfo | null;
				summary?: { numNotes: number };
			}>(
				`/api/v1/lens/query?username=${encodeURIComponent(username)}&id=${encodeURIComponent(lensId)}&cursor=${encodeURIComponent(extend && cursor ? cursor : '')}`
			);
			notes = extend && notes ? [...notes, ...rsp.output] : rsp.output;
			cursor = rsp.cursor;
			lens = rsp.lens;
			if (rsp.summary) numNotes = rsp.summary.numNotes;
		} catch (e) {
			toast.show({ title: 'Lens error', description: String(e), status: 'error' });
		} finally {
			busy = false;
		}
	}

	$effect(() => {
		if (isNew) {
			editing = true;
			notes = [];
		} else {
			void lensId;
			loadResults(false);
		}
	});

	async function preview() {
		busy = true;
		try {
			const rsp = await loadJson<{ output: RenderableSnippet[]; cursor: string | null; summary?: { numNotes: number } }>(
				`/me/api/v1/lens/preview?q=${encodeURIComponent(edQuery)}`
			);
			notes = rsp.output;
			cursor = rsp.cursor;
			if (rsp.summary) numNotes = rsp.summary.numNotes;
		} catch (e) {
			toast.show({ title: 'Query error', description: String(e), status: 'error' });
		} finally {
			busy = false;
		}
	}

	async function save() {
		saving = true;
		try {
			const saved = await loadJson<ApiLensInfo>('/me/api/v1/lens/edit', {
				id: edId,
				description: edDesc,
				query: edQuery,
				access: edAccess,
				update: !isNew
			});
			toast.show({ title: 'Lens saved', status: 'success' });
			goto(`/people/${username}/lens/${saved.id}`);
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		} finally {
			saving = false;
		}
	}

	function startEdit() {
		if (!lens) return;
		edId = lens.id;
		edDesc = lens.description;
		edQuery = lens.query;
		edAccess = lens.access;
		editing = true;
	}
</script>

<div class="lensview">
	{#if editing}
		<div class="editor">
			<h2>{isNew ? 'New lens' : 'Edit lens'}</h2>
			<label>ID <input bind:value={edId} disabled={!isNew} placeholder="my-lens" /></label>
			<label>Description <input bind:value={edDesc} placeholder="What this lens shows" /></label>
			<label>
				Query
				<textarea bind:value={edQuery} rows="2" placeholder="tag work and public"></textarea>
			</label>
			<label>
				Access
				<select bind:value={edAccess}>
					<option value="private">Private</option>
					<option value="group">Group</option>
					<option value="public">Public</option>
					<option value="public-hidden">Public (hidden)</option>
				</select>
			</label>
			<div class="ed-actions">
				<Button colorScheme="gray" onclick={preview}>Preview</Button>
				<Button colorScheme="teal" loading={saving} disabled={!edId || !edQuery} onclick={save}
					>Save</Button
				>
			</div>
		</div>
	{:else if lens}
		<div class="lens-head">
			<div>
				<div class="lens-title">{lens.description || lens.id}</div>
				<div class="lens-query">{lens.query}</div>
			</div>
			{#if isOwner}
				<Button size="sm" colorScheme="gray" onclick={startEdit}>Edit</Button>
			{/if}
		</div>
	{/if}

	{#if numNotes !== null}
		<p class="count">{numNotes} note{numNotes === 1 ? '' : 's'}</p>
	{/if}

	{#if notes === null}
		<SkeletonText />
	{:else}
		<NoteList
			{notes}
			hasMore={!!cursor}
			moreBusy={busy}
			loadMore={() => loadResults(true)}
			onChanged={() => loadResults(false)}
		/>
	{/if}
</div>

<style>
	.lensview {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.editor {
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 16px;
	}
	.editor h2 {
		margin: 0;
		font-size: 18px;
	}
	.editor label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
		color: var(--text-secondary);
	}
	.editor input,
	.editor textarea,
	.editor select {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--text);
		font: inherit;
	}
	.ed-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
	.lens-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.lens-title {
		font-size: 18px;
		font-weight: bold;
		color: var(--accent);
	}
	.lens-query {
		font-family: monospace;
		font-size: 13px;
		color: var(--text-secondary);
	}
	.count {
		color: var(--text-secondary);
		font-size: 14px;
		margin: 0;
	}
</style>
