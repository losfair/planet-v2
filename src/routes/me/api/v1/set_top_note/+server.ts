import type { RequestHandler } from './$types';
import { setTopNote } from '$server/users';
import { handlerAsync, requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as { noteId?: string };
		setTopNote(me, body.noteId || '');
		return {};
	});
};
