import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchNotes } from '$server/search';
import { handler } from '$server/http';
import { limits } from '$server/config';

export const GET: RequestHandler = ({ params, url, locals }) => {
	const keyword = (url.searchParams.get('keyword') || '').slice(0, 200);
	const before = url.searchParams.get('before') || undefined;
	if (!keyword) throw error(400, 'keyword required');
	return handler(() =>
		searchNotes({
			username: params.username,
			keyword,
			viewer: locals.user?.username ?? null,
			cursor: before,
			limit: limits.pageSizeSearch
		})
	);
};
