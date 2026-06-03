// Hashtag matching, shared by server-side extraction (note_tags) and
// client-side rendering (note content links) so the two never diverge.
//
// A tag:
//   - is preceded by start-of-text or whitespace,
//   - starts with a letter / digit / underscore,
//   - may contain hyphens and underscores,
//   - may be hierarchical with `/`-separated segments,
//   - does NOT include trailing punctuation (e.g. "#tags," -> "tags").
//
// match[0] is "#tag"; match[1] is the tag itself (no leading "#").
export const hashTagRegex =
	/(?<=^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_-]*(?:\/[\p{L}\p{N}_][\p{L}\p{N}_-]*)*)/gu;

/** Extract the distinct hashtags from a piece of text. */
export function extractTags(text: string): string[] {
	const out = new Set<string>();
	let m: RegExpExecArray | null;
	hashTagRegex.lastIndex = 0;
	while ((m = hashTagRegex.exec(text))) out.add(m[1]);
	return [...out];
}
