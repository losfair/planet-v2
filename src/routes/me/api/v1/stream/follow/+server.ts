import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { followStream } from '$server/queries';
import { requireUser } from '$server/http';
import { limits } from '$server/config';

export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	const cursor = event.url.searchParams.get('cursor') || undefined;
	return json(followStream(me, cursor, limits.pageSizeFeed));
};
