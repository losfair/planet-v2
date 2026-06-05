import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registerClient, OAuthError } from '$server/oauth';

const CORS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

// RFC 7591 Dynamic Client Registration. Open registration (no initial access
// token) — standard for MCP so clients can self-register without operator setup.
export const POST: RequestHandler = async ({ request }) => {
	let meta: Record<string, unknown>;
	try {
		meta = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' }, { status: 400, headers: CORS });
	}
	try {
		return json(registerClient(meta), { status: 201, headers: CORS });
	} catch (e) {
		if (e instanceof OAuthError) {
			return json({ error: e.code, error_description: e.message }, { status: e.status, headers: CORS });
		}
		throw e;
	}
};

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: CORS });
