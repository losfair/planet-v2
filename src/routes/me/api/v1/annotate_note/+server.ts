import type { RequestHandler } from './$types';
import { annotateNote } from '$server/notes';
import { handlerAsync, requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as { id: string; color?: string };
		annotateNote(me, body.id, body.color || null);
		return { ann: { color: body.color || null } };
	});
};
