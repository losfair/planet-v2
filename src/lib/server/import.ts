import { createNote } from './notes';
import { limits } from './config';

interface ParsedNote {
	realTs?: number;
	private: boolean;
	content: string;
}

// Matches the per-note frontmatter fence produced by the export endpoint:
//   ---
//   id: <id>
//   date: <iso>
//   visibility: public|private
//   ---
const FENCE = /^---\r?\nid: .+\r?\ndate: (.+)\r?\nvisibility: (public|private)\r?\n---\r?\n/gm;

/** Parse a Planet Markdown export into individual notes. */
export function parseExport(text: string): ParsedNote[] {
	const fences: { contentStart: number; matchStart: number; date: string; visibility: string }[] = [];
	let m: RegExpExecArray | null;
	FENCE.lastIndex = 0;
	while ((m = FENCE.exec(text))) {
		fences.push({
			matchStart: m.index,
			contentStart: FENCE.lastIndex,
			date: m[1],
			visibility: m[2]
		});
	}

	const notes: ParsedNote[] = [];
	for (let i = 0; i < fences.length; i++) {
		const start = fences[i].contentStart;
		const stop = i + 1 < fences.length ? fences[i + 1].matchStart : text.length;
		const content = text.slice(start, stop).trim();
		if (!content) continue;
		const ts = Date.parse(fences[i].date);
		notes.push({
			realTs: Number.isNaN(ts) ? undefined : ts,
			private: fences[i].visibility === 'private',
			content: content.slice(0, limits.maxNoteSize)
		});
	}
	return notes;
}

/** Import notes from an export file; returns how many were created. */
export function importNotes(username: string, text: string): number {
	const parsed = parseExport(text);
	let imported = 0;
	// Oldest-first so per-user id sequencing stays chronological.
	parsed.sort((a, b) => (a.realTs ?? 0) - (b.realTs ?? 0));
	for (const note of parsed) {
		createNote(username, { content: note.content, private: note.private, realTs: note.realTs });
		imported++;
	}
	return imported;
}
