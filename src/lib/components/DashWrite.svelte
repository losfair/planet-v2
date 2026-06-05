<script lang="ts">
	import { untrack } from 'svelte';
	import { loadJson } from '$lib/client/api';
	import { toast } from '$lib/client/toast.svelte';
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';

	let {
		username,
		editingId = '',
		initialContent = '',
		initialPublic = false,
		expandedView = false,
		onSaved,
		onCancel = undefined
	}: {
		username: string;
		editingId?: string;
		initialContent?: string;
		initialPublic?: boolean;
		expandedView?: boolean;
		onSaved: () => void;
		onCancel?: () => void;
	} = $props();

	let content = $state(untrack(() => initialContent));
	let isPublic = $state(untrack(() => initialPublic));
	let saving = $state(false);
	let uploading = $state(false);
	let textarea = $state<HTMLTextAreaElement>();
	let fileInput = $state<HTMLInputElement>();

	function resize() {
		if (!textarea) return;
		textarea.style.height = '0';
		textarea.style.height = textarea.scrollHeight + 'px';
	}

	$effect(() => {
		void content;
		resize();
	});

	async function save() {
		saving = true;
		try {
			if (editingId) {
				await loadJson('/me/api/v1/update_note', { id: editingId, private: !isPublic, content });
			} else {
				await loadJson('/me/api/v1/create_note', { private: !isPublic, content });
				content = '';
			}
			onSaved();
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		} finally {
			saving = false;
		}
	}

	async function uploadImage(file: File) {
		uploading = true;
		try {
			const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
			const ticket = await loadJson<{
				uploadUrl: string;
				uploadHeaders: Record<string, string[]>;
				finalUrl: string;
			}>('/me/api/v1/upload_image', { fileType: ext, size: file.size });
			const headers: Record<string, string> = {};
			for (const [k, v] of Object.entries(ticket.uploadHeaders)) headers[k] = v[0];
			await fetch(ticket.uploadUrl, { method: 'PUT', body: file, headers, credentials: 'include' });
			content += `\n\n![Image](${ticket.finalUrl})`;
		} catch (e) {
			toast.show({ title: 'Error', description: String(e), status: 'error' });
		} finally {
			uploading = false;
		}
	}

	function onFile(e: Event) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (f) uploadImage(f);
	}

	function requestCancel() {
		onCancel?.();
	}
</script>

<div class="dashwrite">
	<textarea
		bind:this={textarea}
		bind:value={content}
		oninput={resize}
		placeholder="Write something…"
		style={expandedView ? '' : 'max-height:450px'}
	></textarea>
	<div class="toolbar">
		<a
			class="md-icon"
			title="Markdown enabled"
			target="_blank"
			rel="noopener"
			href="https://commonmark.org/help/"
			aria-label="Markdown enabled"
		>
			<svg viewBox="0 0 208 128" width="22" height="14">
				<rect width="198" height="118" x="5" y="5" ry="10" stroke-width="10" fill="none" stroke="currentColor" />
				<path d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39zm125 0l-30-33h20V30h20v35h20z" fill="currentColor" />
			</svg>
		</a>
		{#if uploading}
			<Spinner size="14px" />
		{:else}
			<button class="img-btn" title="Upload image" onclick={() => fileInput?.click()} aria-label="Upload image">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<circle cx="8.5" cy="8.5" r="1.5" />
					<path d="M21 15l-5-5L5 21" />
				</svg>
			</button>
		{/if}
		<input type="file" accept="image/*" bind:this={fileInput} onchange={onFile} style="display:none" />
		<span class="spacer"></span>
		<span class="public-label">Public?</span>
		<label class="switch">
			<input type="checkbox" bind:checked={isPublic} />
			<span class="slider"></span>
		</label>
		{#if onCancel}
			<Button size="sm" colorScheme="gray" disabled={saving} onclick={requestCancel}>Cancel</Button>
		{/if}
		<Button size="sm" colorScheme="green" loading={saving} disabled={content === '' || saving} onclick={save}
			>Save</Button
		>
	</div>
</div>

<style>
	.dashwrite {
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--card-bg);
		padding-top: 4px;
		box-shadow: var(--shadow-base);
		border-radius: var(--radius-md);
	}
	textarea {
		min-height: 80px;
		width: 100%;
		border: none;
		resize: none;
		outline: none;
		background: var(--card-bg);
		color: var(--text);
		padding: 12px;
		font-family: var(--note-font, inherit);
		font-size: 14px;
		line-height: 1.8;
		overflow-y: auto;
		border-radius: var(--radius-md) var(--radius-md) 0 0;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 16px 8px;
		color: var(--chakra-colors-gray-500);
	}
	.md-icon,
	.img-btn {
		color: var(--chakra-colors-gray-500);
		background: none;
		border: none;
		cursor: pointer;
		display: inline-flex;
		padding: 0;
	}
	.spacer {
		flex: 1;
	}
	.public-label {
		font-size: 12px;
		color: var(--chakra-colors-gray-500);
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
