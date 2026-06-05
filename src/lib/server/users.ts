import { db, tx } from './db';
import { hashPassword } from './auth';
import { logEvent } from './log';
import { ApiError } from './notes';
import { usernameRegex } from './config';
import type { ApiUserInfo, FullUserInfo, PublicUserInfo } from '$lib/types';

export interface UserRow {
	username: string;
	email: string | null;
	password_hash: string;
	display_name: string;
	description: string;
	join_ts: number;
	invited_by: string | null;
	invited_at: number | null;
	top_note: string | null;
	content_font_family: string | null;
	background_image: string | null;
	note_view_v2: number;
	wayback_json: string | null;
	openapi_invalidate_before: number;
}

export function getUser(username: string): UserRow | null {
	return (
		db.query<UserRow, [string]>('SELECT * FROM users WHERE username = ?').get(username) ?? null
	);
}

export function getUserByEmail(email: string): UserRow | null {
	return db.query<UserRow, [string]>('SELECT * FROM users WHERE email = ?').get(email) ?? null;
}

export async function createUser(input: {
	username: string;
	email: string;
	password: string;
	invitedBy?: string;
}): Promise<void> {
	if (!usernameRegex.test(input.username)) {
		throw new ApiError(400, 'Invalid username');
	}
	if (getUser(input.username)) throw new ApiError(409, 'Username taken');
	if (input.email && getUserByEmail(input.email)) throw new ApiError(409, 'Email already in use');
	const hash = await hashPassword(input.password);
	const now = Date.now();
	tx(() => {
		db.query(
			`INSERT INTO users (username, email, password_hash, display_name, description, join_ts, invited_by, invited_at)
			 VALUES (?, ?, ?, '', '', ?, ?, ?)`
		).run(
			input.username,
			input.email || null,
			hash,
			now,
			input.invitedBy || null,
			input.invitedBy ? now : null
		);
		logEvent(input.username, 'sign_up', null, { invitedBy: input.invitedBy });
	});
}

// Locked password hash for accounts that authenticate via an upstream proxy
// (forward auth). It is not a valid hash, so verifyPassword() can never match.
const LOCKED_PASSWORD = '!forward-auth';

/**
 * Create an account for a forward-auth identity (no local password). Idempotent
 * caller should check getUser() first; this assumes the username is free.
 */
export function provisionForwardAuthUser(
	username: string,
	email: string | null,
	displayName: string
): void {
	const safeEmail = email && !getUserByEmail(email) ? email : null;
	const now = Date.now();
	db.query(
		`INSERT INTO users (username, email, password_hash, display_name, description, join_ts)
		 VALUES (?, ?, ?, ?, '', ?)`
	).run(username, safeEmail, LOCKED_PASSWORD, displayName.slice(0, 30), now);
	logEvent(username, 'sign_up', null, { via: 'forward-auth' });
}

function isFollowing(from: string, to: string): boolean {
	return !!db
		.query('SELECT 1 FROM follows WHERE from_username = ? AND to_username = ?')
		.get(from, to);
}

/** Build the /api/v1/user payload (public, or full when viewing self). */
export function buildApiUserInfo(
	user: UserRow,
	viewer: string | null
): ApiUserInfo<PublicUserInfo> | ApiUserInfo<FullUserInfo> {
	const isSelf = viewer === user.username;
	const pub: PublicUserInfo = {
		description: user.description,
		displayName: user.display_name,
		topNote: user.top_note || '',
		contentFontFamily: user.content_font_family || undefined,
		backgroundImage: user.background_image || undefined
	};
	const base = {
		username: user.username,
		followedByYou: viewer ? isFollowing(viewer, user.username) : false,
		followsYou: viewer ? isFollowing(user.username, viewer) : false
	};
	if (isSelf) {
		const full: FullUserInfo = {
			...pub,
			private: true,
			openapiLastRevoke: user.openapi_invalidate_before,
			noteViewV2: !!user.note_view_v2,
			waybackMachine: user.wayback_json ? JSON.parse(user.wayback_json) : undefined
		};
		return { ...base, ...full };
	}
	return { ...base, ...pub };
}

export function updateUser(
	username: string,
	input: {
		displayName?: string;
		description?: string;
		noteViewV2?: boolean;
		contentFontFamily?: string | null;
		backgroundImage?: string | null;
		waybackMachine?: { where: string; ak: string; sk: string } | null;
	}
): void {
	const sets: string[] = [];
	const params: (string | number | null)[] = [];
	if (input.displayName !== undefined) {
		if (input.displayName.length > 30) throw new ApiError(400, 'Display name too long');
		sets.push('display_name = ?');
		params.push(input.displayName);
	}
	if (input.description !== undefined) {
		if (input.description.length > 500) throw new ApiError(400, 'Description too long');
		sets.push('description = ?');
		params.push(input.description);
	}
	if (input.noteViewV2 !== undefined) {
		sets.push('note_view_v2 = ?');
		params.push(input.noteViewV2 ? 1 : 0);
	}
	if (input.contentFontFamily !== undefined) {
		sets.push('content_font_family = ?');
		params.push(input.contentFontFamily);
	}
	if (input.backgroundImage !== undefined) {
		if (input.backgroundImage && input.backgroundImage.length > 2048) {
			throw new ApiError(400, 'Background image URL too long');
		}
		sets.push('background_image = ?');
		params.push(input.backgroundImage || null);
	}
	if (input.waybackMachine !== undefined) {
		sets.push('wayback_json = ?');
		params.push(input.waybackMachine ? JSON.stringify(input.waybackMachine) : null);
	}
	if (!sets.length) return;
	params.push(username);
	db.query(`UPDATE users SET ${sets.join(', ')} WHERE username = ?`).run(...params);
	logEvent(username, 'user_info_update', null, {});
}

export function setTopNote(username: string, noteId: string): void {
	db.query('UPDATE users SET top_note = ? WHERE username = ?').run(noteId || null, username);
	logEvent(username, 'set_top_note', noteId || null, {});
}

export function listEmails(username: string): string[] {
	const u = getUser(username);
	return u?.email ? [u.email] : [];
}
