import type { RequestHandler } from './$types';
import { editLens } from '$server/lens';
import { handlerAsync, requireUser } from '$server/http';
import type { ApiLensInfo } from '$lib/types';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as {
			id: string;
			description?: string;
			query: string;
			access: ApiLensInfo['access'];
			group?: string[];
			update?: boolean;
		};
		return editLens(me, {
			id: body.id,
			description: body.description || '',
			query: body.query,
			access: body.access,
			group: body.group,
			update: !!body.update
		});
	});
};
