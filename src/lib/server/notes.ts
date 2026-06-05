import { db, tx } from './db';
import { genNoteId } from './ids';
import { renderMarkdown, toPlainText } from './markdown';
import { extractForwardLinks, extractTags, extractMentions } from './parse';
import { logEvent } from './log';
import { limits } from './config';
import type { NoteLink, NoteLinkWithPosition, RenderableSnippet } from '$lib/types';

export interface NoteRow {
	username: string;
	id: string;
	real_ts: number;
	edit_count: number;
	content_html: string;
	markdown: string;
	private: number;
	deliverable_ts: number | null;
	created_at: number;
	updated_at: number;
}

export function getNoteRow(username: string, id: string): NoteRow | null {
	return (
		db
			.query<NoteRow, [string, string]>('SELECT * FROM notes WHERE username = ? AND id = ?')
			.get(username, id) ?? null
	);
}

/** Title of a note = first line of plaintext, truncated. */
export function noteTitle(markdown: string): string {
	const text = toPlainText(markdown);
	return text.length > 80 ? text.slice(0, 80) : text;
}

function forwardLinksOf(username: string, id: string): NoteLinkWithPosition[] {
	const rows = db
		.query<
			{ to_username: string; to_id: string; position: number; text: string },
			[string, string]
		>(
			'SELECT to_username, to_id, position, text FROM note_links WHERE from_username = ? AND from_id = ? ORDER BY position'
		)
		.all(username, id);
	return rows.map((r) => ({
		username: r.to_username,
		fullId: r.to_id,
		position: r.position,
		text: r.text,
		title: linkTitle(r.to_username, r.to_id)
	}));
}

function backlinksOf(username: string, id: string): NoteLink[] {
	const rows = db
		.query<{ from_username: string; from_id: string }, [string, string]>(
			'SELECT DISTINCT from_username, from_id FROM note_links WHERE to_username = ? AND to_id = ?'
		)
		.all(username, id);
	return rows.map((r) => ({
		username: r.from_username,
		fullId: r.from_id,
		title: linkTitle(r.from_username, r.from_id)
	}));
}

function linkTitle(username: string, id: string): string | undefined {
	const row = getNoteRow(username, id);
	if (!row) return undefined;
	if (row.private) return undefined; // don't leak private titles
	return noteTitle(row.markdown) || undefined;
}

export function rowToSnippet(
	row: NoteRow,
	opts: { withBacklinks?: boolean } = {}
): RenderableSnippet {
	const ann = db
		.query<{ color: string | null }, [string, string]>(
			'SELECT color FROM annotations WHERE username = ? AND note_id = ?'
		)
		.get(row.username, row.id);
	const snippet: RenderableSnippet = {
		id: row.id,
		utcDate: new Date(row.real_ts).toUTCString(),
		content: row.content_html,
		editCount: row.edit_count,
		private: !!row.private,
		markdown: row.markdown,
		forwardLinks: forwardLinksOf(row.username, row.id),
		username: row.username
	};
	if (ann?.color) snippet.color = ann.color;
	if (opts.withBacklinks) snippet.backlinks = backlinksOf(row.username, row.id);
	return snippet;
}

/** True when `viewer` is allowed to see `row`. */
export function canView(row: NoteRow, viewer: string | null): boolean {
	if (!row.private) return true;
	return viewer === row.username;
}

function reindex(username: string, id: string, markdown: string, isPrivate: boolean) {
	// Forward links
	db.query('DELETE FROM note_links WHERE from_username = ? AND from_id = ?').run(username, id);
	const links = extractForwardLinks(markdown, limits.maxForwardLinks);
	const insLink = db.query(
		'INSERT OR IGNORE INTO note_links (from_username, from_id, to_username, to_id, position, text) VALUES (?, ?, ?, ?, ?, ?)'
	);
	for (const l of links) {
		insLink.run(username, id, l.username, l.fullId, l.position, l.text);
	}

	// Tags
	db.query('DELETE FROM note_tags WHERE username = ? AND note_id = ?').run(username, id);
	const insTag = db.query(
		'INSERT OR IGNORE INTO note_tags (username, note_id, tag, private) VALUES (?, ?, ?, ?)'
	);
	for (const tag of extractTags(markdown)) {
		insTag.run(username, id, tag, isPrivate ? 1 : 0);
	}

	// FTS
	db.query('DELETE FROM notes_fts WHERE note_id = ? AND username = ?').run(id, username);
	db.query('INSERT INTO notes_fts (text, username, note_id) VALUES (?, ?, ?)').run(
		toPlainText(markdown),
		username,
		id
	);
}

