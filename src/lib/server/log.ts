import { db } from './db';

/** Append an entry to the audit/version-history log (replaces the seqlog). */
export function logEvent(
	username: string | null,
	eventType: string,
	noteId: string | null,
	value: Record<string, unknown>
): void {
	db.query(
		'INSERT INTO event_log (username, ts, event_type, note_id, value) VALUES (?, ?, ?, ?, ?)'
	).run(username, Date.now(), eventType, noteId, JSON.stringify(value));
}
