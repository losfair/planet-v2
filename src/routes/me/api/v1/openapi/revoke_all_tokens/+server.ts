import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { revokeAllTokens } from '$server/openapi';
import { requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	revokeAllTokens(me);
	return json({});
};
