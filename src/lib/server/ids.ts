import { randomBytes } from 'node:crypto';
import { db } from './db';

/** Format a ms timestamp as YYYY-MM-DD in UTC. */
export function dateStr(ts: number): string {
	const d = new Date(ts);
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generate an order-preserving note id of the form `YYYY-MM-DD-<8hex><4hex>`.
 * The 8-hex segment is a per-user monotonic counter so that ids sort
 * chronologically within a day; the 4-hex segment adds randomness.
 */
export function genNoteId(username: string, ts: number): string {
	const seq = nextSeq(username);
	const seqHex = (seq & 0xffffffff).toString(16).padStart(8, '0');
	const rand = randomBytes(2).toString('hex');
	return `${dateStr(ts)}-${seqHex}${rand}`;
}

function nextSeq(username: string): number {
	db.query(
		`INSERT INTO user_seq (username, seq) VALUES (?, 1)
		 ON CONFLICT(username) DO UPDATE SET seq = seq + 1`
	).run(username);
	const row = db
		.query<{ seq: number }, [string]>('SELECT seq FROM user_seq WHERE username = ?')
		.get(username);
	return row?.seq ?? 1;
}
