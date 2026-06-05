import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listGrants } from '$server/oauth';
import { requireUser } from '$server/http';

export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	return json({ connections: listGrants(me) });
};
