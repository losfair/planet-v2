<script lang="ts">
	import { getContext, onMount, type Snippet as SnippetT } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { loadJson, ApiError } from '$lib/client/api';
	import { toast } from '$lib/client/toast.svelte';
	import { notePopup } from '$lib/client/notePopup.svelte';
	import type {
		ApiBasicUserInfo,
		ApiGetSnippetsRsp,
		ApiSearchNoteRsp,
		ApiUserInfo,
		PublicUserInfo,
		RenderableSnippet
	} from '$lib/types';
	import Sidebar from './Sidebar.svelte';
	import Search from './Search.svelte';
	import NoteList from './NoteList.svelte';
	import DashWrite from './DashWrite.svelte';
	import Snippet from './Snippet.svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import UserMenu from './UserMenu.svelte';
	import SkeletonText from './SkeletonText.svelte';

	let {
		username,
		publicInfo,
		data,
		openNoteId = '',
		initialSearch = '',
		primaryContent = undefined
	}: {
		username: string;
		publicInfo: ApiUserInfo<PublicUserInfo>;
		data: ApiGetSnippetsRsp;
		openNoteId?: string;
		initialSearch?: string;
		primaryContent?: SnippetT;
	} = $props();

	const currentUser = getContext<{ value: ApiBasicUserInfo | null }>('currentUser');
	const isOwner = $derived(currentUser?.value?.username === username);
	const displayName = $derived(publicInfo.displayName || username);

	// Apply the author's preferred content font to their notes (matches original).
	const noteFont = $derived(
		publicInfo.contentFontFamily === 'serif'
			? 'Georgia, Cambria, "Times New Roman", serif'
			: publicInfo.contentFontFamily === 'monospace'
				? 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace'
				: 'inherit'
	);

	// --- note list state ---
	let notes = $state<RenderableSnippet[]>(data.snippets);
	let cursor = $state<string | null>(data.cursor);
	let topNote = $state<RenderableSnippet | null>(data.topNote);
	let moreBusy = $state(false);

	$effect(() => {
		// Reset when navigating to a different user / fresh data.
		notes = data.snippets;
		cursor = data.cursor;
		topNote = data.topNote;
	});

	async function loadMore() {
		if (!cursor || moreBusy) return;
		moreBusy = true;
		try {
			const rsp = await loadJson<ApiGetSnippetsRsp>(
				`/api/v1/notes?username=${encodeURIComponent(username)}&cursor=${encodeURIComponent(cursor)}`
			);
			notes = [...notes, ...rsp.snippets];
			cursor = rsp.cursor;
		} catch {
			cursor = null;
		} finally {
			moreBusy = false;
		}
	}

	function refresh() {
		invalidate((url) => url.pathname.startsWith('/api/v1/notes') || url.pathname === location.pathname);
		// Hard refresh of the page data.
		loadJson<ApiGetSnippetsRsp>(`/api/v1/notes?username=${encodeURIComponent(username)}`).then((r) => {
			notes = r.snippets;
			cursor = r.cursor;
			topNote = r.topNote;
		});
	}

	// --- search ---
	let searchText = $state(initialSearch);
	let searchResults = $state<RenderableSnippet[] | null>(null);
	let searchCursor = $state<string | null>(null);
	let searchBusy = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		const text = searchText.trim();
		clearTimeout(searchTimer);
		if (!text) {
			searchResults = null;
			return;
		}
		searchTimer = setTimeout(() => runSearch(text, false), 500);
	});

	async function runSearch(text: string, extend: boolean) {
		searchBusy = true;
		try {
			const rsp = await loadJson<ApiSearchNoteRsp>(
				`/api/v1/search_note/${encodeURIComponent(username)}?keyword=${encodeURIComponent(text.toLowerCase())}&before=${encodeURIComponent(extend && searchCursor ? searchCursor : '')}`
			);
			searchResults = extend && searchResults ? [...searchResults, ...rsp.notes] : rsp.notes;
			searchCursor = rsp.cursor;
		} catch (e) {
			toast.show({ title: 'Search error', description: String(e), status: 'error' });
		} finally {
			searchBusy = false;
		}
	}

	// --- follow ---
	let followOverride = $state<boolean | undefined>(undefined);
	const isFollowing = $derived(
		followOverride === undefined ? !!publicInfo.followedByYou : followOverride
	);
	let followBusy = $state(false);
	const canFollow = $derived(
		!!currentUser?.value?.username && currentUser.value.username !== username
	);

	async function toggleFollow() {
		followBusy = true;
		try {
			if (isFollowing) {
				if (!confirm(`Unfollow @${username}?`)) {
					followBusy = false;
					return;
				}
				await loadJson('/me/api/v1/follow_control/unfollow', { peer: username });
				followOverride = false;
			} else {
				await loadJson('/me/api/v1/follow_control/follow', { peer: username });
				followOverride = true;
			}
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		} finally {
			followBusy = false;
		}
	}

	// --- note popup ---
	let popupNote = $state<RenderableSnippet | null>(null);
	let popupLoading = $state(false);

	onMount(() => {
		if (openNoteId) notePopup.open(`${username}/${openNoteId}`);
	});

	$effect(() => {
		const idw = notePopup.idWithUsername;
		if (!idw) {
			popupNote = null;
			return;
		}
		const [u, id] = idw.split('/');
		popupLoading = true;
		popupNote = null;
		loadJson<ApiGetSnippetsRsp>(
			`/api/v1/notes?username=${encodeURIComponent(u)}&id=${encodeURIComponent(id)}`
		)
			.then((r) => {
				popupNote = r.snippets[0] ?? null;
			})
			.catch(() => {
				popupNote = null;
			})
			.finally(() => {
				popupLoading = false;
			});
	});

	function closePopup() {
		notePopup.close();
		if (openNoteId) history.replaceState(null, '', `/people/${username}/notes`);
	}
