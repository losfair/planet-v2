<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let pending = $state<'approve' | 'deny' | null>(null);

	// Feedback is driven from the form's submit event (not the buttons' click
	// handlers): disabling a submit button inside its own onclick cancels the
	// native submission before it fires. By the time `submit` runs the browser
	// has already committed to navigating, so updating state here is safe.
	function onSubmit(e: SubmitEvent) {
		const action = (e.submitter as HTMLButtonElement | null)?.formAction ?? '';
		pending = action.includes('deny') ? 'deny' : 'approve';
	}
</script>

<svelte:head><title>Authorize · Planet</title></svelte:head>

<div class="auth-wrap">
	<div class="auth-card">
		<a class="logo" href="/">
			<img src="/icon.svg" alt="Planet" width="34" />
			<span>Planet</span>
		</a>
		<h1>Authorize access</h1>
		<p class="lede">
			<strong>{data.clientName}</strong> wants to connect to your Planet account
			(<span class="user">@{data.username}</span>) over MCP.
		</p>
		<ul class="scopes">
			<li>Read your notes, profile, search and feeds</li>
			<li>Create, edit and delete notes on your behalf</li>
		</ul>

		<form method="POST" onsubmit={onSubmit}>
			{#each Object.entries(data.params) as [k, v] (k)}
				<input type="hidden" name={k} value={v} />
			{/each}
			<div class="actions">
				<Button
					type="submit"
					formaction="?/approve"
					colorScheme="teal"
					size="lg"
					loading={pending === 'approve'}
					disabled={pending !== null}>Authorize</Button
				>
				<Button
					type="submit"
					formaction="?/deny"
					colorScheme="gray"
					size="lg"
					loading={pending === 'deny'}
					disabled={pending !== null}>Cancel</Button
				>
			</div>
		</form>
		<p class="hint">You can revoke access any time from Settings.</p>
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
		max-width: 420px;
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
		font-size: 22px;
		margin: 0 0 12px;
	}
	.lede {
		font-size: 15px;
		color: var(--text);
		margin: 0 0 16px;
	}
	.user {
		color: var(--accent);
		font-weight: 600;
	}
	.scopes {
		margin: 0 0 24px;
		padding-left: 18px;
		font-size: 14px;
		color: var(--text-secondary);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.actions {
		display: flex;
		gap: 12px;
	}
	.hint {
		margin-top: 18px;
		font-size: 13px;
		color: var(--text-secondary);
		text-align: center;
	}
</style>
