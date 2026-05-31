import type { RequestHandler } from './$types';
import { updateUser } from '$server/users';
import { handlerAsync, requireUser } from '$server/http';

export const POST: RequestHandler = (event) => {
	const me = requireUser(event);
	return handlerAsync(async () => {
		const body = (await event.request.json()) as {
			displayName?: string;
			description?: string;
			noteViewV2?: boolean;
			contentFontFamily?: string | null;
			waybackMachine?: { where: string; ak: string; sk: string } | null;
		};
		updateUser(me, body);
		return {};
	});
};
