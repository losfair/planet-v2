<script lang="ts">
	import { loadJson } from '$lib/client/api';
	import TagNode, { type TagTreeNode } from './TagNode.svelte';
	import SkeletonText from './SkeletonText.svelte';

	let { username }: { username: string } = $props();

	let tags = $state<string[] | null>(null);

	function buildTree(list: string[]): TagTreeNode[] {
		const root: TagTreeNode[] = [];
		for (const tag of list) {
			const segs = tag.split('/');
			let level = root;
			let acc = '';
			for (const seg of segs) {
				acc = acc ? acc + '/' + seg : seg;
				let node = level.find((n) => n.name === seg);
				if (!node) {
					node = { name: seg, full: acc, children: [] };
					level.push(node);
				}
				level = node.children;
			}
		}
		return root;
	}

	const tree = $derived(tags ? buildTree(tags) : null);

	$effect(() => {
		let cancelled = false;
		loadJson<{ tags: string[] }>(`/api/v1/tags/${encodeURIComponent(username)}`)
			.then((r) => {
				if (!cancelled) tags = r.tags;
			})
			.catch(() => {
				if (!cancelled) tags = [];
			});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if tree === null}
	<SkeletonText />
{:else if tree.length === 0}
	<p class="empty">
		No tags yet
	</p>
{:else}
	<div class="taglist">
		{#each tree as node (node.full)}
			<TagNode {node} {username} top />
		{/each}
	</div>
{/if}

<style>
	.empty {
		color: var(--text-secondary);
		font-size: 15px;
	}
</style>
