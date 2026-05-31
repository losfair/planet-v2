import { db } from './db';

/** List a user's tags. Private tags are only included when viewing self. */
export function listTags(username: string, includePrivate: boolean): string[] {
	const sql = includePrivate
		? 'SELECT DISTINCT tag FROM note_tags WHERE username = ? ORDER BY tag'
		: 'SELECT DISTINCT tag FROM note_tags WHERE username = ? AND private = 0 ORDER BY tag';
	return db.query<{ tag: string }, [string]>(sql).all(username).map((r) => r.tag);
}
