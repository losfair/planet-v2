import type { RequestHandler } from './$types';
import { follow } from '$server/follow';
import { handlerAsync, requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as { peer: string };
		follow(me, body.peer);
		return { relation: { from: me, to: body.peer } };
	});
};
