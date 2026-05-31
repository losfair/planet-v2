import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { followStat } from '$server/follow';

export const GET: RequestHandler = ({ url }) => {
	const username = url.searchParams.get('username');
	if (!username) throw error(400, 'username required');
	return json(followStat(username));
};