function notify(fromUser: string, noteId: string, markdown: string) {
	const now = Date.now();
	const ins = db.query(
		'INSERT INTO notifications (recipient, ts, notif_type, payload) VALUES (?, ?, ?, ?)'
	);
	// at-mentions
	for (const mentioned of extractMentions(markdown)) {
		if (mentioned === fromUser) continue;
		const exists = db.query('SELECT 1 FROM users WHERE username = ?').get(mentioned);
		if (!exists) continue;
		ins.run(mentioned, now, 'at_mention', JSON.stringify({ mentioned_by: fromUser, note_id: noteId }));
	}
	// links
	for (const l of extractForwardLinks(markdown, limits.maxForwardLinks)) {
		if (l.username === fromUser) continue;
		const exists = db.query('SELECT 1 FROM users WHERE username = ?').get(l.username);
		if (!exists) continue;
		ins.run(
			l.username,
			now,
			'link',
			JSON.stringify({ linked_by: fromUser, note_id: noteId, target: l.fullId })
		);
	}
}

export function createNote(
	username: string,
	input: { content: string; private: boolean; realTs?: number }
): { id: string } {
	if (input.content.length > limits.maxNoteSize) {
		throw new ApiError(400, 'Note too large');
	}
	return tx(() => {
		const now = Date.now();
		const realTs = input.realTs ?? now;
		const id = genNoteId(username, realTs);
		const html = renderMarkdown(input.content);
		db.query(
			`INSERT INTO notes (username, id, real_ts, edit_count, content_html, markdown, private, created_at, updated_at)
			 VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`
		).run(username, id, realTs, html, input.content, input.private ? 1 : 0, now, now);
		reindex(username, id, input.content, input.private);
		notify(username, id, input.content);
		logEvent(username, 'create_note', id, { private: input.private });
		return { id };
	});
}

export function updateNote(
	username: string,
	input: { id: string; content: string; private: boolean }
): void {
	if (input.content.length > limits.maxNoteSize) {
		throw new ApiError(400, 'Note too large');
	}
	const row = getNoteRow(username, input.id);
	if (!row) throw new ApiError(404, 'Note not found');
	tx(() => {
		const now = Date.now();
		const html = renderMarkdown(input.content);
		db.query(
			`UPDATE notes SET content_html = ?, markdown = ?, private = ?, edit_count = edit_count + 1, updated_at = ?
			 WHERE username = ? AND id = ?`
		).run(html, input.content, input.private ? 1 : 0, now, username, input.id);
		reindex(username, input.id, input.content, input.private);
		notify(username, input.id, input.content);
		logEvent(username, 'update_note', input.id, {
			private: input.private,
			previousContent: row.markdown,
			previousPrivate: !!row.private
		});
	});
}

export function deleteNote(username: string, id: string): void {
	const row = getNoteRow(username, id);
	if (!row) throw new ApiError(404, 'Note not found');
	tx(() => {
		db.query('DELETE FROM notes WHERE username = ? AND id = ?').run(username, id);
		db.query('DELETE FROM note_links WHERE from_username = ? AND from_id = ?').run(username, id);
		db.query('DELETE FROM note_tags WHERE username = ? AND note_id = ?').run(username, id);
		db.query('DELETE FROM annotations WHERE username = ? AND note_id = ?').run(username, id);
		db.query('DELETE FROM notes_fts WHERE note_id = ? AND username = ?').run(id, username);
		// unpin if pinned
		db.query('UPDATE users SET top_note = NULL WHERE username = ? AND top_note = ?').run(
			username,
			id
		);
		logEvent(username, 'delete_note', id, {
			previousContent: row.markdown,
			previousPrivate: !!row.private
		});
	});
}

export function annotateNote(username: string, id: string, color: string | null): void {
	const row = getNoteRow(username, id);
	if (!row) throw new ApiError(404, 'Note not found');
	db.query(
		`INSERT INTO annotations (username, note_id, color, updated_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(username, note_id) DO UPDATE SET color = excluded.color, updated_at = excluded.updated_at`
	).run(username, id, color, Date.now());
	logEvent(username, 'annotate_note', id, { color });
}

// --- cursor helpers -------------------------------------------------------

export interface Cursor {
	ts: number;
	id: string;
}

export function encodeCursor(c: Cursor): string {
	return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(s: string | null | undefined): Cursor | null {
	if (!s) return null;
	try {
		const o = JSON.parse(Buffer.from(s, 'base64url').toString('utf-8'));
		if (typeof o.ts === 'number' && typeof o.id === 'string') return o;
	} catch {
		/* ignore */
	}
	return null;
}

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}
