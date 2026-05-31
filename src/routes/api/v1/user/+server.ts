import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUser, buildApiUserInfo } from '$server/users';
import { handler } from '$server/http';

export const GET: RequestHandler = ({ url, locals }) => {
	const username = url.searchParams.get('username');
	if (!username) throw error(400, 'username required');
	return handler(() => {
		const user = getUser(username);
		if (!user) throw error(404, 'User not found');
		return buildApiUserInfo(user, locals.user?.username ?? null);
	});
};
