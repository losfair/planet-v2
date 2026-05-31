import { config, usernameRegex } from './config';
import { getUser, provisionForwardAuthUser } from './users';
import { createNote } from './notes';
import { FEATURES, type SessionUser } from './auth';

export function forwardAuthEnabled(): boolean {
	return config.forwardAuth.enabled;
}

/**
 * Map an upstream identity (which may be an email or contain disallowed
 * characters) onto a valid Planet username, or null if it can't be mapped.
 */
function normalizeUsername(raw: string): string | null {
	let u = raw.trim().toLowerCase();
	const at = u.indexOf('@');
	if (at > 0) u = u.slice(0, at); // email -> local part
	u = u.replace(/[^a-z0-9.-]/g, '-');
	u = u.replace(/^[.-]+/, '').replace(/[.-]+$/, '');
	if (u.length > 20) u = u.slice(0, 20).replace(/[.-]+$/, '');
	return usernameRegex.test(u) ? u : null;
}

/**
 * Resolve the request's trusted auth headers into a session user, provisioning
 * the account on first sight. Returns null when no (valid) identity is present
 * — callers then treat the request as anonymous.
 */
export function resolveForwardAuth(headers: Headers): SessionUser | null {
	const raw = headers.get(config.forwardAuth.userHeader);
	if (!raw) return null;

	const username = normalizeUsername(raw);
	if (!username) {
		console.warn(`forward-auth: could not map "${raw}" to a valid username`);
		return null;
	}

	if (!getUser(username)) {
		const email = headers.get(config.forwardAuth.emailHeader);
		const displayName = headers.get(config.forwardAuth.nameHeader) || '';
		provisionForwardAuthUser(username, email, displayName);
		// Best-effort welcome note, mirroring local sign-up.
		try {
			createNote(username, {
				private: false,
				content: `Welcome to Planet, @${username}! This is your first note.`
			});
		} catch {
			/* non-fatal */
		}
	}

	return { username, features: FEATURES };
}
