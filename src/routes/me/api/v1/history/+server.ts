import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$server/http';
import { db } from '$server/db';

interface LogRow {
	seq: number;
	ts: number;
	event_type: string;
	note_id: string | null;
	value: string;
}

/** Mutation history for the last 90 days, optionally filtered to one note. */
export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	const noteId = event.url.searchParams.get('id') || undefined;
	const cursor = event.url.searchParams.get('cursor');
	const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

	const where: string[] = ['username = ?', 'ts >= ?'];
	const params: (string | number)[] = [me, cutoff];
	if (noteId) {
		where.push('note_id = ?');
		params.push(noteId);
	}
	if (cursor) {
		where.push('seq < ?');
		params.push(Number(cursor));
	}
	const sql = `SELECT seq, ts, event_type, note_id, value FROM event_log WHERE ${where.join(' AND ')} ORDER BY seq DESC LIMIT 101`;
	const rows = db.query<LogRow, (string | number)[]>(sql).all(...params);
	const hasMore = rows.length > 100;
	const page = rows.slice(0, 100);
	return json({
		history: page.map((r) => ({
			seq: r.seq,
			ts: r.ts,
			type: r.event_type,
			noteId: r.note_id,
			value: r.value
		})),
		cursor: hasMore ? String(page[page.length - 1].seq) : null
	});
};
