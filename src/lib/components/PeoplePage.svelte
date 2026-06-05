<script lang="ts">
	import { getContext, onMount, tick, untrack, type Snippet as SnippetT } from 'svelte';
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
	import LiquidGlass from './LiquidGlass.svelte';

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
	let notes = $state<RenderableSnippet[]>(untrack(() => data.snippets));
	let cursor = $state<string | null>(untrack(() => data.cursor));
	let topNote = $state<RenderableSnippet | null>(untrack(() => data.topNote));
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
	let searchText = $state(untrack(() => initialSearch));
	let searchResults = $state<RenderableSnippet[] | null>(null);
	let searchCursor = $state<string | null>(null);
	let searchBusy = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;

	// Floating search box (toggled from the top nav).
	let searchOpen = $state(false);
	let searchFloat = $state<HTMLElement>();
	$effect(() => {
		if (searchOpen) tick().then(() => searchFloat?.querySelector('input')?.focus());
	});

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

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && searchOpen) searchOpen = false;
	}}
	onclick={(e) => {
		if (!searchOpen) return;
		const t = e.target as HTMLElement;
		// Clicking outside the box (and not the toggle button) closes it without clearing.
		if (searchFloat?.contains(t) || t.closest('.icobtn')) return;
		searchOpen = false;
	}}
/>

<div class="people-root" style="--note-font: {noteFont}">
	{#if publicInfo.backgroundImage}
		<div class="bg-image" style="background-image: url('{publicInfo.backgroundImage}')"></div>
	{/if}

	<!-- Floating Liquid Glass top nav -->
	<header class="topnav">
		<LiquidGlass class="topnav-glass" radius={22} padding="7px 10px 7px 14px" style="width:100%;">
			<div class="nav-inner">
				<a class="logo" href="/" aria-label="Planet"><img src="/icon.svg" alt="" width="24" /></a>
				<a class="who" href={`/people/${username}/notes`}>
					<span class="dn">{displayName}</span>
					<span class="handle">@{username}</span>
				</a>
				<span class="nav-spacer"></span>
				<div class="nav-actions">
					<button
						class="ico icobtn"
						class:active={searchOpen}
						onclick={() => (searchOpen = !searchOpen)}
						title="Search"
						aria-label="Search"
					>
						<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="11" cy="11" r="7" />
							<path d="M21 21l-4.3-4.3" />
						</svg>
					</button>
					{#if canFollow}
						<Button
							size="sm"
							colorScheme="blue"
							variant={isFollowing ? 'outline' : 'solid'}
							loading={followBusy}
							onclick={toggleFollow}>{isFollowing ? 'Following' : 'Follow'}</Button
						>
					{/if}
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
					<UserMenu />
				</div>
			</div>
		</LiquidGlass>
	</header>

	<!-- Floating Liquid Glass left panel: tags + lens -->
	<aside class="leftpanel">
		<LiquidGlass class="leftpanel-glass" radius={22} padding="8px 6px" style="width:100%;">
			<div class="panel-inner">
				<Sidebar {username} />
			</div>
		</LiquidGlass>
	</aside>

	<!-- Floating Liquid Glass search box (toggled from the nav) -->
	{#if searchOpen}
		<div class="search-float" bind:this={searchFloat}>
			<LiquidGlass class="search-glass" radius={16} padding="5px 7px" style="width:100%;">
				<Search bind:value={searchText} />
			</LiquidGlass>
		</div>
	{/if}

	<main class="content">
		<div class="mobile-sidebar">
			<Sidebar {username} defaultActive={null} allowUnselect />
		</div>

		{#if primaryContent}
			{@render primaryContent()}
		{:else}
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
		/* Layout geometry: the top nav and content share one "main" column that stays
		   horizontally centered. Its width is constrained so the left gutter has room
		   for the panel, which floats just to the LEFT of the column — never over it,
		   never inside it. */
		--panel-w: 280px;
		--col-gap: 16px;
		--edge: 12px;
		--main-w: min(900px, calc(100% - 2 * (var(--edge) + var(--panel-w) + var(--col-gap))));
		--panel-left: calc((100% - var(--main-w)) / 2 - var(--col-gap) - var(--panel-w));
	}

	/* Full-viewport background image, behind content; refracts through the glass. */
	.bg-image {
		position: fixed;
		inset: 0;
		z-index: -1;
		background-size: cover;
		background-position: center;
		background-attachment: fixed;
	}

	/* ---- Floating top nav ---- */
	.topnav {
		position: fixed;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		width: var(--main-w);
		z-index: 50;
	}
	.nav-inner {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
	}
	.logo {
		display: flex;
		flex-shrink: 0;
	}
	.who {
		display: flex;
		flex-direction: column;
		font-size: 14px;
		line-height: 1.15;
		min-width: 0;
		text-decoration: none;
		color: var(--text);
	}
	.dn {
		font-weight: 600;
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
	.nav-spacer {
		flex: 1;
	}
	.nav-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}
	.nav-actions .ico {
		color: var(--text);
		opacity: 0.7;
		display: inline-flex;
		transition: opacity 0.15s ease;
	}
	.nav-actions .ico:hover {
		opacity: 1;
	}
	.nav-actions .icobtn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.nav-actions .icobtn.active {
		opacity: 1;
		color: var(--accent);
	}

	/* ---- Floating search box: below the nav, on the top layer ---- */
	.search-float {
		position: fixed;
		top: 70px;
		left: 50%;
		transform: translateX(-50%);
		width: min(560px, calc(100% - 24px));
		z-index: 100;
	}
	/* Let the search field sit directly on the glass. */
	.search-float :global(.search) {
		background: transparent;
		border: none;
		height: 38px;
	}
	.search-float :global(.search:focus-within) {
		outline: none;
	}

	/* ---- Floating left panel ---- */
	.leftpanel {
		position: fixed;
		top: 74px;
		/* Floats to the left of the main column. */
		left: var(--panel-left);
		width: var(--panel-w);
		z-index: 40;
	}
	.panel-inner {
		width: 100%;
		max-height: calc(100vh - 98px);
		overflow-y: auto;
		padding: 4px 6px;
	}

	.mobile-sidebar {
		display: none;
	}

	.content {
		/* Exactly the same column as the top nav: centered, same width. */
		width: var(--main-w);
		margin: 0 auto;
		padding: 84px 4px 40px;
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
		.leftpanel {
			display: none;
		}
		.who .handle {
			display: none;
		}
		.mobile-sidebar {
			display: block;
			margin-bottom: 12px;
		}
		.topnav {
			left: 12px;
			transform: none;
			width: calc(100% - 24px);
		}
		.content {
			width: auto;
			margin: 0;
			padding: 72px 6px 40px;
		}
	}
</style>
