import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseGraphQuery, runLensQuery } from '$server/lens';
import { handler, requireUser } from '$server/http';
import { limits } from '$server/config';

export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	const q = (event.url.searchParams.get('q') || '').slice(0, 200);
	const cursor = event.url.searchParams.get('cursor') || undefined;
	if (!q) throw error(400, 'q required');
	return handler(() => {
		const expr = parseGraphQuery(q);
		const result = runLensQuery({
			username: me,
			expr,
			viewer: me,
			cursor,
			limit: limits.pageSizeSearch
		});
		return {
			expr,
			cursor: result.cursor,
			output: result.output,
			summary: cursor ? undefined : { numNotes: result.numNotes },
			lens: null
		};
	});
};
