import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLens, lensToApi, runLensQuery } from '$server/lens';
import { handler } from '$server/http';
import { limits } from '$server/config';
import type { GraphQueryExpr } from '$lib/types';

export const GET: RequestHandler = ({ url, locals }) => {
	const username = url.searchParams.get('username');
	const id = url.searchParams.get('id');
	if (!username || !id) throw error(400, 'username and id required');
	const cursor = url.searchParams.get('cursor') || undefined;
	const viewer = locals.user?.username ?? null;

	return handler(() => {
		const lens = getLens(username, id);
		if (!lens) throw error(404, 'Lens not found');
		const isSelf = viewer === username;
		if (!isSelf) {
			if (lens.access === 'private') throw error(403, 'Forbidden');
			if (lens.access === 'group') {
				const group: string[] = lens.group_json ? JSON.parse(lens.group_json) : [];
				if (!viewer || !group.includes(viewer)) throw error(403, 'Forbidden');
			}
		}
		const expr: GraphQueryExpr = lens.expr_json ? JSON.parse(lens.expr_json) : { type: 'true' };
		const result = runLensQuery({ username, expr, viewer, cursor, limit: limits.pageSizeSearch });
		return {
			expr,
			cursor: result.cursor,
			output: result.output,
			lens: lensToApi(lens),
			summary: cursor ? undefined : { numNotes: result.numNotes }
		};
	});
};
