import { randomBytes } from 'node:crypto';
import { db } from './db';
import { SESSION_TTL_MS } from './config';

export interface SessionUser {
	username: string;
	features: string[];
}

export const FEATURES = ['social', 'lens', 'image'];

export async function hashPassword(password: string): Promise<string> {
	return await Bun.password.hash(password, { algorithm: 'argon2id' });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	try {
		return await Bun.password.verify(password, hash);
	} catch {
		return false;
	}
}

export function createSession(username: string): string {
	const token = randomBytes(32).toString('base64url');
	const now = Date.now();
	db.query(
		'INSERT INTO sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)'
	).run(token, username, now, now + SESSION_TTL_MS);
	return token;
}

export function destroySession(token: string): void {
	db.query('DELETE FROM sessions WHERE token = ?').run(token);
}

export function resolveSession(token: string | undefined): SessionUser | null {
	if (!token) return null;
	const row = db
		.query<{ username: string; expires_at: number }, [string]>(
			'SELECT username, expires_at FROM sessions WHERE token = ?'
		)
		.get(token);
	if (!row) return null;
	if (row.expires_at < Date.now()) {
		destroySession(token);
		return null;
	}
	return { username: row.username, features: FEATURES };
}
