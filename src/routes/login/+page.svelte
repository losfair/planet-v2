<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in · Planet</title></svelte:head>

<div class="auth-wrap">
	<div class="auth-card">
		<a class="logo" href="/">
			<img src="/icon.svg" alt="Planet" width="34" />
			<span>Planet</span>
		</a>
		<h1>Welcome back</h1>
		{#if form?.error}<div class="error">{form.error}</div>{/if}
		<form method="POST" onsubmit={() => (submitting = true)}>
			<label>
				<span>Username or email</span>
				<input name="identifier" autocomplete="username" value={form?.identifier ?? ''} required />
			</label>
			<label>
				<span>Password</span>
				<input name="password" type="password" autocomplete="current-password" required />
			</label>
			<Button type="submit" colorScheme="teal" size="lg" loading={submitting}>Sign in</Button>
		</form>
		<p class="alt">No account yet? <a href="/signup">Create one</a></p>
	</div>
</div>

<style>
	.auth-wrap {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}
	.auth-card {
		width: 100%;
		max-width: 380px;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-base);
		padding: 32px;
	}
	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 22px;
		font-weight: 600;
		text-decoration: none;
		margin-bottom: 20px;
	}
	h1 {
		font-size: 24px;
		margin: 0 0 20px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}
	input {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--text);
		font-size: 15px;
	}
	input:focus {
		outline: 2px solid var(--accent);
		border-color: transparent;
	}
	.error {
		background: #fff5f5;
		color: var(--chakra-colors-red-600);
		border: 1px solid var(--chakra-colors-red-400);
		border-radius: var(--radius-md);
		padding: 8px 12px;
		font-size: 14px;
		margin-bottom: 16px;
	}
	.alt {
		margin-top: 20px;
		font-size: 14px;
		color: var(--text-secondary);
		text-align: center;
	}
	.alt a {
		color: var(--accent);
		font-weight: 600;
	}
</style>
