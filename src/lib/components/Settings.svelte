<script lang="ts">
	import { loadJson } from '$lib/client/api';
	import { toast } from '$lib/client/toast.svelte';
	import { colorMode } from '$lib/client/colorMode.svelte';
	import { invalidateAll } from '$app/navigation';
	import Button from './Button.svelte';
	import type { FullUserInfo } from '$lib/types';

	let { username, onClose }: { username: string; onClose: () => void } = $props();

	let tab = $state<'account' | 'integration' | 'data'>('account');

	// loaded user info
	let loaded = $state(false);
	let displayName = $state('');
	let description = $state('');
	let fontFamily = $state('sans-serif');

	// wayback machine
	let wbWhere = $state('none');
	let wbAk = $state('');
	let wbSk = $state('');

	let saving = $state(false);

	$effect(() => {
		loadJson<FullUserInfo & { username: string }>(
			`/api/v1/user?username=${encodeURIComponent(username)}`
		).then((u) => {
			displayName = u.displayName || '';
			description = u.description || '';
			fontFamily = u.contentFontFamily || 'sans-serif';
			if (u.waybackMachine) {
				wbWhere = u.waybackMachine.where || 'none';
				wbAk = u.waybackMachine.ak || '';
				wbSk = u.waybackMachine.sk || '';
			}
			loaded = true;
		});
	});

	async function save() {
		saving = true;
		try {
			await loadJson('/me/api/v1/update_user', {
				displayName,
				description,
				contentFontFamily: fontFamily || null,
				waybackMachine:
					wbWhere === 'none' ? null : { where: wbWhere, ak: wbAk, sk: wbSk }
			});
			toast.show({ title: 'Updated', description: 'Your settings have been updated.', status: 'success' });
			await invalidateAll();
			onClose();
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		} finally {
			saving = false;
		}
	}

	// --- data tab ---
	let apiToken = $state('');
	let tokenBusy = $state(false);
	let emails = $state<string[] | null>(null);

	async function createToken() {
		tokenBusy = true;
		try {
			const r = await loadJson<{ token: string }>('/me/api/v1/openapi/create_token', {});
			apiToken = r.token;
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		} finally {
			tokenBusy = false;
		}
	}
	async function revokeTokens() {
		if (!confirm('Revoke all API tokens?')) return;
		try {
			await loadJson('/me/api/v1/openapi/revoke_all_tokens', {});
			apiToken = '';
			toast.show({ title: 'All API tokens revoked', status: 'success' });
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		}
	}
	function loadEmails() {
		loadJson<{ emails: string[] }>('/me/api/v1/emails').then((x) => (emails = x.emails));
	}

	// --- export: ZIP of <note-id>.md files (matches the original) ---
	let exportBusy = $state(false);
	let exportProgress = $state(0);

	async function exportNotes() {
		exportBusy = true;
		exportProgress = 0;
		try {
			const { default: JSZip } = await import('jszip');
			const zip = new JSZip();
			let cursor = '';
			for (;;) {
				const rsp = await loadJson<{
					snippets: { id: string; markdown: string }[];
					cursor: string | null;
				}>(
					`/api/v1/notes?username=${encodeURIComponent(username)}&cursor=${encodeURIComponent(cursor)}&limit=100`
				);
				for (const note of rsp.snippets) zip.file(`${note.id}.md`, note.markdown);
				exportProgress += rsp.snippets.length;
				if (!rsp.cursor) break;
				cursor = rsp.cursor;
			}
			const blob = await zip.generateAsync({ type: 'blob' });
			const now = new Date();
			const filename = `planet_export_${username}_${now.toISOString().split('T')[0]}-${now.getTime()}.zip`;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			toast.show({ title: 'Export failed', description: String(e), status: 'error' });
		} finally {
			exportBusy = false;
		}
	}

	// --- import: read an export ZIP and recreate notes ---
	let importInput = $state<HTMLInputElement>();
	let importBusy = $state(false);
	let importResult = $state<number | null>(null);

	async function importNotes() {
		const file = importInput?.files?.[0];
		if (!file) return;
		importBusy = true;
		importResult = null;
		try {
			const { default: JSZip } = await import('jszip');
			const zip = await JSZip.loadAsync(file);
			const notes: { id: string; markdown: string }[] = [];
			for (const [name, entry] of Object.entries(zip.files)) {
				if (entry.dir || !name.toLowerCase().endsWith('.md')) continue;
				const markdown = await entry.async('string');
				const id = name.replace(/\.md$/i, '').split('/').pop() || '';
				notes.push({ id, markdown });
			}
			const r = await loadJson<{ imported: number }>('/me/api/v1/import', { notes });
			importResult = r.imported;
			toast.show({ title: `Imported ${r.imported} note(s)`, status: 'success' });
			await invalidateAll();
		} catch (e) {
			toast.show({ title: 'Import failed', description: String(e), status: 'error' });
		} finally {
			importBusy = false;
			if (importInput) importInput.value = '';
		}
	}
</script>

