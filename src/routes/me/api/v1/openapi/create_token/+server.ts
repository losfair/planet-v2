import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createToken } from '$server/openapi';
import { requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return json({ token: createToken(me) });
};
