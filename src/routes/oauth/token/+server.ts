import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeAuthCode, refreshTokens, pruneExpired, OAuthError } from '$server/oauth';

const CORS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function err(code: string, message: string, status: number): Response {
	return json({ error: code, error_description: message }, { status, headers: CORS });
}

/** Extract client credentials from HTTP Basic header or POST body. */
function clientCredentials(
	request: Request,
	form: URLSearchParams
): { clientId: string; clientSecret?: string } | null {
	const authz = request.headers.get('authorization');
	if (authz?.toLowerCase().startsWith('basic ')) {
		try {
			const decoded = Buffer.from(authz.slice(6).trim(), 'base64').toString('utf-8');
			const idx = decoded.indexOf(':');
			if (idx >= 0) {
				return {
					clientId: decodeURIComponent(decoded.slice(0, idx)),
					clientSecret: decodeURIComponent(decoded.slice(idx + 1))
				};
			}
		} catch {
			/* fall through */
		}
	}
	const clientId = form.get('client_id');
	if (!clientId) return null;
	const clientSecret = form.get('client_secret') || undefined;
	return { clientId, clientSecret };
}

// OAuth 2.1 token endpoint. Supports authorization_code (with PKCE) and
// refresh_token (rotating) grants. Bodies are application/x-www-form-urlencoded.
export const POST: RequestHandler = async ({ request, url }) => {
	pruneExpired();
	const origin = url.origin;

	let form: URLSearchParams;
	try {
		form = new URLSearchParams(await request.text());
	} catch {
		return err('invalid_request', 'Body must be form-encoded', 400);
	}

	const creds = clientCredentials(request, form);
	if (!creds) return err('invalid_client', 'client_id required', 401);

	const grantType = form.get('grant_type');
	try {
		if (grantType === 'authorization_code') {
			const code = form.get('code');
			const redirectUri = form.get('redirect_uri');
			const codeVerifier = form.get('code_verifier');
			if (!code || !redirectUri || !codeVerifier) {
				return err('invalid_request', 'code, redirect_uri and code_verifier are required', 400);
			}
			const tokens = exchangeAuthCode({
				code,
				redirectUri,
				codeVerifier,
				resource: form.get('resource'),
				clientAuth: creds,
				origin
			});
			return json(tokens, { headers: { 'Cache-Control': 'no-store', ...CORS } });
		}

		if (grantType === 'refresh_token') {
			const refreshToken = form.get('refresh_token');
			if (!refreshToken) return err('invalid_request', 'refresh_token required', 400);
			const tokens = refreshTokens({
				refreshToken,
				clientAuth: creds,
				resource: form.get('resource'),
				origin
			});
			return json(tokens, { headers: { 'Cache-Control': 'no-store', ...CORS } });
		}

		return err('unsupported_grant_type', `Unsupported grant_type: ${grantType}`, 400);
	} catch (e) {
		if (e instanceof OAuthError) return err(e.code, e.message, e.status);
		throw e;
	}
};

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: CORS });
