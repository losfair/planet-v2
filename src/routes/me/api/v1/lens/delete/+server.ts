import type { RequestHandler } from './$types';
import { deleteLens } from '$server/lens';
import { handlerAsync, requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as { id: string };
		deleteLens(me, body.id);
		return {};
	});
};
