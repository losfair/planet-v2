import type { NoteLinkWithPosition } from '$lib/types';

// Patterns mirror the original (util/format.ts + service-logic/data/links.ts).
const atLinkRegex = /@([a-z0-9.-]{1,50})\/([0-9a-zA-Z_-]{1,50})/g;
const urlLinkRegex = /https?:\/\/[^\s)]+\/people\/([a-z0-9.-]{1,50})\/([0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9a-zA-Z_-]{1,50})/g;
const hashTagRegex = /(?:\s|^)(#[^#\s]{1,100})/g;
const atMentionRegex = /(?:\s|^)@([a-z0-9.-]{1,30}[a-z0-9])(?![a-z0-9.\-/])/g;

/** Extract forward links (note -> note references) from markdown source. */
export function extractForwardLinks(md: string, max: number): NoteLinkWithPosition[] {
	const out: NoteLinkWithPosition[] = [];
	const seen = new Set<string>();

	let m: RegExpExecArray | null;
	atLinkRegex.lastIndex = 0;
	while ((m = atLinkRegex.exec(md))) {
		const username = m[1];
		const fullId = m[2];
		const key = `${username}/${fullId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ username, fullId, position: m.index, text: m[0] });
		if (out.length >= max) return out;
	}

	urlLinkRegex.lastIndex = 0;
	while ((m = urlLinkRegex.exec(md))) {
		const username = m[1];
		const fullId = m[2];
		const key = `${username}/${fullId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ username, fullId, position: m.index, text: m[0] });
		if (out.length >= max) return out;
	}

	return out;
}

/** Extract hashtags (full hierarchical strings, e.g. "a/b/c") from markdown. */
export function extractTags(md: string): string[] {
	const out = new Set<string>();
	let m: RegExpExecArray | null;
	hashTagRegex.lastIndex = 0;
	while ((m = hashTagRegex.exec(md))) {
		const tag = m[1].slice(1); // drop leading '#'
		if (tag) out.add(tag);
	}
	return [...out];
}

/** Extract @username mentions (not note links) for notifications. */
export function extractMentions(md: string): string[] {
	const out = new Set<string>();
	let m: RegExpExecArray | null;
	atMentionRegex.lastIndex = 0;
	while ((m = atMentionRegex.exec(md))) {
		out.add(m[1]);
	}
	return [...out];
}
