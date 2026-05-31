import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSnippets } from '$server/queries';
import { limits } from '$server/config';

export const GET: RequestHandler = ({ url, locals }) => {
	const username = url.searchParams.get('username');
	if (!username) throw error(400, 'username required');
	const cursor = url.searchParams.get('cursor') || undefined;
	const rsp = getSnippets({
		username,
		viewer: locals.user?.username ?? null,
		cursor,
		limit: limits.pageSizeFeed
	});
	if (!rsp) throw error(404, 'User not found');
	return json({ notes: rsp.snippets, cursor: rsp.cursor });
};
