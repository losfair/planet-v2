<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { loadJson, ApiError } from '$lib/client/api';
	import { toast } from '$lib/client/toast.svelte';
	import { notePopup } from '$lib/client/notePopup.svelte';
	import type { GraphQueryExpr, LinkGraph, LinkGraphNode } from '$lib/types';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import NotePopupView from '$lib/components/NotePopupView.svelte';

	let { data } = $props();
	const username = untrack(() => data.username);
	const displayName = $derived(data.publicInfo?.displayName || username);

	// vis-network types are loaded dynamically (client-only).
	type VisNode = Record<string, unknown> & { id: string };
	type VisEdge = Record<string, unknown> & { id?: string; from: string; to: string };

	let container: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let network: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let nodesDS: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let edgesDS: any = null;
	let ready = $state(false);

	let showNotes = $state(true);
	let showTags = $state(true);
	let loading = $state(true);
	let majorError = $state<'none' | 'loginRequired' | 'notFound'>('none');
	let contextMenu = $state<{ x: number; y: number; nodeId: string } | null>(null);

	const queryExpr = $derived(parseQ(page.url.searchParams.get('q')));

	// ---- pure helpers (ported from the original) ----
	function parseQ(raw: string | null): GraphQueryExpr {
		if (!raw) return { type: 'true' };
		try {
			const e = JSON.parse(raw);
			if (e && typeof e.type === 'string') return e;
		} catch {
			/* ignore */
		}
		return { type: 'true' };
	}

	function dateAndAlpha(noteId: string): [string, number] {
		const today = new Date().toISOString().split('T')[0];
		const theirDate = noteId.substring(0, 10);
		const elapsedDays =
			(new Date(today).getTime() - new Date(theirDate).getTime()) / (1000 * 60 * 60 * 24);
		const alpha = Math.pow(Math.max(0, Math.min(1, 1 - elapsedDays / 30)) * 0.8, 2) + 0.36;
		return [theirDate, alpha];
	}

	function combine(a: [number, number, number, number], b: [number, number, number, number]) {
		return [
			a[0] * a[3] + b[0] * b[3] * (1 - a[3]),
			a[1] * a[3] + b[1] * b[3] * (1 - a[3]),
			a[2] * a[3] + b[2] * b[3] * (1 - a[3]),
			a[3] + b[3] * (1 - a[3])
		];
	}

	function paintNoteNode(uname: string, node: LinkGraphNode): VisNode {
		const [theirDate, alpha] = dateAndAlpha(node.id);
		const ours: [number, number, number, number] = node.priv
			? [0x38, 0xb2, 0xac, alpha]
			: [0x42, 0x99, 0xe1, alpha];
		const c = combine(ours, [255, 255, 255, 1]);
		const label = node.head.startsWith('# ')
			? node.head.substring(2)
			: `${theirDate} ${node.head}...`;
		return { id: `note/${uname}/${node.id}`, label, color: `rgba(${c.join(',')})`, _incomplete: false };
	}

	function findTag(node: LinkGraphNode, tag: string) {
		return node.tags.findIndex((x) => x === tag || x.startsWith(tag + '/')) !== -1;
	}

	function preserve(node: LinkGraphNode, expr: GraphQueryExpr): boolean {
		switch (expr.type) {
			case 'and':
				return preserve(node, expr.left) && preserve(node, expr.right);
			case 'or':
				return preserve(node, expr.left) || preserve(node, expr.right);
			case 'not':
				return !preserve(node, expr.expr);
			case 'hasId':
				return node.id === expr.id;
			case 'hasTag':
				return findTag(node, expr.tag);
			case 'withoutTag':
				return !findTag(node, expr.tag);
			case 'timeAfter':
				return node.id > new Date(expr.time).toISOString().split('T')[0];
			case 'timeBefore':
				return node.id < new Date(expr.time).toISOString().split('T')[0];
			case 'public':
				return !node.priv;
			default:
				return true;
		}
	}

	function stringifyExpr(expr: GraphQueryExpr): string {
		switch (expr.type) {
			case 'and':
				return `${stringifyExpr(expr.left)} and ${stringifyExpr(expr.right)}`;
			case 'or':
				return `(${stringifyExpr(expr.left)} or ${stringifyExpr(expr.right)})`;
			case 'not':
				return `not(${stringifyExpr(expr.expr)})`;
			case 'hasId':
				return `id(${expr.id})`;
			case 'hasTag':
				return `tag(${expr.tag})`;
			case 'withoutTag':
				return `not(tag(${expr.tag}))`;
			case 'timeAfter':
				return `time >= ${new Date(expr.time).toISOString().split('T')[0]}`;
			case 'timeBefore':
				return `time < ${new Date(expr.time).toISOString().split('T')[0]}`;
			default:
				return '1';
		}
	}

	function filterLocally(uname: string, expr: GraphQueryExpr, graph: LinkGraph): LinkGraph {
		const nodes = graph.nodes.filter((x) => preserve(x, expr));
		const keys = new Set(nodes.map((x) => `${uname}/${x.id}`));
		return {
			nodes,
			edges: graph.edges.filter((x) => keys.has(x.from) || keys.has(x.to))
		};
	}

	function edgeWithId(e: VisEdge): VisEdge {
		e.id = e.from + '|' + e.to;
		return e;
	}

	function paintGraph(
		uname: string,
		isMyself: boolean,
		graph: LinkGraph
	): { nodes: VisNode[]; edges: VisEdge[] } {
		const out: { nodes: VisNode[]; edges: VisEdge[] } = { nodes: [], edges: [] };
		const seen = new Set<string>();

		for (const node of graph.nodes) {
			out.nodes.push(paintNoteNode(uname, node));
			seen.add(`note/${uname}/${node.id}`);
		}
		for (const edge of graph.edges) {
			const src = `note/${edge.from}`;
			const dst = `note/${edge.to}`;
			for (const [nid, raw] of [
				[src, edge.from],
				[dst, edge.to]
			] as const) {
				if (!seen.has(nid)) {
					out.nodes.push({ id: nid, label: raw, color: '#F6AD55', _incomplete: true });
					seen.add(nid);
				}
			}
			out.edges.push(edgeWithId({ from: src, to: dst, arrows: 'to' }));
		}

		// Tag nodes (hierarchical).
		const seenPartial = new Set<string>();
		for (const node of graph.nodes) {
			const tags = [...node.tags].sort((a, b) => b.length - a.length);
			const localSeen = new Set<string>();
			for (const tag of tags) {
				if (localSeen.has(tag)) continue;
				const segs = tag.split('/');
				for (let i = 0; i < segs.length; i++) {
					const partial = segs.slice(0, i + 1).join('/');
					localSeen.add(partial);
					if (!seenPartial.has(partial)) {
						out.nodes.push({
							id: `tag/${uname}/${partial}`,
							label: (isMyself ? '' : uname) + '#' + partial,
							font: { size: 20, color: '#DD6B20' },
							color: '#CFCFCF'
						});
						if (i !== 0) {
							out.edges.push(
								edgeWithId({
									from: `tag/${uname}/${partial}`,
									to: `tag/${uname}/${segs.slice(0, i).join('/')}`,
									arrows: 'to'
								})
							);
						}
						seenPartial.add(partial);
					}
				}
				out.edges.push(
					edgeWithId({ from: `note/${uname}/${node.id}`, to: `tag/${uname}/${tag}`, arrows: 'to' })
				);
			}
		}

		// Size/mass by in-degree.
		const inCounts = new Map<string, number>();
		for (const e of out.edges) inCounts.set(e.to, (inCounts.get(e.to) || 0) + 1);
		for (const n of out.nodes) {
			const c = inCounts.get(n.id) || 0;
			n.mass = c + 1;
			n.size = 25 + Math.sqrt(c) * 5;
		}
		return out;
	}

	function applySettings() {
		if (!nodesDS) return;
		const batch: VisNode[] = [];
		nodesDS.forEach((x: VisNode) => {
			let upd = false;
			const id = x.id;
			if (id.startsWith('note/')) {
				const h = !showNotes;
				upd ||= x.hidden !== h;
				x.hidden = h;
			}
			if (id.startsWith('tag/')) {
				const h = !showTags;
				upd ||= x.hidden !== h;
				x.hidden = h;
			}
			if (upd) batch.push(x);
		});
		nodesDS.update(batch);
	}

	function replaceGraph(painted: { nodes: VisNode[]; edges: VisEdge[] }) {
		const nodeIds = new Set(painted.nodes.map((n) => n.id));
		const edgeIds = new Set(painted.edges.map((e) => e.id));
		nodesDS.remove(nodesDS.getIds().filter((id: string) => !nodeIds.has(id)));
		edgesDS.remove(edgesDS.getIds().filter((id: string) => !edgeIds.has(id)));
		nodesDS.update(painted.nodes);
		edgesDS.update(painted.edges);
		applySettings();
	}

	function expandGraph(painted: { nodes: VisNode[]; edges: VisEdge[] }) {
		nodesDS.update(
			painted.nodes.filter((x) => {
				const old = nodesDS.get(x.id);
				if (x.id.startsWith('note/') && old && !old._incomplete) return false;
				return true;
			})
		);
		edgesDS.update(painted.edges);
		applySettings();
	}

	// ---- data loading (cache full graph per user, filter locally) ----
	const cache = new Map<string, string>();
	async function loadUserGraph(uname: string, expr: GraphQueryExpr): Promise<LinkGraph> {
		const cached = cache.get(uname);
		if (cached) return filterLocally(uname, expr, JSON.parse(cached));
		const full = await loadJson<LinkGraph>(
			`/api/v1/graph/${encodeURIComponent(uname)}?q=${encodeURIComponent(JSON.stringify({ type: 'true' }))}`
		);
		cache.set(uname, JSON.stringify(full));
		return filterLocally(uname, expr, full);
	}

	async function loadAndReplace(expr: GraphQueryExpr) {
		try {
			const graph = await loadUserGraph(username, expr);
			replaceGraph(paintGraph(username, true, graph));
			loading = false;
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) majorError = 'loginRequired';
			else if (e instanceof ApiError && e.status === 404) majorError = 'notFound';
			else toast.show({ title: 'Graph query failed', description: String(e), status: 'error' });
		}
	}

	// (Re)load the base graph whenever the query expression (URL) changes.
	$effect(() => {
		const expr = queryExpr;
		if (!ready) return;
		loadAndReplace(expr);
	});

	$effect(() => {
		void showNotes;
		void showTags;
		if (ready) applySettings();
	});

	onMount(() => {
		let destroyed = false;
		let cleanup = () => {};
		(async () => {
			const [{ Network }, { DataSet }] = await Promise.all([
				import('vis-network'),
				import('vis-data')
			]);
			if (destroyed) return;
			nodesDS = new DataSet([]);
			edgesDS = new DataSet([]);
			network = new Network(
				container,
				{ nodes: nodesDS, edges: edgesDS },
				{
					nodes: { shape: 'dot', size: 16 },
					physics: { solver: 'barnesHut', stabilization: false },
					layout: { improvedLayout: false }
				}
			);

			network.on('oncontext', (params: any) => {
				const node = network.getNodeAt(params.pointer.DOM) as string;
				if (!node) return;
				params.event.preventDefault();
				network.stopSimulation();
				contextMenu = { x: params.pointer.DOM.x, y: params.pointer.DOM.y, nodeId: node };
			});
			network.on('click', (params: any) => {
				contextMenu = null;
				if (network.getNodeAt(params.pointer.DOM)) network.stopSimulation();
			});
			network.on('doubleClick', (params: any) => {
				const node = network.getNodeAt(params.pointer.DOM) as string;
				if (!node || !nodesDS.get(node)) return;
				if (node.startsWith('note/')) {
					const [u, id] = node.substring(5).split('/');
					loadUserGraph(u, { type: 'hasId', id })
						.then((g) => expandGraph(paintGraph(u, u === username, g)))
						.catch((e) => toast.show({ title: 'Graph error', description: String(e), status: 'error' }));
				} else if (node.startsWith('tag/')) {
					const m = /^([^/]+)\/(.+)$/.exec(node.substring(4));
					if (!m) return;
					const [, u, tag] = m;
					loadUserGraph(u, { type: 'hasTag', tag })
						.then((g) => expandGraph(paintGraph(u, u === username, g)))
						.catch((e) => toast.show({ title: 'Graph error', description: String(e), status: 'error' }));
				}
			});

			ready = true;
			cleanup = () => network?.destroy();
		})();
		return () => {
			destroyed = true;
			cleanup();
		};
	});

	// ---- context menu actions ----
	function ctxSubgraph() {
		if (!contextMenu) return;
		const id = contextMenu.nodeId;
		let query: GraphQueryExpr | null = null;
		let u = username;
		if (id.startsWith('note/')) {
			const m = /^note\/([^/]+)\/(.+)$/.exec(id);
			if (m) {
				u = m[1];
				query = { type: 'hasId', id: m[2] };
			}
		} else if (id.startsWith('tag/')) {
			const m = /^tag\/([^/]+)\/(.+)$/.exec(id);
			if (m) {
				u = m[1];
				query = { type: 'hasTag', tag: m[2] };
			}
		}
		contextMenu = null;
		if (query) goto(`/people/${u}/graph?q=${encodeURIComponent(JSON.stringify(query))}`);
	}
	function ctxOpen() {
		if (!contextMenu) return;
		notePopup.open(contextMenu.nodeId.substring(5));
		contextMenu = null;
	}
	function ctxCopy() {
		if (!contextMenu) return;
		navigator.clipboard.writeText(`${location.origin}/people/${contextMenu.nodeId.substring(5)}`);
		toast.show({ title: 'Copied', description: 'Note link copied.', status: 'success' });
		contextMenu = null;
	}