<div class="settings">
	<div class="tabs">
		<button class:active={tab === 'account'} onclick={() => (tab = 'account')}>Account</button>
		<button class:active={tab === 'integration'} onclick={() => (tab = 'integration')}>Integration</button>
		<button class:active={tab === 'data'} onclick={() => (tab = 'data')}>Data</button>
	</div>

	{#if !loaded}
		<p class="muted">Loading…</p>
	{:else if tab === 'account'}
		<section>
			<h3>Personal info</h3>
			<div class="field"><label for="dn">Name</label><input id="dn" bind:value={displayName} maxlength="30" /></div>
			<div class="field"><label for="bio">Bio</label><textarea id="bio" bind:value={description} rows="3" maxlength="500"></textarea></div>
		</section>

		<section>
			<h3>Preferences</h3>
			<div class="row">
				<span>Preferred font</span>
				<select bind:value={fontFamily} class="w-220">
					<option value="sans-serif">sans-serif</option>
					<option value="serif">serif</option>
					<option value="monospace">monospace</option>
				</select>
			</div>
			<div class="row">
				<div>
					<div>Dark mode</div>
					<div class="muted sm">Only applies to the current session.</div>
				</div>
				<label class="switch">
					<input type="checkbox" checked={colorMode.current === 'dark'} onchange={() => colorMode.toggle()} />
					<span class="slider"></span>
				</label>
			</div>
		</section>

		<div class="actions"><Button colorScheme="teal" loading={saving} onclick={save}>Save</Button></div>
	{:else if tab === 'integration'}
		<section>
			<h3>Wayback Machine <span class="badge">BETA</span></h3>
			<p class="muted">Save a snapshot of external URLs referenced in notes to the Internet Archive (archive.org).</p>
			<div class="row">
				<span>Archiving</span>
				<select bind:value={wbWhere} class="w-220">
					<option value="none">Disable</option>
					<option value="public">Public notes only</option>
					<option value="all">All notes</option>
				</select>
			</div>
			{#if wbWhere !== 'none'}
				<p class="muted sm">
					Get your archive.org credentials
					<a class="link" href="https://archive.org/account/s3.php" target="_blank" rel="noopener">here</a>.
				</p>
				<div class="field"><label for="ak">Access key</label><input id="ak" bind:value={wbAk} /></div>
				<div class="field"><label for="sk">Secret key</label><input id="sk" type="password" bind:value={wbSk} /></div>
			{/if}
		</section>
		<div class="actions"><Button colorScheme="teal" loading={saving} onclick={save}>Save</Button></div>
	{:else}
		<section>
			<h3>Export</h3>
			<p class="muted">Export all your notes in Markdown format (a ZIP of .md files).</p>
			<Button colorScheme="gray" loading={exportBusy} onclick={exportNotes}>Export</Button>
			{#if exportBusy}<p class="muted sm">Loaded {exportProgress} notes…</p>{/if}
		</section>

		<section>
			<h3>Import</h3>
			<p class="muted">Import notes from a Planet export ZIP.</p>
			<input
				class="file"
				type="file"
				accept=".zip,application/zip"
				bind:this={importInput}
				onchange={importNotes}
			/>
			{#if importBusy}<p class="muted sm">Importing…</p>{/if}
			{#if importResult !== null}<p class="muted sm">Imported {importResult} note(s).</p>{/if}
		</section>

		<section>
			<h3>Version history</h3>
			<p class="muted">View mutation logs from the last 90 days.</p>
			<Button colorScheme="gray" href="/data/history" onclick={onClose}>Open</Button>
		</section>

		<section>
			<h3>API</h3>
			<p class="muted">Programmatic access to your planet.</p>
			<div class="api-actions">
				<Button colorScheme="gray" loading={tokenBusy} onclick={createToken}>Create token</Button>
				<Button colorScheme="red" variant="outline" onclick={revokeTokens}>Revoke all</Button>
			</div>
			{#if apiToken}
				<textarea class="token" readonly rows="2">{apiToken}</textarea>
				<p class="muted sm">Copy this token now — it won't be shown again.</p>
			{/if}
		</section>

		<section>
			<h3>Delete account</h3>
			<p class="muted">
				Please contact <strong>hello@planet.ink</strong> using
				{#if emails}<strong>{emails.join(' / ')}</strong>{:else}<button class="link inline" onclick={loadEmails}>(click to view)</button>{/if}
				to delete your account.
			</p>
		</section>
	{/if}
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 20px;
		min-width: 340px;
		max-height: 70vh;
		overflow-y: auto;
	}
	.tabs {
		display: flex;
		gap: 8px;
		position: sticky;
		top: 0;
		background: var(--card-bg);
		padding-bottom: 4px;
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
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h3 {
		font-size: 18px;
		font-weight: bold;
		margin: 0;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
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
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.w-220 {
		width: 220px;
	}
	.muted {
		color: var(--text-secondary);
		font-size: 15px;
		margin: 0;
	}
	.sm {
		font-size: 13px;
	}
	.badge {
		font-size: 10px;
		font-weight: 700;
		border-radius: 6px;
		padding: 1px 6px;
		background: var(--chakra-colors-gray-200);
		color: var(--chakra-colors-gray-700);
	}
	.file {
		font: inherit;
		font-size: 14px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
	}
	.api-actions {
		display: flex;
		gap: 8px;
	}
	.token {
		width: 100%;
		font-family: monospace;
		font-size: 12px;
	}
	.link {
		color: var(--accent);
	}
	.link.inline {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		font: inherit;
	}
	.switch {
		position: relative;
		display: inline-block;
		width: 36px;
		height: 20px;
		flex-shrink: 0;
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
