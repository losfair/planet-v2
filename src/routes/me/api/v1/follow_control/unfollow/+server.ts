import type { RequestHandler } from './$types';
import { unfollow } from '$server/follow';
import { handlerAsync, requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as { peer: string };
		unfollow(me, body.peer);
		return { relation: null };
	});
};
