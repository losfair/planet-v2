import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSnippets } from '$server/queries';
import { handler } from '$server/http';
import { limits } from '$server/config';

export const GET: RequestHandler = ({ url, locals }) => {
	const username = url.searchParams.get('username');
	if (!username) throw error(400, 'username required');
	const cursor = url.searchParams.get('cursor') || undefined;
	const id = url.searchParams.get('id') || undefined;
	const limitParam = Number(url.searchParams.get('limit'));
	const limit =
		Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 100
			? limitParam
			: limits.pageSizeNotes;

	return handler(() => {
		const rsp = getSnippets({
			username,
			viewer: locals.user?.username ?? null,
			cursor,
			id,
			limit
		});
		if (!rsp) throw error(404, 'User not found');
		return rsp;
	});
};
