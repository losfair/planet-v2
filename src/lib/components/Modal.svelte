<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = false,
		onClose,
		header,
		children,
		footer,
		maxWidth = '32rem'
	}: {
		open?: boolean;
		onClose: () => void;
		header?: Snippet;
		children: Snippet;
		footer?: Snippet;
		maxWidth?: string;
	} = $props();

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	// Portal the overlay to <body> so it escapes any ancestor stacking context
	// (e.g. the position:fixed sidebar) and always renders on top.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
	<div
		class="overlay"
		use:portal
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
	>
		<div class="modal" role="dialog" aria-modal="true" style="max-width:{maxWidth}">
			{#if header}
				<div class="modal-header">{@render header()}</div>
			{/if}
			<button class="modal-close" onclick={onClose} aria-label="Close">×</button>
			<div class="modal-body">{@render children()}</div>
			{#if footer}
				<div class="modal-footer">{@render footer()}</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.48);
		z-index: 5000;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 3.75rem 12px;
		overflow-y: auto;
	}
	.modal {
		position: relative;
		background: var(--card-bg);
		color: var(--text);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		width: 100%;
		margin: auto;
	}
	.modal-header {
		font-size: 1.25rem;
		font-weight: 600;
		padding: 16px 24px 8px;
	}
	.modal-close {
		position: absolute;
		top: 8px;
		right: 12px;
		background: none;
		border: none;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		color: var(--text-secondary);
		border-radius: var(--radius-md);
		width: 32px;
		height: 32px;
	}
	.modal-close:hover {
		background: var(--hover-bg);
	}
	.modal-body {
		padding: 8px 24px 24px;
	}
	.modal-footer {
		padding: 8px 24px 16px;
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}
</style>
