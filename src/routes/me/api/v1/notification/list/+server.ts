import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listNotifications } from '$server/notifications';
import { requireUser } from '$server/http';

export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	const cursor = event.url.searchParams.get('cursor') || undefined;
	return json(listNotifications(me, cursor, 20));
};
