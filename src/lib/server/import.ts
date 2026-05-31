import { createNote } from './notes';
import { limits } from './config';

export interface ImportNote {
	/** Original note id (e.g. "2026-05-30-abcd"); used to recover the date. */
	id?: string;
	markdown: string;
}

/** Recover a note's timestamp from the YYYY-MM-DD prefix of its id. */
function tsFromId(id: string | undefined): number | undefined {
	if (!id) return undefined;
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(id);
	if (!m) return undefined;
	const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return Number.isNaN(ts) ? undefined : ts;
}

/**
 * Import notes from an export ZIP (one `<id>.md` per note, raw markdown).
 * The export format carries no visibility metadata, so imported notes default
 * to private; the original date is recovered from the id prefix when possible.
 * Returns how many notes were created.
 */
export function importNotes(username: string, notes: ImportNote[]): number {
	const prepared = notes
		.filter((n) => n.markdown && n.markdown.trim())
		.map((n) => ({
			content: n.markdown.slice(0, limits.maxNoteSize),
			realTs: tsFromId(n.id)
		}))
		// Oldest-first so per-user id sequencing stays chronological.
		.sort((a, b) => (a.realTs ?? 0) - (b.realTs ?? 0));

	let imported = 0;
	for (const n of prepared) {
		createNote(username, { content: n.content, private: true, realTs: n.realTs });
		imported++;
	}
	return imported;
}
