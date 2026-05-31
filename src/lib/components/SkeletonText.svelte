<script lang="ts">
	let { lines = 3 }: { lines?: number } = $props();
</script>

<div class="skeleton">
	{#each Array(lines) as _, i (i)}
		<div class="line" style="width: {i === lines - 1 ? '80%' : '100%'}"></div>
	{/each}
</div>

<style>
	.skeleton {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 8px 0;
	}
	.line {
		height: 12px;
		border-radius: 4px;
		background: linear-gradient(90deg, var(--border) 25%, var(--hover-bg) 50%, var(--border) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}
	@keyframes shimmer {
		to {
			background-position: -200% 0;
		}
	}
</style>
