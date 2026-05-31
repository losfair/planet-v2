import type { RequestHandler } from './$types';
import { updateNote } from '$server/notes';
import { handlerAsync, requireUser } from '$server/http';
import type { ApiUpdateSnippetReq } from '$lib/types';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as ApiUpdateSnippetReq;
		updateNote(me, { id: body.id, content: body.content, private: !!body.private });
		return {};
	});
};
