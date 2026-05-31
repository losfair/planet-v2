<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		onclick,
		color = undefined,
		divider = false,
		children
	}: {
		onclick?: () => void;
		color?: string;
		divider?: boolean;
		children?: Snippet;
	} = $props();
</script>

{#if divider}
	<div class="menu-divider"></div>
{:else}
	<button class="menu-item" style={color ? `color:${color}` : ''} {onclick} role="menuitem">
		{@render children?.()}
	</button>
{/if}

<style>
	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		background: none;
		border: none;
		text-align: left;
		padding: 6px 16px;
		cursor: pointer;
		color: inherit;
		font: inherit;
		font-size: 15px;
	}
	.menu-item:hover {
		background: var(--hover-bg);
	}
	.menu-divider {
		height: 1px;
		background: var(--border);
		margin: 8px 0;
	}
</style>
