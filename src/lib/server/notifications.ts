import { db } from './db';
import type { UserNotification } from '$lib/types';

export function listNotifications(
	username: string,
	cursor: string | undefined,
	limit: number
): { notifications: UserNotification[]; cursor: string | null } {
	const cursorSeq = cursor ? Number(Buffer.from(cursor, 'base64url').toString('utf-8')) : null;
	let sql = 'SELECT seq, ts, notif_type, payload FROM notifications WHERE recipient = ?';
	const params: (string | number)[] = [username];
	if (cursorSeq !== null && !Number.isNaN(cursorSeq)) {
		sql += ' AND seq < ?';
		params.push(cursorSeq);
	}
	sql += ' ORDER BY seq DESC LIMIT ?';
	params.push(limit + 1);
	const rows = db
		.query<{ seq: number; ts: number; notif_type: string; payload: string }, (string | number)[]>(
			sql
		)
		.all(...params);
	const hasMore = rows.length > limit;
	const page = rows.slice(0, limit);
	return {
		notifications: page.map((r) => ({
			lsn: String(r.seq),
			ts: r.ts,
			notifType: r.notif_type,
			notifPayload: r.payload
		})),
		cursor: hasMore
			? Buffer.from(String(page[page.length - 1].seq)).toString('base64url')
			: null
	};
}
