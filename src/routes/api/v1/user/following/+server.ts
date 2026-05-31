import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFollowing } from '$server/follow';
import { limits } from '$server/config';

export const GET: RequestHandler = ({ url }) => {
	const username = url.searchParams.get('username');
	if (!username) throw error(400, 'username required');
	const cursor = url.searchParams.get('cursor') || undefined;
	return json(listFollowing(username, cursor, limits.pageSizeFollow));
};
