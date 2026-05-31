import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$server/http';
import { importNotes } from '$server/import';

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Import notes from a Planet Markdown export (same format as /export). */
export const POST: RequestHandler = async (event) => {
	const me = requireUser(event);
	const text = await event.request.text();
	if (!text) throw error(400, 'Empty import');
	if (text.length > MAX_IMPORT_BYTES) throw error(413, 'Import too large');
	const imported = importNotes(me, text);
	return json({ imported });
};
