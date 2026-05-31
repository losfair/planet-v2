<script lang="ts">
	let {
		value = $bindable(''),
		placeholder = 'Search notes…'
	}: { value?: string; placeholder?: string } = $props();
</script>

<div class="search">
	<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<circle cx="11" cy="11" r="7" />
		<path d="M21 21l-4.3-4.3" />
	</svg>
	<input bind:value {placeholder} />
	{#if value}
		<button class="clear" onclick={() => (value = '')} aria-label="Clear">×</button>
	{/if}
</div>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0 10px;
		background: var(--card-bg);
		height: 40px;
	}
	.search:focus-within {
		outline: 2px solid var(--accent);
	}
	.icon {
		color: var(--text-secondary);
		flex-shrink: 0;
	}
	input {
		border: none;
		outline: none;
		background: transparent;
		color: var(--text);
		font-size: 15px;
		flex: 1;
		min-width: 0;
	}
	.clear {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 18px;
	}
</style>