</script>

<svelte:head><title>{displayName}'s Planet</title></svelte:head>

<div class="people-root" style="--note-font: {noteFont}">
	<!-- Desktop sidebar -->
	<aside class="sidebar-fixed">
		<div class="side-head">
			<a class="logo" href="/" aria-label="Planet"><img src="/icon.svg" alt="" width="26" /></a>
			<div class="who">
				<a class="dn" href={`/people/${username}/notes`}>{displayName}</a>
				<span class="handle">@{username}</span>
			</div>
			{#if canFollow}
				<Button
					size="sm"
					colorScheme="blue"
					variant={isFollowing ? 'outline' : 'solid'}
					loading={followBusy}
					onclick={toggleFollow}>{isFollowing ? 'Following' : 'Follow'}</Button
				>
			{/if}
		</div>
		<div class="side-scroll">
			<Sidebar {username} description={publicInfo.description} />
		</div>
		<div class="side-foot">
			<UserMenu wide />
			<a
				class="ico"
				href={`/feed/${username}.xml`}
				target="_blank"
				rel="noopener"
				title="RSS"
				aria-label="RSS"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
					><circle cx="5" cy="19" r="2" /><path
						d="M4 10a10 10 0 0110 10h-3A7 7 0 004 13zM4 4a16 16 0 0116 16h-3A13 13 0 004 7z"
					/></svg
				>
			</a>
			<a class="ico" href={`/people/${username}/graph`} title="Graph view" aria-label="Graph view">
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
					<circle cx="5" cy="6" r="2.2" />
					<circle cx="18" cy="7" r="2.2" />
					<circle cx="12" cy="18" r="2.2" />
					<path d="M7 6.6 10.5 16M16.2 8.4 13.2 16.4M7.1 6.2 15.9 6.9" />
				</svg>
			</a>
		</div>
	</aside>

	<!-- Mobile header -->
	<div class="mobile-head">
		<a class="logo" href="/"><img src="/icon.svg" alt="" width="26" /></a>
		<span class="chev">›</span>
		<a class="dn" href={`/people/${username}/notes`}>{displayName}</a>
		<span class="spacer"></span>
		<UserMenu />
	</div>

	<main class="content">
		<div class="mobile-sidebar">
			<Sidebar {username} description={publicInfo.description} showSearch bind:searchText />
		</div>

		{#if primaryContent}
			{@render primaryContent()}
		{:else}
			<div class="desktop-search">
				<Search bind:value={searchText} />
			</div>

			{#if searchText.trim()}
				<div class="search-results">
					<div class="search-head">
						<span class="search-title">
							{searchText.startsWith('#') ? 'Tag' : 'Search'}: &quot;{searchText}&quot;
						</span>
						{#if searchBusy}<span class="busy"></span>{/if}
					</div>
					{#if searchResults}
						<NoteList
							notes={searchResults}
							hasMore={!!searchCursor}
							moreBusy={searchBusy}
							loadMore={() => runSearch(searchText.trim(), true)}
							onChanged={refresh}
						/>
					{:else}
						<SkeletonText />
					{/if}
				</div>
			{:else}
				<NoteList
					{notes}
					{topNote}
					hasMore={!!cursor}
					{moreBusy}
					{loadMore}
					onChanged={refresh}
					writeBox={isOwner ? writeBox : undefined}
				/>
			{/if}
		{/if}
	</main>
</div>

{#snippet writeBox()}
	<DashWrite {username} onSaved={refresh} />
{/snippet}

<!-- Single-note popup -->
<Modal open={!!notePopup.idWithUsername} onClose={closePopup} maxWidth="42rem">
	{#if popupLoading}
		<SkeletonText lines={5} />
	{:else if popupNote}
		<Snippet snippet={popupNote} flatBorder expandedView onChanged={refresh} />
	{:else}
		<p>This note does not exist or you do not have permission to view it.</p>
	{/if}
</Modal>

<style>
	.people-root {
		min-height: 100vh;
	}
	.sidebar-fixed {
		position: fixed;
		top: 0;
		left: 0;
		width: 300px;
		height: 100%;
		background: var(--sidebar-bg);
		display: flex;
		flex-direction: column;
		padding-left: 10px;
	}
	.side-head {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 60px;
		padding-right: 20px;
	}
	.logo {
		display: flex;
	}
	.who {
		display: flex;
		flex-direction: column;
		font-size: 14px;
		min-width: 0;
		flex: 1;
	}
	.dn {
		text-decoration: none;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.handle {
		opacity: 0.5;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.side-scroll {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 20px;
		padding-right: 10px;
	}
	.side-foot {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 60px;
		padding: 0 15px 0 0;
		background: var(--sidebar-bg);
	}
	.side-foot .ico {
		color: var(--icon);
		display: inline-flex;
	}
	.side-foot :global(.menu-root) {
		flex: 1;
	}

	.mobile-head {
		display: none;
		position: sticky;
		top: 0;
		z-index: 2;
		align-items: center;
		gap: 8px;
		height: 56px;
		padding: 0 10px;
		background: var(--header-bg);
		backdrop-filter: blur(5px);
		box-shadow: var(--shadow-sm);
		font-size: 18px;
	}
	.mobile-head .chev {
		color: var(--chakra-colors-gray-600);
	}
	.mobile-head .spacer {
		flex: 1;
	}
	.mobile-sidebar {
		display: none;
	}

	.content {
		padding: 10px 10px 40px 310px;
		max-width: 180ch;
	}
	.desktop-search {
		margin-bottom: 8px;
	}
	.search-head {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 18px;
		font-weight: bold;
		margin-bottom: 16px;
	}
	.search-title {
		color: var(--accent);
	}
	.busy {
		width: 16px;
		height: 16px;
		border: 2px solid var(--chakra-colors-gray-300);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 767px) {
		.sidebar-fixed,
		.desktop-search {
			display: none;
		}
		.mobile-head {
			display: flex;
		}
		.mobile-sidebar {
			display: block;
			margin-bottom: 12px;
		}
		.content {
			padding: 10px;
		}
	}
</style>
