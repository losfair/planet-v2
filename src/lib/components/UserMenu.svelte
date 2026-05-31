<script lang="ts">
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import type { ApiBasicUserInfo } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import Menu from './Menu.svelte';
	import MenuItem from './MenuItem.svelte';
	import Modal from './Modal.svelte';
	import Settings from './Settings.svelte';

	let { wide = false }: { wide?: boolean } = $props();
	const currentUser = getContext<{ value: ApiBasicUserInfo | null }>('currentUser');
	const user = $derived(currentUser?.value);

	let settingsOpen = $state(false);

	function logout() {
		const f = document.createElement('form');
		f.method = 'POST';
		f.action = '/me/logout';
		f.style.display = 'none';
		document.body.appendChild(f);
		f.submit();
	}
</script>

{#if user && user.username}
	<Menu align={wide ? 'start' : 'end'}>
		{#snippet trigger()}
			<span class="trigger">
				<Avatar name={user.username} size="sm" />
				{#if wide}<span class="uname">@{user.username}</span>{/if}
			</span>
		{/snippet}
		<MenuItem><span class="muted">@{user.username}</span></MenuItem>
		<MenuItem onclick={() => goto(`/people/${user.username}/notes`)}>Notes</MenuItem>
		<MenuItem onclick={() => (settingsOpen = true)}>Settings</MenuItem>
		<MenuItem onclick={() => window.open('https://docs.planet.ink/')}>Help</MenuItem>
		<MenuItem divider />
		<MenuItem color="var(--chakra-colors-red-500)" onclick={logout}>Sign out</MenuItem>
	</Menu>

	<Modal open={settingsOpen} onClose={() => (settingsOpen = false)} maxWidth="40rem">
		{#snippet header()}Settings{/snippet}
		<Settings username={user.username} onClose={() => (settingsOpen = false)} />
	</Modal>
{:else}
	<a class="signin" href="/login">Sign in</a>
{/if}

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.uname {
		font-size: 15px;
	}
	.muted {
		color: var(--text-secondary);
	}
	.signin {
		font-size: 14px;
		text-decoration: none;
		color: var(--text);
	}
	.signin:hover {
		text-decoration: underline;
	}
</style>
