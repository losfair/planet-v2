import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createUser } from '$server/users';
import { createNote } from '$server/notes';
import { createSession } from '$server/auth';
import { decodeInvitation } from '$server/invitation';
import { SESSION_COOKIE, SESSION_TTL_MS, usernameRegex } from '$server/config';
import { ApiError } from '$server/notes';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) throw redirect(303, `/people/${locals.user.username}/notes`);
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = String(data.get('username') || '')
			.trim()
			.toLowerCase();
		const email = String(data.get('email') || '').trim();
		const password = String(data.get('password') || '');
		const invitation = String(data.get('invitation') || '').trim();

		if (!usernameRegex.test(username)) {
			return fail(400, {
				error: 'Username must be 3–20 chars: lowercase letters, digits, dots or hyphens.',
				username,
				email
			});
		}
		if (password.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters.', username, email });
		}

		const invitedBy = invitation ? decodeInvitation(invitation) || undefined : undefined;
		if (invitation && !invitedBy) {
			return fail(400, { error: 'Invalid or expired invitation.', username, email });
		}

		try {
			await createUser({ username, email, password, invitedBy });
		} catch (e) {
			if (e instanceof ApiError) return fail(e.status, { error: e.message, username, email });
			throw e;
		}

		// Welcome note.
		try {
			createNote(username, {
				private: false,
				content: `Welcome to Planet, @${username}! This is your first note. Write anything — thoughts, links, #tags. Notes are private by default; flip the **Public?** switch to share.`
			});
		} catch {
			/* non-fatal */
		}

		const token = createSession(username);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: Math.floor(SESSION_TTL_MS / 1000)
		});
		throw redirect(303, `/people/${username}/notes`);
	}
};
