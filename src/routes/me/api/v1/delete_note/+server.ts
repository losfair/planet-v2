import type { RequestHandler } from './$types';
import { deleteNote } from '$server/notes';
import { handlerAsync, requireUser } from '$server/http';
import type { ApiDeleteSnippetReq } from '$lib/types';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as ApiDeleteSnippetReq;
		deleteNote(me, body.id);
		return {};
	});
};
