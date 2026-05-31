<script lang="ts">
	let { size = '1em' }: { size?: string } = $props();
</script>

<span class="spinner" style="width:{size};height:{size}" aria-label="loading"></span>

<style>
	.spinner {
		display: inline-block;
		border: 2px solid var(--chakra-colors-gray-300);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
		vertical-align: middle;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
