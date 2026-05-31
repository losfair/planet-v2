import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFollowers } from '$server/follow';
import { limits } from '$server/config';

export const GET: RequestHandler = ({ url }) => {
	const username = url.searchParams.get('username');
	if (!username) throw error(400, 'username required');
	const cursor = url.searchParams.get('cursor') || undefined;
	return json(listFollowers(username, cursor, limits.pageSizeFollow));
};
