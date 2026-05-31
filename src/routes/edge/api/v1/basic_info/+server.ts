import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ApiBasicUserInfo } from '$lib/types';

export const GET: RequestHandler = ({ locals }) => {
	const info: ApiBasicUserInfo = locals.user
		? { username: locals.user.username, features: locals.user.features }
		: { username: '' };
	return json(info);
};
