<script lang="ts">
	import { tick } from 'svelte';
	import { hashTagRegex, atMentionRegex, urlRegex } from '$lib/client/format';
	import type { RenderableSnippet } from '$lib/types';
	import { notePopup } from '$lib/client/notePopup.svelte';

	let {
		snippet,
		expandedView = false
	}: { snippet: RenderableSnippet; light?: boolean; expandedView?: boolean } = $props();

	let container: HTMLDivElement;
	let contentHeight = $state(0);
	let expanded = $state(false);

	const COLLAPSED_HEIGHT = 300;
	const COLLAPSE_GRACE = 100;

	const shouldCollapse = $derived(
		!expandedView && !expanded && contentHeight > COLLAPSED_HEIGHT + COLLAPSE_GRACE
	);

	function escapeRegExp(s: string): string {
		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function rewrite(
		nodes: NodeListOf<HTMLElement>,
		regex: RegExp,
		build: (a: HTMLAnchorElement, m: RegExpExecArray) => void
	) {
		nodes.forEach((p) => {
			const children: ChildNode[] = [];
			p.childNodes.forEach((n) => {
				if (n.nodeName === '#text' && n.textContent) {
					let match: RegExpExecArray | null;
					let prev = 0;
					regex.lastIndex = 0;
					while ((match = regex.exec(n.textContent))) {
						children.push(document.createTextNode(n.textContent.substring(prev, match.index)));
						const a = document.createElement('a');
						build(a, match);
						children.push(a);
						prev = match.index + match[0].length;
					}
					children.push(document.createTextNode(n.textContent.substring(prev)));
				} else {
					children.push(n);
				}
			});
			p.innerHTML = '';
			children.forEach((c) => p.appendChild(c));
		});
	}

	function process() {
		if (!container) return;
		const sel = () => container.querySelectorAll<HTMLElement>('p, li, th, td');

		// Forward links (note -> note references)
		if (snippet.forwardLinks.length) {
			const re = new RegExp(
				snippet.forwardLinks
					.map((x) => '(' + escapeRegExp(x.text || `@${x.username}/${x.fullId}`) + ')')
					.join('|'),
				'g'
			);
			rewrite(sel(), re, (a, match) => {
				for (let i = 1; i < match.length; i++) {
					if (match[i]) {
						const fl = snippet.forwardLinks[i - 1];
						a.href = `/people/${fl.username}/${fl.fullId}`;
						a.textContent = fl.title || `${fl.username}/${fl.fullId.substring(0, 10)}`;
						a.className = 'forward-link';
						a.dataset.fwd = `${fl.username}/${fl.fullId}`;
						break;
					}
				}
			});
		}

		// @-mentions
		rewrite(sel(), atMentionRegex, (a, m) => {
			a.href = `/people/${m[2]}/notes`;
			a.textContent = m[0];
			a.className = 'at-mention';
		});

		// Hashtags
		rewrite(sel(), hashTagRegex, (a, m) => {
			const tag = m[1];
			a.href = `/people/${snippet.username}/tag/${encodeURIComponent(tag)}`;
			a.textContent = m[0]; // "#tag" (lookbehind keeps the leading space out)
			a.className = 'hashtag';
		});

		// Bare URLs
		rewrite(sel(), urlRegex, (a, m) => {
			a.href = m[0];
			a.textContent = m[0];
			a.target = '_blank';
			a.rel = 'noopener';
		});

		// Forward-link clicks open the note popup instead of navigating.
		container.querySelectorAll<HTMLAnchorElement>('a.forward-link').forEach((a) => {
			a.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (a.dataset.fwd) notePopup.open(a.dataset.fwd);
			});
		});
	}

	function measure() {
		if (!container) return;
		contentHeight = container.clientHeight;
	}

	$effect(() => {
		// Re-run whenever the snippet content or display mode changes.
		void snippet.content;
		void expandedView;
		expanded = expandedView;
		process();
		tick().then(measure);
	});

	$effect(() => {
		if (!container || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(container);
		measure();
		return () => observer.disconnect();
	});
</script>

<div class="note-content">
	<div class="content-window" class:limited={shouldCollapse}>
		<div bind:this={container} class="raw-snippet raw-snippet-light">
			{@html snippet.content}
		</div>
	</div>
	{#if shouldCollapse}
		<div class="height-limiter">
			<button
				type="button"
				class="more-button"
				onclick={(e) => {
					e.stopPropagation();
					expanded = true;
				}}
			>
				<span class="chevron" aria-hidden="true"></span>
				More
			</button>
		</div>
	{/if}
</div>

<style>
	.note-content {
		width: 100%;
	}
	.content-window {
		width: 100%;
		overflow-y: hidden;
	}
	.content-window.limited {
		height: 300px;
	}
	.height-limiter {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		height: 100px;
		margin-top: -100px;
		padding-bottom: 2px;
		background: linear-gradient(rgba(255, 255, 255, 0), var(--card-bg));
	}
	.more-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--chakra-colors-blue-500);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.2;
		cursor: pointer;
	}
	.more-button:hover {
		text-decoration: underline;
	}
	.chevron {
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-top: 6px solid currentColor;
	}
</style>
