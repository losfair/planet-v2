import type { Handle } from '@sveltejs/kit';
import { resolveSession } from '$server/auth';
import { SESSION_COOKIE } from '$server/config';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = resolveSession(token);
	return resolve(event);
};
