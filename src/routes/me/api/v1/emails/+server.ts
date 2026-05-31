import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listEmails } from '$server/users';
import { requireUser } from '$server/http';

export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	return json({ emails: listEmails(me) });
};
