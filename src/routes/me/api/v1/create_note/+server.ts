import type { RequestHandler } from './$types';
import { createNote } from '$server/notes';
import { handlerAsync, requireUser } from '$server/http';
import type { ApiCreateSnippetReq } from '$lib/types';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as ApiCreateSnippetReq;
		return createNote(me, { content: body.content, private: !!body.private });
	});
};
