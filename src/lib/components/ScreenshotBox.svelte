<script lang="ts">
	import { onMount } from 'svelte';
	import { loadJson } from '$lib/client/api';
	import type { RenderableSnippet } from '$lib/types';
	import NoteContent from './NoteContent.svelte';
	import Spinner from './Spinner.svelte';

	let { snippet }: { snippet: RenderableSnippet } = $props();

	let area = $state<HTMLDivElement>();
	let qrEl = $state<HTMLDivElement>();
	let imgUrl = $state('');
	let displayName = $state(snippet.username);

	onMount(() => {
		let cancelled = false;
		(async () => {
			// Author display name (best-effort).
			try {
				const u = await loadJson<{ displayName?: string; username: string }>(
					`/api/v1/user?username=${encodeURIComponent(snippet.username)}`
				);
				if (!cancelled) displayName = u.displayName || u.username;
			} catch {
				/* keep username */
			}

			const [{ toPng }, qrMod] = await Promise.all([
				import('html-to-image'),
				import('qr-code-styling')
			]);
			if (cancelled || !area || !qrEl) return;

			const QRCodeStyling = qrMod.default;
			const qr = new QRCodeStyling({
				width: 56,
				height: 56,
				data: `${location.origin}/people/${snippet.username}/${snippet.id}`,
				dotsOptions: { color: '#2c5282', type: 'rounded' },
				backgroundOptions: { color: 'rgba(0,0,0,0)' }
			});
			qrEl.innerHTML = '';
			qr.append(qrEl);

			// Let the QR, fonts and any images settle, then rasterize at 3x.
			await new Promise((r) => setTimeout(r, 250));
			if (cancelled || !area) return;
			try {
				// skipFonts: the cross-origin Google Fonts stylesheet can't be
				// inlined; the card uses system fonts, so embedding isn't needed.
				imgUrl = await toPng(area, { pixelRatio: 3, cacheBust: true, skipFonts: true });
			} catch (e) {
				console.error('screenshot failed', e);
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

<div class="wrap">
	{#if imgUrl}
		<p class="hint">Image generated. Right-click or long press to save:</p>
		<img class="result" src={imgUrl} alt="Note screenshot" />
	{:else}
		<div class="loading"><Spinner size="16px" /> <span>Generating screenshot…</span></div>
	{/if}

	<!-- Off-screen capture target (rendered, but not visible in the modal). -->
	<div class="offscreen" aria-hidden="true">
		<div class="card" bind:this={area}>
			<div class="note-box">
				<NoteContent {snippet} light />
			</div>
			<div class="footer">
				<div class="meta">
					<div class="brand"><strong>Planet</strong> • <span>{displayName}</span></div>
					<div class="id">{snippet.id.substring(0, 10)}</div>
				</div>
				<div class="qr" bind:this={qrEl}></div>
			</div>
		</div>
	</div>
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.hint {
		font-size: 14px;
		margin: 0;
	}
	.result {
		border-radius: var(--radius-md);
		max-width: 100%;
	}
	.loading {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-secondary);
		font-size: 14px;
		padding: 8px 0;
	}
	.offscreen {
		position: fixed;
		left: -100000px;
		top: 0;
		pointer-events: none;
	}
	/* The capture card — forced light, matches the original layout. */
	.card {
		width: 400px;
		background: #bee3f8;
		padding: 30px 20px 20px;
		color: #000;
		/* light tokens so note code blocks render light regardless of app theme */
		--code-bg: #edf2f7;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
	}
	.note-box {
		background: #fff;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border-radius: var(--radius-md);
		padding: 10px;
	}
	.footer {
		display: flex;
		align-items: center;
		margin-top: 12px;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
	}
	.brand {
		color: #2b6cb0;
		white-space: nowrap;
	}
	.id {
		color: #4299e1;
	}
	.qr {
		width: 60px;
		height: 60px;
		background: #ebf8ff;
		padding: 2px;
		border-radius: var(--radius-md);
		margin-left: auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
