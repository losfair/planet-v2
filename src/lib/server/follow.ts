import { db } from './db';
import { getUser } from './users';
import { logEvent } from './log';
import { ApiError } from './notes';

export function follow(from: string, to: string): void {
	if (from === to) throw new ApiError(400, 'Cannot follow yourself');
	if (!getUser(to)) throw new ApiError(404, 'User not found');
	const now = Date.now();
	const changed = db
		.query('INSERT OR IGNORE INTO follows (from_username, to_username, ts) VALUES (?, ?, ?)')
		.run(from, to, now);
	if (changed.changes > 0) {
		db.query(
			'INSERT INTO notifications (recipient, ts, notif_type, payload) VALUES (?, ?, ?, ?)'
		).run(to, now, 'follow', JSON.stringify({ followed_by: from }));
		logEvent(from, 'create_follow', null, { to });
	}
}

export function unfollow(from: string, to: string): void {
	db.query('DELETE FROM follows WHERE from_username = ? AND to_username = ?').run(from, to);
	logEvent(from, 'delete_follow', null, { to });
}

export function followStat(username: string): { followerCount: number; followingCount: number } {
	const followerCount =
		db
			.query<{ c: number }, [string]>('SELECT COUNT(*) c FROM follows WHERE to_username = ?')
			.get(username)?.c ?? 0;
	const followingCount =
		db
			.query<{ c: number }, [string]>('SELECT COUNT(*) c FROM follows WHERE from_username = ?')
			.get(username)?.c ?? 0;
	return { followerCount, followingCount };
}

/** List followers of `username` (newest first), paginated by ts cursor. */
export function listFollowers(username: string, cursor: string | undefined, limit: number) {
	return listFollow('to_username', 'from_username', username, cursor, limit);
}

/** List users that `username` follows. */
export function listFollowing(username: string, cursor: string | undefined, limit: number) {
	return listFollow('from_username', 'to_username', username, cursor, limit);
}

function listFollow(
	matchCol: string,
	pickCol: string,
	username: string,
	cursorStr: string | undefined,
	limit: number
): { users: string[]; cursor: string | null } {
	const cursorTs = cursorStr ? Number(cursorStr) : null;
	let sql = `SELECT ${pickCol} AS u, ts FROM follows WHERE ${matchCol} = ?`;
	const params: (string | number)[] = [username];
	if (cursorTs !== null && !Number.isNaN(cursorTs)) {
		sql += ' AND ts < ?';
		params.push(cursorTs);
	}
	sql += ' ORDER BY ts DESC LIMIT ?';
	params.push(limit + 1);
	const rows = db.query<{ u: string; ts: number }, (string | number)[]>(sql).all(...params);
	const hasMore = rows.length > limit;
	const page = rows.slice(0, limit);
	return {
		users: page.map((r) => r.u),
		cursor: hasMore ? String(page[page.length - 1].ts) : null
	};
}
