<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="err">
	<a class="logo" href="/"><img src="/icon.svg" alt="Planet" width="40" /></a>
	<h1>{page.status}</h1>
	<p>{page.error?.message || 'Something went wrong.'}</p>
	<a class="home" href="/">Go home</a>
</div>

<style>
	.err {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		text-align: center;
		padding: 20px;
	}
	h1 {
		font-size: 64px;
		margin: 0;
		color: var(--text-secondary);
	}
	p {
		font-size: 18px;
		color: var(--text-secondary);
	}
	.home {
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
</style>
