<script lang="ts">
	import Self from './TagNode.svelte';

	export interface TagTreeNode {
		name: string;
		full: string;
		children: TagTreeNode[];
	}

	let {
		node,
		username,
		top = false
	}: { node: TagTreeNode; username: string; top?: boolean } = $props();

	let open = $state(false);
	const hasChildren = $derived(node.children.length > 0);
</script>

<div class="tag-item">
	<div class="row">
		<a class="tag-link" href={`/people/${username}/tag/${encodeURIComponent(node.full)}`}>
			{top ? '#' + node.name : node.name}
		</a>
		{#if hasChildren}
			<button class="caret" class:open onclick={() => (open = !open)} aria-label="Toggle">▾</button>
		{/if}
	</div>
	{#if hasChildren && open}
		<div class="children">
			{#each node.children as child (child.full)}
				<Self node={child} {username} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		height: 36px;
		gap: 6px;
	}
	.tag-link {
		color: var(--text);
		text-decoration: none;
		flex: 1;
		font-size: 15px;
	}
	.tag-link:hover {
		color: var(--accent);
	}
	.caret {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-secondary);
		transition: transform 0.15s ease;
	}
	.caret.open {
		transform: rotate(180deg);
	}
	.children {
		padding-left: 16px;
	}
</style>
