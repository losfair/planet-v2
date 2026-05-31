<script lang="ts">
	import { colorMode } from '$lib/client/colorMode.svelte';
	import { hashTagRegex, atMentionRegex, urlRegex } from '$lib/client/format';
	import type { RenderableSnippet } from '$lib/types';
	import { notePopup } from '$lib/client/notePopup.svelte';

	let { snippet }: { snippet: RenderableSnippet } = $props();

	let container: HTMLDivElement;

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
			const tag = m[2].substring(1);
			a.href = `/people/${snippet.username}/tag/${encodeURIComponent(tag)}`;
			a.textContent = m[0];
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

	$effect(() => {
		// Re-run whenever the snippet content changes.
		void snippet.content;
		process();
	});
</script>

<div
	bind:this={container}
	class="raw-snippet {colorMode.current === 'dark' ? 'raw-snippet-dark' : 'raw-snippet-light'}"
>
	{@html snippet.content}
</div>