</script>

<svelte:head><title>{displayName} · Planet Graph</title></svelte:head>

<div class="graph-canvas" bind:this={container}></div>

<header class="gheader">
	<a class="brand" href="/"><img src="/icon.svg" alt="" width="26" /></a>
	<span class="chev">›</span>
	<a class="dn" href={`/people/${username}/notes`}>{displayName}</a>
	<span class="spacer"></span>
	<UserMenu />
</header>

{#if !loading}
	<div class="controls">
		<label><span>Notes</span><input type="checkbox" bind:checked={showNotes} /></label>
		<label><span>Tags</span><input type="checkbox" bind:checked={showTags} /></label>
	</div>
{/if}

{#if queryExpr.type !== 'true'}
	<div class="querybar">
		<button class="close" aria-label="Clear" onclick={() => goto(`/people/${username}/graph`)}>×</button>
		<span class="q">Query: <strong>{stringifyExpr(queryExpr)}</strong></span>
	</div>
{/if}

{#if loading}
	<div class="loading">
		<img src="/icon.svg" alt="" width="36" />
		<p>
			{majorError === 'loginRequired'
				? 'Sign in required'
				: majorError === 'notFound'
					? 'User not found'
					: 'Opening graph'}
		</p>
	</div>
{/if}

{#if contextMenu}
	<div class="ctx" style="top:{contextMenu.y}px; left:{contextMenu.x}px" role="menu">
		<button onclick={ctxSubgraph}>Subgraph</button>
		{#if contextMenu.nodeId.startsWith('note/')}
			<button onclick={ctxOpen}>Open</button>
			<button onclick={ctxCopy}>Copy link</button>
		{/if}
	</div>
{/if}

<NotePopupView onChanged={() => cache.delete(username)} />

<style>
	/* The graph view is light, like the original (rendered on a white canvas). */
	.graph-canvas {
		position: fixed;
		inset: 0;
		background: #ffffff;
	}
	.gheader {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 56px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(5px);
		box-shadow: var(--shadow-sm);
		font-size: 18px;
		color: #1a202c;
		z-index: 10;
	}
	.gheader .brand {
		display: flex;
	}
	.gheader .chev {
		color: var(--chakra-colors-gray-600);
	}
	.gheader .dn {
		color: #1a202c;
		text-decoration: none;
	}
	.gheader .spacer {
		flex: 1;
	}
	.controls {
		position: fixed;
		top: 80px;
		left: 10px;
		width: 200px;
		background: rgba(255, 255, 255, 0.6);
		border-radius: 5px;
		box-shadow: var(--shadow-base);
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 14px;
		color: #1a202c;
		z-index: 10;
	}
	.controls:hover {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(5px);
	}
	.controls label {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.querybar {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 60px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 10px;
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(5px);
		color: #1a202c;
		font-size: 14px;
		z-index: 10;
	}
	.querybar .close {
		border: none;
		background: none;
		font-size: 18px;
		cursor: pointer;
		color: #1a202c;
	}
	.querybar .q {
		font-family: monospace;
	}
	.loading {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: #fff;
		color: var(--chakra-colors-gray-600);
		z-index: 20;
	}
	.ctx {
		position: fixed;
		z-index: 30;
		background: #fff;
		border: 1px solid var(--chakra-colors-gray-200);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		padding: 6px 0;
		min-width: 140px;
		color: #1a202c;
	}
	.ctx button {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 6px 16px;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.ctx button:hover {
		background: var(--chakra-colors-gray-100);
	}
</style>
