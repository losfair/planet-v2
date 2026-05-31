<script lang="ts">
	import { toast } from '$lib/client/toast.svelte';
</script>

<div class="toaster">
	{#each toast.items as t (t.id)}
		<div class="toast {t.status}" role="status">
			<div class="bar"></div>
			<div class="body">
				<div class="title">{t.title}</div>
				{#if t.description}<div class="desc">{t.description}</div>{/if}
			</div>
			<button class="close" onclick={() => toast.dismiss(t.id)} aria-label="Close">×</button>
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 6000;
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: center;
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		display: flex;
		align-items: stretch;
		min-width: 300px;
		max-width: 560px;
		background: var(--card-bg);
		color: var(--text);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		overflow: hidden;
		border: 1px solid var(--border);
	}
	.bar {
		width: 4px;
	}
	.success .bar {
		background: var(--chakra-colors-green-500);
	}
	.error .bar {
		background: var(--chakra-colors-red-500);
	}
	.info .bar {
		background: var(--chakra-colors-blue-500);
	}
	.warning .bar {
		background: var(--chakra-colors-orange-400);
	}
	.body {
		padding: 10px 12px;
		flex: 1;
	}
	.title {
		font-weight: 600;
		font-size: 14px;
	}
	.desc {
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 2px;
	}
	.close {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 18px;
		cursor: pointer;
		padding: 0 12px;
	}
</style>
