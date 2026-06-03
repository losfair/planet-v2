import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { revokeToken } from '$server/openapi';
import { requireUser } from '$server/http';

export const POST: RequestHandler = async (event) => {
	const me = requireUser(event);
	const body = (await event.request.json().catch(() => ({}))) as { id?: string };
	if (body.id) revokeToken(me, body.id);
	return json({});
};
