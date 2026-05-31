import type { RequestHandler } from './$types';
import { requireUser } from '$server/http';
import { db } from '$server/db';
import type { NoteRow } from '$server/notes';

/** Export all of the authenticated user's notes as a single Markdown file. */
export const GET: RequestHandler = (event) => {
	const me = requireUser(event);
	const rows = db
		.query<NoteRow, [string]>('SELECT * FROM notes WHERE username = ? ORDER BY real_ts ASC, id ASC')
		.all(me);

	const parts = rows.map((r) => {
		const date = new Date(r.real_ts).toISOString();
		const vis = r.private ? 'private' : 'public';
		return `---\nid: ${r.id}\ndate: ${date}\nvisibility: ${vis}\n---\n\n${r.markdown}\n`;
	});
	const body = `# ${me}'s Planet — export\n\n${rows.length} note(s), generated ${new Date().toISOString()}\n\n${parts.join('\n\n')}`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="${me}-planet-export.md"`
		}
	});
};
