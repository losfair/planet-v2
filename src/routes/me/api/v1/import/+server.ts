import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$server/http';
import { importNotes, type ImportNote } from '$server/import';

/** Import notes parsed from an export ZIP (client unzips and sends them). */
export const POST: RequestHandler = async (event) => {
	const me = requireUser(event);
	const body = (await event.request.json()) as { notes?: ImportNote[] };
	if (!Array.isArray(body.notes)) throw error(400, 'Expected { notes: [...] }');
	if (body.notes.length > 100000) throw error(413, 'Too many notes');
	const imported = importNotes(me, body.notes);
	return json({ imported });
};
