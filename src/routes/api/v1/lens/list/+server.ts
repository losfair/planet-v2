import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listLenses } from '$server/lens';

export const GET: RequestHandler = ({ url, locals }) => {
	const username = url.searchParams.get('username');
	if (!username) throw error(400, 'username required');
	return json({ lenses: listLenses(username, locals.user?.username ?? null) });
};
