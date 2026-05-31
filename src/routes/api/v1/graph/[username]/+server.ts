import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUser } from '$server/users';
import { queryGraphForUser, validateGraphExpr } from '$server/graph';

export const GET: RequestHandler = ({ params, url, locals }) => {
	if (!getUser(params.username)) throw error(404, 'User not found');

	const raw = url.searchParams.get('q') || '';
	if (raw.length > 300) throw error(400, 'query too long');

	let expr = validateGraphExpr({ type: 'true' });
	if (raw) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw error(400, 'invalid query');
		}
		expr = validateGraphExpr(parsed);
		if (!expr) throw error(400, 'invalid query');
	}

	return json(queryGraphForUser(params.username, locals.user?.username ?? '', expr!));
};
