import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { config } from './config';
import { logEvent } from './log';

interface TokenPayload {
	username: string;
	createdAt: number;
}

function sign(data: string): string {
	return createHmac('sha256', config.sessionSecret + ':openapi').update(data).digest('base64url');
}

/** Issue an opaque API token bound to the user and a creation timestamp. */
export function createToken(username: string): string {
	const payload: TokenPayload = { username, createdAt: Date.now() };
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	logEvent(username, 'user_openapi_create_token', null, {});
	return `pat_${body}.${sign(body)}`;
}

/** Revoke all previously-issued tokens by advancing the invalidation cutoff. */
export function revokeAllTokens(username: string): void {
	db.query('UPDATE users SET openapi_invalidate_before = ? WHERE username = ?').run(
		Date.now(),
		username
	);
	logEvent(username, 'user_openapi_revoke_all_tokens', null, {});
}

/** Resolve a bearer token to a username, honouring per-user revocation. */
export function resolveToken(token: string): string | null {
	if (!token.startsWith('pat_')) return null;
	const [body, sig] = token.slice(4).split('.');
	if (!body || !sig) return null;
	const expected = sign(body);
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as TokenPayload;
		const row = db
			.query<{ openapi_invalidate_before: number }, [string]>(
				'SELECT openapi_invalidate_before FROM users WHERE username = ?'
			)
			.get(payload.username);
		if (!row) return null;
		if (payload.createdAt < row.openapi_invalidate_before) return null;
		return payload.username;
	} catch {
		return null;
	}
}
