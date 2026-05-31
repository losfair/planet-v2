<script lang="ts">
	import { loadJson } from '$lib/client/api';
	import { toast } from '$lib/client/toast.svelte';
	import { colorMode } from '$lib/client/colorMode.svelte';
	import { invalidateAll } from '$app/navigation';
	import Button from './Button.svelte';
	import type { FullUserInfo } from '$lib/types';

	let { username, onClose }: { username: string; onClose: () => void } = $props();

	let tab = $state<'account' | 'data'>('account');
	let displayName = $state('');
	let description = $state('');
	let fontFamily = $state('');
	let saving = $state(false);
	let inviteToken = $state('');

	$effect(() => {
		loadJson<FullUserInfo & { username: string }>(
			`/api/v1/user?username=${encodeURIComponent(username)}`
		).then((u) => {
			displayName = u.displayName || '';
			description = u.description || '';
			fontFamily = u.contentFontFamily || '';
		});
	});

	async function save() {
		saving = true;
		try {
			await loadJson('/me/api/v1/update_user', {
				displayName,
				description,
				contentFontFamily: fontFamily || null
			});
			toast.show({ title: 'Saved', status: 'success' });
			await invalidateAll();
			onClose();
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		} finally {
			saving = false;
		}
	}

	async function genInvite() {
		try {
			const r = await loadJson<{ token: string }>('/me/api/v1/invite', {});
			inviteToken = r.token;
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		}
	}
</script>

<div class="settings">
	<div class="tabs">
		<button class:active={tab === 'account'} onclick={() => (tab = 'account')}>Account</button>
		<button class:active={tab === 'data'} onclick={() => (tab = 'data')}>Data</button>
	</div>

	{#if tab === 'account'}
		<div class="field">
			<label for="dn">Display name</label>
			<input id="dn" bind:value={displayName} maxlength="30" />
		</div>
		<div class="field">
			<label for="bio">Bio</label>
			<textarea id="bio" bind:value={description} rows="3" maxlength="500"></textarea>
		</div>
		<div class="field">
			<label for="ff">Content font</label>
			<select id="ff" bind:value={fontFamily}>
				<option value="">Default</option>
				<option value="serif">Serif</option>
				<option value="monospace">Monospace</option>
			</select>
		</div>
		<div class="field row">
			<span>Dark mode</span>
			<label class="switch">
				<input
					type="checkbox"
					checked={colorMode.current === 'dark'}
					onchange={() => colorMode.toggle()}
				/>
				<span class="slider"></span>
			</label>
		</div>
		<div class="actions">
			<Button colorScheme="teal" loading={saving} onclick={save}>Save</Button>
		</div>
	{:else}
		<p>Generate an invitation token to invite a friend to Planet.</p>
		<Button colorScheme="gray" onclick={genInvite}>Generate invite</Button>
		{#if inviteToken}
			<textarea class="invite" readonly rows="3">{inviteToken}</textarea>
		{/if}
		<p class="exportnote">
			Your public notes are available as an <a href={`/feed/${username}.xml`}>RSS feed</a>.
		</p>
	{/if}
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 320px;
	}
	.tabs {
		display: flex;
		gap: 8px;
	}
	.tabs button {
		border: none;
		background: transparent;
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 999px;
		cursor: pointer;
		color: var(--text);
	}
	.tabs button.active {
		background: var(--tab-bg);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field.row {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
	label {
		font-size: 14px;
		color: var(--text-secondary);
	}
	input,
	textarea,
	select {
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--text);
		font: inherit;
	}
	.invite {
		width: 100%;
		font-family: monospace;
		font-size: 12px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.exportnote {
		font-size: 14px;
		color: var(--text-secondary);
	}
	.exportnote a {
		color: var(--accent);
	}
	.switch {
		position: relative;
		display: inline-block;
		width: 36px;
		height: 20px;
	}
	.switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	.slider {
		position: absolute;
		inset: 0;
		background: var(--chakra-colors-gray-300);
		border-radius: 999px;
		transition: 0.2s;
	}
	.slider::before {
		content: '';
		position: absolute;
		height: 16px;
		width: 16px;
		left: 2px;
		top: 2px;
		background: #fff;
		border-radius: 50%;
		transition: 0.2s;
	}
	.switch input:checked + .slider {
		background: var(--chakra-colors-teal-500);
	}
	.switch input:checked + .slider::before {
		transform: translateX(16px);
	}
</style>
