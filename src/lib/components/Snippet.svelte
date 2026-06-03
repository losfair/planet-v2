<script lang="ts">
	import { getContext } from 'svelte';
	import { loadJson } from '$lib/client/api';
	import { toast } from '$lib/client/toast.svelte';
	import { formatDate, isoDate } from '$lib/client/format';
	import { notePopup } from '$lib/client/notePopup.svelte';
	import type { ApiBasicUserInfo, RenderableSnippet } from '$lib/types';
	import NoteContent from './NoteContent.svelte';
	import DashWrite from './DashWrite.svelte';
	import Menu from './Menu.svelte';
	import MenuItem from './MenuItem.svelte';

	let {
		snippet,
		pinned = false,
		flatBorder = false,
		nested = false,
		noBacklinks = false,
		expandedView = false,
		isTopNote = false,
		onChanged = () => {}
	}: {
		snippet: RenderableSnippet;
		pinned?: boolean;
		flatBorder?: boolean;
		nested?: boolean;
		noBacklinks?: boolean;
		expandedView?: boolean;
		isTopNote?: boolean;
		onChanged?: () => void;
	} = $props();

	const currentUser = getContext<{ value: ApiBasicUserInfo | null }>('currentUser');
	const isOwner = $derived(currentUser?.value?.username === snippet.username);

	let editing = $state(false);

	const shareLink = $derived(
		(typeof location !== 'undefined' ? location.origin : '') +
			`/people/${snippet.username}/${snippet.id}`
	);

	function copyLink() {
		navigator.clipboard.writeText(shareLink);
		toast.show({ title: 'Link copied', description: 'Copied to clipboard.', status: 'success' });
	}
	function openNote() {
		notePopup.open(`${snippet.username}/${snippet.id}`);
	}
	function openGraph() {
		const q = encodeURIComponent(JSON.stringify({ type: 'hasId', id: snippet.id }));
		window.open(`/people/${snippet.username}/graph?q=${q}`);
	}

	async function setPin(pin: boolean) {
		if (!confirm(pin ? 'Pin this note?' : 'Unpin this note?')) return;
		try {
			await loadJson('/me/api/v1/set_top_note', { noteId: pin ? snippet.id : '' });
			toast.show({ title: pin ? 'Note pinned.' : 'Note unpinned.', status: 'success' });
			onChanged();
		} catch {
			toast.show({ title: 'Error', status: 'error' });
		}
	}

	async function doDelete() {
		if (!confirm("Delete this note? You can't undo this.")) return;
		try {
			await loadJson('/me/api/v1/delete_note', { id: snippet.id });
			onChanged();
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		}
	}
</script>

{#if editing}
	<DashWrite
		username={snippet.username}
		editingId={snippet.id}
		initialContent={snippet.markdown}
		initialPublic={!snippet.private}
		{expandedView}
		onCancel={() => (editing = false)}
		onSaved={() => {
			editing = false;
			onChanged();
		}}
	/>
{:else}
	<div class="notebox" class:pinned class:flat={flatBorder} ondblclick={openNote} role="article">
		<NoteContent {snippet} />

		{#if !noBacklinks && snippet.backlinks?.length}
			<table class="backlinks">
				<thead>
					<tr><th>🔗 Backlinks</th></tr>
				</thead>
				<tbody>
					{#each snippet.backlinks as bl (bl.username + '/' + bl.fullId)}
						<tr>
							<td>
								<a
									href={`/people/${bl.username}/${bl.fullId}`}
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										notePopup.open(`${bl.username}/${bl.fullId}`);
									}}>{bl.title || `${bl.username}/${bl.fullId}`}</a
								>
								<div class="bl-meta">
									<a href={`/people/${bl.username}/notes`}>@{bl.username}</a>
									<span>{bl.fullId.substring(0, 10)}</span>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		<div class="footer">
			<div class="left">
				<a class="uname" href={`/people/${snippet.username}/notes`}>@{snippet.username}</a>
				{#if snippet.private}
					<span class="lock" title="Private note" aria-label="Private">🔒</span>
				{/if}
			</div>
			<div class="right">
				<span class="date">
					{isOwner ? formatDate(new Date(snippet.utcDate)) : isoDate(new Date(snippet.utcDate))}
				</span>
				<Menu align="end">
					{#snippet trigger()}
						<span class="dots" aria-label="More">⋯</span>
					{/snippet}
					<MenuItem onclick={openNote}>Open</MenuItem>
					<MenuItem onclick={openGraph}>Graph</MenuItem>
					<MenuItem onclick={copyLink}>Copy URL</MenuItem>
					{#if isOwner}
						<MenuItem divider />
						{#if isTopNote}
							<MenuItem onclick={() => setPin(false)}>Unpin</MenuItem>
						{:else}
							<MenuItem onclick={() => setPin(true)}>Pin</MenuItem>
						{/if}
						<MenuItem color="var(--chakra-colors-blue-600)" onclick={() => (editing = true)}
							>Edit</MenuItem
						>
						<MenuItem color="var(--chakra-colors-red-500)" onclick={doDelete}>Delete</MenuItem>
					{/if}
				</Menu>
			</div>
		</div>
	</div>
{/if}

<style>
	.notebox {
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--card-bg);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		padding: 16px 12px 8px;
		transition: box-shadow 0.15s ease;
	}
	.notebox:not(.flat):hover {
		box-shadow: var(--shadow-snippetHover);
	}
	.notebox.flat {
		box-shadow: none;
		border: 1px solid var(--border);
	}
	.notebox.pinned {
		border: 1px solid var(--chakra-colors-orange-400);
	}
	.footer {
		display: flex;
		align-items: center;
		color: var(--chakra-colors-gray-400);
		height: 24px;
		font-size: 12px;
	}
	.left {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
	}
	.uname {
		font-size: 12px;
		color: var(--chakra-colors-gray-400);
		text-decoration: none;
	}
	.uname:hover {
		text-decoration: underline;
	}
	.lock {
		font-size: 11px;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.dots {
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
		color: var(--chakra-colors-gray-400);
		padding: 0 2px;
	}
	.backlinks {
		width: 100%;
		font-size: 13px;
		border-collapse: collapse;
	}
	.backlinks th {
		text-align: left;
		color: var(--text-secondary);
		font-weight: 600;
		padding: 4px 0;
	}
	.backlinks td {
		padding: 4px 0;
	}
	.backlinks a {
		color: var(--accent);
		text-decoration: none;
	}
	.bl-meta {
		display: flex;
		gap: 16px;
		font-size: 12px;
		color: var(--chakra-colors-gray-500);
		margin-top: 2px;
	}
</style>
