import type { RequestHandler } from './$types';
import { createUploadTicket } from '$server/image';
import { handlerAsync, requireUser } from '$server/http';
import type { ApiUploadImageReq } from '$lib/types';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as ApiUploadImageReq;
		return createUploadTicket(me, body.fileType, body.size);
	});
};
