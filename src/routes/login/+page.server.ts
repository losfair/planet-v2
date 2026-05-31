import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getUserByEmail, getUser } from '$server/users';
import { verifyPassword, createSession } from '$server/auth';
import { SESSION_COOKIE, SESSION_TTL_MS } from '$server/config';
import { logEvent } from '$server/log';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) throw redirect(303, `/people/${locals.user.username}/notes`);
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const identifier = String(data.get('identifier') || '').trim();
		const password = String(data.get('password') || '');
		if (!identifier || !password) return fail(400, { error: 'Missing credentials' });

		const user = identifier.includes('@') ? getUserByEmail(identifier) : getUser(identifier);
		if (!user || !(await verifyPassword(password, user.password_hash))) {
			return fail(401, { error: 'Invalid username/email or password', identifier });
		}

		const token = createSession(user.username);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: Math.floor(SESSION_TTL_MS / 1000)
		});
		logEvent(user.username, 'sign_in', null, {});
		throw redirect(303, `/people/${user.username}/notes`);
	}
};
