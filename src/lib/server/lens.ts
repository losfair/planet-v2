import { db, tx } from './db';
import { rowToSnippet, decodeCursor, encodeCursor, ApiError, type NoteRow } from './notes';
import { logEvent } from './log';
import { limits } from './config';
import type { ApiLensInfo, GraphQueryExpr, RenderableSnippet } from '$lib/types';

// ---------------------------------------------------------------------------
// Query language parser — a TypeScript port of the original Rust LALRPOP
// grammar (helper/src/query_parser/grammar.lalrpop).
//
//   Expr   := Or
//   Or     := And ("or" And)*
//   And    := Not ("and" Not)*
//   Not    := "not" Not | Primary
//   Primary:= "true" | "1" | "false" | "0"
//           | "tag" Str | "id" Str | "color" Str
//           | "before" Date | "after" Date | "public"
//           | "every" "day" EveryDay | "(" Expr ")"
//   EveryDay := "between" Time "and" Time "utc"
//             | "after" Time "utc" | "before" Time "utc"
// ---------------------------------------------------------------------------

function tokenize(input: string): string[] {
	const tokens: string[] = [];
	let i = 0;
	while (i < input.length) {
		const c = input[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (c === '(' || c === ')') {
			tokens.push(c);
			i++;
			continue;
		}
		if (c === '"' || c === "'") {
			const end = input.indexOf(c, i + 1);
			if (end === -1) throw new ApiError(400, 'Unterminated string in query');
			tokens.push(input.slice(i, end + 1));
			i = end + 1;
			continue;
		}
		let j = i;
		while (j < input.length && !/[\s()]/.test(input[j]) && input[j] !== '"' && input[j] !== "'") j++;
		tokens.push(input.slice(i, j));
		i = j;
	}
	return tokens;
}

function unquote(s: string): string {
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
}

function parseDate(s: string): number {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(unquote(s));
	if (!m) throw new ApiError(400, 'Invalid date in query (expected YYYY-MM-DD)');
	return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseTimeOfDay(s: string): number {
	const m = /^(\d{1,2}):(\d{2})$/.exec(unquote(s));
	if (!m) throw new ApiError(400, 'Invalid time of day in query (expected HH:MM)');
	return (Number(m[1]) * 60 + Number(m[2])) * 60 * 1000;
}

class Parser {
	private pos = 0;
	private cost = 0;
	constructor(private tokens: string[]) {}

	private peek(): string | undefined {
		return this.tokens[this.pos];
	}
	private next(): string | undefined {
		return this.tokens[this.pos++];
	}
	private isKw(t: string | undefined, kw: string): boolean {
		return !!t && t.toLowerCase() === kw;
	}
	private bump() {
		if (++this.cost > 20) throw new ApiError(400, 'Query too complex');
	}

	parse(): GraphQueryExpr {
		const e = this.parseOr();
		if (this.pos !== this.tokens.length) throw new ApiError(400, 'Unexpected trailing tokens');
		return e;
	}

	private parseOr(): GraphQueryExpr {
		let left = this.parseAnd();
		while (this.isKw(this.peek(), 'or')) {
			this.next();
			this.bump();
			left = { type: 'or', left, right: this.parseAnd() };
		}
		return left;
	}
	private parseAnd(): GraphQueryExpr {
		let left = this.parseNot();
		while (this.isKw(this.peek(), 'and')) {
			this.next();
			this.bump();
			left = { type: 'and', left, right: this.parseNot() };
		}
		return left;
	}
	private parseNot(): GraphQueryExpr {
		if (this.isKw(this.peek(), 'not')) {
			this.next();
			this.bump();
			return { type: 'not', expr: this.parseNot() };
		}
		return this.parsePrimary();
	}
	private parsePrimary(): GraphQueryExpr {
		const t = this.next();
		if (t === undefined) throw new ApiError(400, 'Unexpected end of query');
		this.bump();
		const lc = t.toLowerCase();
		switch (lc) {
			case 'true':
			case '1':
				return { type: 'true' };
			case 'false':
			case '0':
				return { type: 'false' };
			case 'public':
				return { type: 'public' };
			case 'tag':
				return { type: 'hasTag', tag: unquote(this.expect()) };
			case 'id':
				return { type: 'hasId', id: unquote(this.expect()) };
			case 'color':
				return { type: 'color', color: unquote(this.expect()) };
			case 'before':
				return { type: 'timeBefore', time: parseDate(this.expect()) };
			case 'after':
				return { type: 'timeAfter', time: parseDate(this.expect()) };
			case 'every':
				return this.parseEvery();
			case '(': {
				const e = this.parseOr();
				const close = this.next();
				if (close !== ')') throw new ApiError(400, 'Expected )');
				return e;
			}
			default:
				throw new ApiError(400, `Unexpected token: ${t}`);
		}
	}
	private parseEvery(): GraphQueryExpr {
		if (!this.isKw(this.next(), 'day')) throw new ApiError(400, "Expected 'day' after 'every'");
		const kw = this.next();
		if (this.isKw(kw, 'between')) {
			const from = parseTimeOfDay(this.expect());
			if (!this.isKw(this.next(), 'and')) throw new ApiError(400, "Expected 'and'");
			const to = parseTimeOfDay(this.expect());
			this.expectKw('utc');
			return { type: 'everyday', from, to };
		}
		if (this.isKw(kw, 'after')) {
			const from = parseTimeOfDay(this.expect());
			this.expectKw('utc');
			return { type: 'everyday', from, to: 86400000 - 1 };
		}
		if (this.isKw(kw, 'before')) {
			const to = parseTimeOfDay(this.expect());
			this.expectKw('utc');
			return { type: 'everyday', from: 0, to };
		}
		throw new ApiError(400, "Expected 'between', 'after' or 'before' after 'every day'");
	}
	private expect(): string {
		const t = this.next();
		if (t === undefined) throw new ApiError(400, 'Unexpected end of query');
		return t;
	}
	private expectKw(kw: string) {
		if (!this.isKw(this.next(), kw)) throw new ApiError(400, `Expected '${kw}'`);
	}
}

export function parseGraphQuery(text: string): GraphQueryExpr {
	const tokens = tokenize(text);
	if (!tokens.length) return { type: 'true' };
	return new Parser(tokens).parse();
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export interface EvalNote {
	id: string;
	realTs: number;
	private: boolean;
	tags: Set<string>;
	color: string | null;
}

function tagMatches(tags: Set<string>, tag: string): boolean {
	if (tags.has(tag)) return true;
	for (const t of tags) if (t.startsWith(tag + '/')) return true;
	return false;
}

export function evalExpr(expr: GraphQueryExpr, note: EvalNote): boolean {
	switch (expr.type) {
		case 'and':
			return evalExpr(expr.left, note) && evalExpr(expr.right, note);
		case 'or':
			return evalExpr(expr.left, note) || evalExpr(expr.right, note);
		case 'not':
			return !evalExpr(expr.expr, note);
		case 'hasId':
			return note.id === expr.id;
		case 'hasTag':
			return tagMatches(note.tags, expr.tag);
		case 'withoutTag':
			return !tagMatches(note.tags, expr.tag);
		case 'timeAfter':
			return note.realTs >= expr.time;
		case 'timeBefore':
			return note.realTs <= expr.time;
		case 'color':
			return (note.color || 'default') === expr.color;
		case 'public':
			return !note.private;
		case 'everyday': {
			const tod = note.realTs % 86400000;
			return tod >= expr.from && tod <= expr.to;
		}
		case 'true':
			return true;
		case 'false':
			return false;
	}
}

// ---------------------------------------------------------------------------
// Lens CRUD + query execution
// ---------------------------------------------------------------------------

export interface LensRow {
	username: string;
	id: string;
	description: string;
	query: string;
	expr_json: string | null;
	access: ApiLensInfo['access'];
	group_json: string | null;
	created_at: number;
}

export function lensToApi(row: LensRow): ApiLensInfo {
	return {
		id: row.id,
		description: row.description,
		query: row.query,
		access: row.access,
		group: row.group_json ? JSON.parse(row.group_json) : undefined,
		createdAt: row.created_at
	};
}

export function listLenses(username: string, viewer: string | null): ApiLensInfo[] {
	const rows = db
		.query<LensRow, [string]>('SELECT * FROM lenses WHERE username = ? ORDER BY created_at DESC')
		.all(username);
	const isSelf = viewer === username;
	return rows
		.filter((r) => isSelf || lensVisibleTo(r, viewer))
		.filter((r) => isSelf || r.access !== 'public-hidden')
		.map(lensToApi);
}

export function getLens(username: string, id: string): LensRow | null {
	return (
		db.query<LensRow, [string, string]>('SELECT * FROM lenses WHERE username = ? AND id = ?').get(
			username,
			id
		) ?? null
	);
}

function lensVisibleTo(row: LensRow, viewer: string | null): boolean {
	if (row.access === 'public' || row.access === 'public-hidden') return true;
	if (row.access === 'group') {
		if (!viewer) return false;
		const group: string[] = row.group_json ? JSON.parse(row.group_json) : [];
		return group.includes(viewer);
	}
	return false; // private
}

const lensIdRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]{0,28}[a-zA-Z0-9]$/;

export function editLens(
	username: string,
	input: {
		id: string;
		description: string;
		query: string;
		access: ApiLensInfo['access'];
		group?: string[];
		update: boolean;
	}
): ApiLensInfo {
	if (!lensIdRegex.test(input.id)) throw new ApiError(400, 'Invalid lens id');
	if (input.description.length > 100) throw new ApiError(400, 'Description too long');
	if (input.query.length > 200) throw new ApiError(400, 'Query too long');
	const expr = parseGraphQuery(input.query);
	const group = (input.group || []).slice(0, 50);

	return tx(() => {
		const existing = getLens(username, input.id);
		if (existing && !input.update) throw new ApiError(409, 'Lens already exists');
		if (!existing) {
			const count =
				db
					.query<{ c: number }, [string]>('SELECT COUNT(*) c FROM lenses WHERE username = ?')
					.get(username)?.c ?? 0;
			if (count >= limits.maxLensPerUser) throw new ApiError(400, 'Too many lenses');
		}
		const createdAt = existing ? existing.created_at : Date.now();
		db.query(
			`INSERT INTO lenses (username, id, description, query, expr_json, access, group_json, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(username, id) DO UPDATE SET description=excluded.description, query=excluded.query,
			   expr_json=excluded.expr_json, access=excluded.access, group_json=excluded.group_json`
		).run(
			username,
			input.id,
			input.description,
			input.query,
			JSON.stringify(expr),
			input.access,
			input.access === 'group' ? JSON.stringify(group) : null,
			createdAt
		);
		logEvent(username, 'create_or_update_lens', null, { id: input.id });
		return lensToApi(getLens(username, input.id)!);
	});
}

export function deleteLens(username: string, id: string): void {
	db.query('DELETE FROM lenses WHERE username = ? AND id = ?').run(username, id);
	logEvent(username, 'remove_lens', null, { id });
}

/** Run a parsed expression over a user's notes, returning a page of snippets. */
export function runLensQuery(opts: {
	username: string;
	expr: GraphQueryExpr;
	viewer: string | null;
	cursor?: string;
	limit: number;
}): { output: RenderableSnippet[]; cursor: string | null; numNotes: number } {
	const isSelf = opts.viewer === opts.username;

	// Preload tags & annotations for the user.
	const tagRows = db
		.query<{ note_id: string; tag: string }, [string]>(
			'SELECT note_id, tag FROM note_tags WHERE username = ?'
		)
		.all(opts.username);
	const tagsByNote = new Map<string, Set<string>>();
	for (const r of tagRows) {
		let s = tagsByNote.get(r.note_id);
		if (!s) tagsByNote.set(r.note_id, (s = new Set()));
		s.add(r.tag);
	}
	const annRows = db
		.query<{ note_id: string; color: string | null }, [string]>(
			'SELECT note_id, color FROM annotations WHERE username = ?'
		)
		.all(opts.username);
	const colorByNote = new Map<string, string | null>();
	for (const r of annRows) colorByNote.set(r.note_id, r.color);

	const allRows = db
		.query<NoteRow, [string]>(
			'SELECT * FROM notes WHERE username = ? ORDER BY real_ts DESC, id DESC'
		)
		.all(opts.username);

	const matched = allRows.filter((row) => {
		if (!isSelf && row.private) return false;
		return evalExpr(opts.expr, {
			id: row.id,
			realTs: row.real_ts,
			private: !!row.private,
			tags: tagsByNote.get(row.id) || new Set(),
			color: colorByNote.get(row.id) || null
		});
	});

	const cursor = decodeCursor(opts.cursor);
	let start = 0;
	if (cursor) {
		const idx = matched.findIndex(
			(r) => r.real_ts < cursor.ts || (r.real_ts === cursor.ts && r.id < cursor.id)
		);
		start = idx === -1 ? matched.length : idx;
	}
	const page = matched.slice(start, start + opts.limit);
	const hasMore = start + opts.limit < matched.length;
	const output = page.map((r) => rowToSnippet(r, { withBacklinks: true }));
	const nextCursor = hasMore
		? encodeCursor({ ts: page[page.length - 1].real_ts, id: page[page.length - 1].id })
		: null;
	return { output, cursor: nextCursor, numNotes: matched.length };
}
