import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { logEvent } from './log';

export interface ApiTokenInfo {
	id: string;
	name: string;
	createdAt: number;
}

/** Hash a token secret for storage / lookup. The secret is high-entropy
 *  (256 bits), so a fast hash is sufficient — we never store the secret. */
function hashSecret(secret: string): string {
	return createHash('sha256').update(secret).digest('hex');
}

/**
 * Issue a named API token. The token is an opaque random secret (`pat_<rand>`);
 * only its hash is persisted, so it can't be recovered from the database.
 */
export function createToken(username: string, name: string): { token: string } & ApiTokenInfo {
	const id = randomBytes(8).toString('hex');
	const secret = randomBytes(32).toString('base64url');
	const createdAt = Date.now();
	const cleanName = (name || '').trim().slice(0, 60) || 'API token';
	db.query(
		'INSERT INTO api_tokens (id, username, name, created_at, token_hash) VALUES (?, ?, ?, ?, ?)'
	).run(id, username, cleanName, createdAt, hashSecret(secret));
	logEvent(username, 'user_openapi_create_token', null, { id, name: cleanName });
	return { token: `pat_${secret}`, id, name: cleanName, createdAt };
}

export function listTokens(username: string): ApiTokenInfo[] {
	return db
		.query<ApiTokenInfo, [string]>(
			'SELECT id, name, created_at AS createdAt FROM api_tokens WHERE username = ? ORDER BY created_at DESC'
		)
		.all(username);
}

/** Revoke a single token by id (no-op if it isn't the caller's). */
export function revokeToken(username: string, id: string): void {
	db.query('DELETE FROM api_tokens WHERE id = ? AND username = ?').run(id, username);
	logEvent(username, 'user_openapi_revoke_token', null, { id });
}

/** Revoke every token for the user. */
export function revokeAllTokens(username: string): void {
	db.query('DELETE FROM api_tokens WHERE username = ?').run(username);
	logEvent(username, 'user_openapi_revoke_all_tokens', null, {});
}

/** Resolve a bearer token to a username by hashing it and looking it up. */
export function resolveToken(token: string): string | null {
	if (!token.startsWith('pat_')) return null;
	const secret = token.slice(4);
	if (!secret) return null;
	const row = db
		.query<{ username: string }, [string]>('SELECT username FROM api_tokens WHERE token_hash = ?')
		.get(hashSecret(secret));
	return row ? row.username : null;
}
