import { db } from './db';
import { getUser } from './users';
import {
	rowToSnippet,
	canView,
	getNoteRow,
	decodeCursor,
	encodeCursor,
	type NoteRow
} from './notes';
import type { ApiGetSnippetsRsp, RenderableSnippet } from '$lib/types';

/** Build the getSnippets response for a user page / single note. */
export function getSnippets(opts: {
	username: string;
	viewer: string | null;
	cursor?: string;
	id?: string;
	limit: number;
}): ApiGetSnippetsRsp | null {
	const user = getUser(opts.username);
	if (!user) return null;
	const author = user.display_name || user.username;

	// Single-note lookup.
	if (opts.id) {
		const row = getNoteRow(opts.username, opts.id);
		const snippets: RenderableSnippet[] =
			row && canView(row, opts.viewer)
				? [rowToSnippet(row, { withBacklinks: true, viewer: opts.viewer })]
				: [];
		return { snippets, title: '', author, topNote: null, cursor: null };
	}

	const isSelf = opts.viewer === opts.username;
	const cursor = decodeCursor(opts.cursor);

	let sql = 'SELECT * FROM notes WHERE username = ?';
	const params: (string | number)[] = [opts.username];
	if (!isSelf) sql += ' AND private = 0';
	if (cursor) {
		sql += ' AND (real_ts < ? OR (real_ts = ? AND id < ?))';
		params.push(cursor.ts, cursor.ts, cursor.id);
	}
	sql += ' ORDER BY real_ts DESC, id DESC LIMIT ?';
	params.push(opts.limit + 1);

	const rows = db.query<NoteRow, (string | number)[]>(sql).all(...params);
	const hasMore = rows.length > opts.limit;
	const page = rows.slice(0, opts.limit);
	const snippets = page.map((r) => rowToSnippet(r, { withBacklinks: true, viewer: opts.viewer }));

	let nextCursor: string | null = null;
	if (hasMore) {
		const last = page[page.length - 1];
		nextCursor = encodeCursor({ ts: last.real_ts, id: last.id });
	}

	// Top (pinned) note — only on first page.
	let topNote: RenderableSnippet | null = null;
	if (!cursor && user.top_note) {
		const tn = getNoteRow(opts.username, user.top_note);
		if (tn && canView(tn, opts.viewer)) {
			topNote = rowToSnippet(tn, { withBacklinks: true, viewer: opts.viewer });
		}
	}

	return { snippets, title: '', author, topNote, cursor: nextCursor };
}

/** Global stream — all public notes, newest first. */
export function globalStream(cursorStr: string | undefined, limit: number) {
	const cursor = decodeCursor(cursorStr);
	let sql = 'SELECT * FROM notes WHERE private = 0';
	const params: (string | number)[] = [];
	if (cursor) {
		sql += ' AND (real_ts < ? OR (real_ts = ? AND id < ?))';
		params.push(cursor.ts, cursor.ts, cursor.id);
	}
	sql += ' ORDER BY real_ts DESC, id DESC LIMIT ?';
	params.push(limit + 1);
	return paginate(db.query<NoteRow, (string | number)[]>(sql).all(...params), limit, null);
}

/** Follow stream — public notes from followed users plus viewer's own notes. */
export function followStream(viewer: string, cursorStr: string | undefined, limit: number) {
	const cursor = decodeCursor(cursorStr);
	let sql = `SELECT n.* FROM notes n
		WHERE (
			n.username IN (SELECT to_username FROM follows WHERE from_username = ?) AND n.private = 0
		) OR n.username = ?`;
	const params: (string | number)[] = [viewer, viewer];
	if (cursor) {
		sql += ' AND (n.real_ts < ? OR (n.real_ts = ? AND n.id < ?))';
		params.push(cursor.ts, cursor.ts, cursor.id);
	}
	sql += ' ORDER BY n.real_ts DESC, n.id DESC LIMIT ?';
	params.push(limit + 1);
	return paginate(db.query<NoteRow, (string | number)[]>(sql).all(...params), limit, viewer);
}

function paginate(
	rows: NoteRow[],
	limit: number,
	viewer: string | null
): { notes: RenderableSnippet[]; cursor: string | null } {
	const hasMore = rows.length > limit;
	const page = rows.slice(0, limit);
	const notes = page.map((r) => rowToSnippet(r, { withBacklinks: true, viewer }));
	let cursor: string | null = null;
	if (hasMore) {
		const last = page[page.length - 1];
		cursor = encodeCursor({ ts: last.real_ts, id: last.id });
	}
	return { notes, cursor };
}
