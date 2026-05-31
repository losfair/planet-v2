import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { globalStream } from '$server/queries';
import { limits } from '$server/config';

export const GET: RequestHandler = ({ url }) => {
	const cursor = url.searchParams.get('cursor') || undefined;
	return json(globalStream(cursor, limits.pageSizeFeed));
};
