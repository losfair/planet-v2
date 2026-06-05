import { db } from './db';
import { rowToSnippet, decodeCursor, encodeCursor, type NoteRow } from './notes';
import type { ApiSearchNoteRsp } from '$lib/types';

/**
 * Search a user's notes by keyword. Tokens beginning with `#` are treated as
 * (hierarchical) tag filters; the rest are matched against the FTS index.
 */
export function searchNotes(opts: {
	username: string;
	keyword: string;
	viewer: string | null;
	cursor?: string;
	limit: number;
}): ApiSearchNoteRsp {
	const tokens = opts.keyword
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 10);
	const tags = tokens.filter((t) => t.startsWith('#')).map((t) => t.slice(1)).filter(Boolean);
	const terms = tokens.filter((t) => !t.startsWith('#'));

	const isSelf = opts.viewer === opts.username;
	const cursor = decodeCursor(opts.cursor);

	const where: string[] = ['n.username = ?'];
	const params: (string | number)[] = [opts.username];

	if (!isSelf) where.push('n.private = 0');

	if (terms.length) {
		const ftsQuery = terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' ');
		where.push(
			'n.id IN (SELECT note_id FROM notes_fts WHERE username = n.username AND notes_fts MATCH ?)'
		);
		params.push(ftsQuery);
	}

	for (const tag of tags) {
		where.push(
			'EXISTS (SELECT 1 FROM note_tags t WHERE t.username = n.username AND t.note_id = n.id AND (t.tag = ? OR t.tag LIKE ?))'
		);
		params.push(tag, tag + '/%');
	}

	if (cursor) {
		where.push('(n.real_ts < ? OR (n.real_ts = ? AND n.id < ?))');
		params.push(cursor.ts, cursor.ts, cursor.id);
	}

	const sql = `SELECT n.* FROM notes n WHERE ${where.join(' AND ')} ORDER BY n.real_ts DESC, n.id DESC LIMIT ?`;
	params.push(opts.limit + 1);

	const rows = db.query<NoteRow, (string | number)[]>(sql).all(...params);
	const hasMore = rows.length > opts.limit;
	const page = rows.slice(0, opts.limit);
	const notes = page.map((r) => rowToSnippet(r, { withBacklinks: true, viewer: opts.viewer }));
	const nextCursor = hasMore
		? encodeCursor({ ts: page[page.length - 1].real_ts, id: page[page.length - 1].id })
		: null;

	return { notes, cursor: nextCursor, tagSearch: tags.length > 0 && terms.length === 0 };
}
