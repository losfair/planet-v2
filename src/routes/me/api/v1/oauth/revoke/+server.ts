import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { revokeGrant, revokeAllGrants } from '$server/oauth';
import { requireUser } from '$server/http';

export const POST: RequestHandler = async (event) => {
	const me = requireUser(event);
	const body = (await event.request.json().catch(() => ({}))) as { clientId?: string; all?: boolean };
	if (body.all) revokeAllGrants(me);
	else if (body.clientId) revokeGrant(me, body.clientId);
	return json({});
};
