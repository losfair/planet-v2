import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listTags } from '$server/tags';

export const GET: RequestHandler = ({ params, locals }) => {
	const includePrivate = locals.user?.username === params.username;
	return json({ tags: listTags(params.username, includePrivate) });
};
