<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		colorScheme = 'gray',
		variant = 'solid',
		size = 'md',
		loading = false,
		disabled = false,
		type = 'button',
		href = undefined,
		title = undefined,
		onclick = undefined,
		children,
		...rest
	}: {
		colorScheme?: 'gray' | 'teal' | 'blue' | 'green' | 'red' | 'orange';
		variant?: 'solid' | 'outline' | 'ghost' | 'link';
		size?: 'xs' | 'sm' | 'md' | 'lg';
		loading?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit';
		href?: string;
		title?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	class="btn {variant} cs-{colorScheme} size-{size}"
	class:loading
	{href}
	{title}
	role={href ? 'button' : undefined}
	type={href ? undefined : type}
	disabled={disabled || loading}
	aria-disabled={disabled || loading}
	{onclick}
	{...rest}
>
	{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
	{@render children()}
</svelte:element>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		white-space: nowrap;
		text-decoration: none;
		transition:
			background 0.15s ease,
			opacity 0.15s ease;
		line-height: 1;
		font-family: inherit;
	}
	.btn[disabled],
	.btn[aria-disabled='true'] {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.size-xs {
		height: 24px;
		padding: 0 8px;
		font-size: 12px;
	}
	.size-sm {
		height: 32px;
		padding: 0 12px;
		font-size: 14px;
	}
	.size-md {
		height: 40px;
		padding: 0 16px;
		font-size: 16px;
	}
	.size-lg {
		height: 48px;
		padding: 0 24px;
		font-size: 18px;
	}

	/* solid */
	.solid.cs-gray {
		background: var(--chakra-colors-gray-100);
		color: var(--chakra-colors-gray-800);
	}
	:global([data-theme='dark']) .solid.cs-gray {
		background: rgba(255, 255, 255, 0.08);
		color: #fff;
	}
	.solid.cs-teal {
		background: var(--chakra-colors-teal-500);
		color: #fff;
	}
	.solid.cs-blue {
		background: var(--chakra-colors-blue-500);
		color: #fff;
	}
	.solid.cs-green {
		background: var(--chakra-colors-green-500);
		color: #fff;
	}
	.solid.cs-red {
		background: var(--chakra-colors-red-500);
		color: #fff;
	}
	.solid.cs-orange {
		background: var(--chakra-colors-orange-400);
		color: #fff;
	}
	.solid:not([disabled]):hover {
		filter: brightness(0.93);
	}

	/* outline */
	.outline {
		background: transparent;
	}
	.outline.cs-blue {
		border-color: var(--chakra-colors-blue-500);
		color: var(--chakra-colors-blue-500);
	}
	.outline.cs-teal {
		border-color: var(--chakra-colors-teal-500);
		color: var(--chakra-colors-teal-500);
	}
	.outline.cs-gray {
		border-color: var(--border);
		color: var(--text);
	}
	.outline:not([disabled]):hover {
		background: var(--hover-bg);
	}

	/* ghost */
	.ghost {
		background: transparent;
		color: var(--text);
	}
	.ghost:not([disabled]):hover {
		background: var(--hover-bg);
	}

	/* link */
	.link {
		background: transparent;
		border: none;
		height: auto;
		padding: 0;
		color: var(--text);
	}
	.link.cs-blue {
		color: var(--chakra-colors-blue-500);
	}
	.link:not([disabled]):hover {
		text-decoration: underline;
	}

	.spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
