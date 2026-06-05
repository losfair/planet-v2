<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		trigger,
		children,
		align = 'end',
		direction = 'down'
	}: {
		trigger: Snippet;
		children: Snippet;
		align?: 'start' | 'end';
		direction?: 'down' | 'up';
	} = $props();

	let open = $state(false);
	let root: HTMLElement;

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	function onWindowClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="menu-root" bind:this={root}>
	<button class="menu-trigger" onclick={toggle} aria-haspopup="menu" aria-expanded={open}>
		{@render trigger()}
	</button>
	{#if open}
		<div
			class="menu-list {align} {direction}"
			role="menu"
			tabindex="-1"
			onclick={() => (open = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape') open = false;
			}}
		>
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.menu-root {
		position: relative;
		display: inline-flex;
	}
	.menu-trigger {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: inherit;
		font: inherit;
		display: inline-flex;
		align-items: center;
	}
	.menu-list {
		position: absolute;
		min-width: 180px;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		padding: 8px 0;
		z-index: 1500;
		color: var(--text);
		font-size: 15px;
	}
	.menu-list.end {
		right: 0;
	}
	.menu-list.start {
		left: 0;
	}
	.menu-list.down {
		top: calc(100% + 4px);
	}
	.menu-list.up {
		bottom: calc(100% + 4px);
	}
</style>
