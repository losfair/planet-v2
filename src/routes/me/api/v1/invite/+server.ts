import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createInvitation } from '$server/invitation';
import { requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return json({ token: createInvitation(me) });
};
