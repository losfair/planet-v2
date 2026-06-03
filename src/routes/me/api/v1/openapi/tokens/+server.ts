import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTokens } from '$server/openapi';
import { requireUser } from '$server/http';

export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	return json({ tokens: listTokens(me) });
};
