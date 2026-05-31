import { db } from './db';
import { evalExpr } from './lens';
import type { GraphQueryExpr, LinkGraph, LinkGraphEdge, LinkGraphNode } from '$lib/types';
import type { NoteRow } from './notes';

/** Validate an untrusted JSON value as a GraphQueryExpr (bounded depth). */
export function validateGraphExpr(o: unknown, depth = 0): GraphQueryExpr | null {
	if (depth > 32 || !o || typeof o !== 'object') return null;
	const e = o as Record<string, unknown>;
	switch (e.type) {
		case 'and':
		case 'or': {
			const l = validateGraphExpr(e.left, depth + 1);
			const r = validateGraphExpr(e.right, depth + 1);
			return l && r ? { type: e.type, left: l, right: r } : null;
		}
		case 'not': {
			const x = validateGraphExpr(e.expr, depth + 1);
			return x ? { type: 'not', expr: x } : null;
		}
		case 'hasId':
			return typeof e.id === 'string' ? { type: 'hasId', id: e.id } : null;
		case 'hasTag':
			return typeof e.tag === 'string' ? { type: 'hasTag', tag: e.tag } : null;
		case 'withoutTag':
			return typeof e.tag === 'string' ? { type: 'withoutTag', tag: e.tag } : null;
		case 'timeAfter':
			return typeof e.time === 'number' ? { type: 'timeAfter', time: e.time } : null;
		case 'timeBefore':
			return typeof e.time === 'number' ? { type: 'timeBefore', time: e.time } : null;
		case 'color':
			return typeof e.color === 'string' ? { type: 'color', color: e.color } : null;
		case 'everyday':
			return typeof e.from === 'number' && typeof e.to === 'number'
				? { type: 'everyday', from: e.from, to: e.to }
				: null;
		case 'true':
			return { type: 'true' };
		case 'false':
			return { type: 'false' };
		case 'public':
			return { type: 'public' };
		default:
			return null;
	}
}

/** First non-empty line of the markdown, truncated (used as the node label). */
function head(markdown: string): string {
	const line = (markdown.split('\n').find((l) => l.trim().length) || '').trim();
	return line.slice(0, 35);
}

/**
 * Build the link graph for a user: note nodes matching `expr`, their forward
 * links, and backlinks from other users' (visible) notes. Edge endpoints are
 * `username/noteId`; node ids are the bare note id.
 */
export function queryGraphForUser(
	username: string,
	viewer: string,
	expr: GraphQueryExpr
): LinkGraph {
	const isSelf = viewer === username;

	// Preload tags & annotation colours for evaluation.
	const tagsByNote = new Map<string, Set<string>>();
	for (const r of db
		.query<{ note_id: string; tag: string }, [string]>(
			'SELECT note_id, tag FROM note_tags WHERE username = ?'
		)
		.all(username)) {
		let s = tagsByNote.get(r.note_id);
		if (!s) tagsByNote.set(r.note_id, (s = new Set()));
		s.add(r.tag);
	}
	const colorByNote = new Map<string, string | null>();
	for (const r of db
		.query<{ note_id: string; color: string | null }, [string]>(
			'SELECT note_id, color FROM annotations WHERE username = ?'
		)
		.all(username)) {
		colorByNote.set(r.note_id, r.color);
	}

	const rows = db
		.query<NoteRow, [string]>('SELECT * FROM notes WHERE username = ? ORDER BY real_ts DESC, id DESC')
		.all(username);

	const matched = rows.filter((row) => {
		if (!isSelf && row.private) return false;
		if (!row.markdown.trim()) return false; // skip empty notes (matches original)
		return evalExpr(expr, {
			id: row.id,
			realTs: row.real_ts,
			private: !!row.private,
			tags: tagsByNote.get(row.id) || new Set(),
			color: colorByNote.get(row.id) || null
		});
	});

	const nodes: LinkGraphNode[] = matched.map((r) => ({
		id: r.id,
		tags: [...(tagsByNote.get(r.id) || [])],
		head: head(r.markdown),
		priv: r.private ? 1 : 0
	}));

	const matchedIds = new Set(matched.map((r) => r.id));
	const edges: LinkGraphEdge[] = [];
	const seen = new Set<string>();
	const push = (from: string, to: string) => {
		const key = from + '|' + to;
		if (seen.has(key)) return;
		seen.add(key);
		edges.push({ from, to });
	};

	// Forward links out of the matched notes.
	for (const l of db
		.query<{ from_id: string; to_username: string; to_id: string }, [string]>(
			'SELECT from_id, to_username, to_id FROM note_links WHERE from_username = ?'
		)
		.all(username)) {
		if (!matchedIds.has(l.from_id)) continue;
		push(`${username}/${l.from_id}`, `${l.to_username}/${l.to_id}`);
	}

	// Backlinks into the matched notes, from other users' visible notes.
	for (const l of db
		.query<{ from_username: string; from_id: string; to_id: string }, [string, string]>(
			`SELECT l.from_username, l.from_id, l.to_id
			 FROM note_links l JOIN notes n ON n.username = l.from_username AND n.id = l.from_id
			 WHERE l.to_username = ? AND l.from_username <> ? AND (n.private = 0 OR n.username = ?)`
		)
		.all(username, username, viewer)) {
		if (!matchedIds.has(l.to_id)) continue;
		push(`${l.from_username}/${l.from_id}`, `${username}/${l.to_id}`);
	}

	return { nodes, edges };
}
