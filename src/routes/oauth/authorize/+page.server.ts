import { error, redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getClient,
	clientRedirectUris,
	createAuthCode,
	resourceMatches,
	OAUTH_SCOPE,
	mcpResource
} from '$server/oauth';
import { config } from '$server/config';

interface AuthzParams {
	clientId: string;
	redirectUri: string;
	state: string | null;
	codeChallenge: string;
	codeChallengeMethod: string;
	scope: string;
	resource: string | null;
	responseType: string;
}

function readParams(get: (k: string) => string | null): AuthzParams {
	return {
		clientId: get('client_id') ?? '',
		redirectUri: get('redirect_uri') ?? '',
		state: get('state'),
		codeChallenge: get('code_challenge') ?? '',
		codeChallengeMethod: get('code_challenge_method') ?? 'plain',
		scope: get('scope') || OAUTH_SCOPE,
		resource: get('resource'),
		responseType: get('response_type') ?? ''
	};
}

/** Append query params to a (possibly already query-bearing) redirect URI. */
function redirectBack(redirectUri: string, params: Record<string, string | null>): string {
	const u = new URL(redirectUri);
	for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
	return u.toString();
}

/**
 * Validate the client + redirect_uri (these errors must NOT redirect — they'd
 * leak codes to an attacker-controlled URI), then everything else. Returns the
 * validated params, or throws a SvelteKit error / redirect.
 */
function validate(p: AuthzParams, origin: string): { redirectUri: string } {
	if (!p.clientId) throw error(400, 'client_id is required');
	const client = getClient(p.clientId);
	if (!client) throw error(400, 'Unknown client_id');
	if (!p.redirectUri || !clientRedirectUris(client).includes(p.redirectUri)) {
		throw error(400, 'redirect_uri is not registered for this client');
	}

	// From here, errors are reported by redirecting back to the (trusted) client.
	if (p.responseType !== 'code') {
		throw redirect(303, redirectBack(p.redirectUri, { error: 'unsupported_response_type', state: p.state }));
	}
	if (!p.codeChallenge || p.codeChallengeMethod !== 'S256') {
		throw redirect(
			303,
			redirectBack(p.redirectUri, {
				error: 'invalid_request',
				error_description: 'PKCE with code_challenge_method=S256 is required',
				state: p.state
			})
		);
	}
	if (!resourceMatches(p.resource, origin)) {
		throw redirect(
			303,
			redirectBack(p.redirectUri, {
				error: 'invalid_target',
				error_description: `resource must be ${mcpResource(origin)}`,
				state: p.state
			})
		);
	}
	return { redirectUri: p.redirectUri };
}

export const load: PageServerLoad = ({ url, locals }) => {
	const p = readParams((k) => url.searchParams.get(k));
	validate(p, url.origin);

	// Authentication: the resource owner must be signed in to consent.
	if (!locals.user) {
		const next = url.pathname + url.search;
		if (config.forwardAuth.enabled) {
			throw redirect(303, config.forwardAuth.loginPath);
		}
		throw redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	const client = getClient(p.clientId)!;
	return {
		clientName: client.client_name || p.clientId,
		scope: p.scope,
		username: locals.user.username,
		// Echoed into hidden form fields so the POST action is self-contained.
		params: {
			response_type: p.responseType,
			client_id: p.clientId,
			redirect_uri: p.redirectUri,
			state: p.state ?? '',
			code_challenge: p.codeChallenge,
			code_challenge_method: p.codeChallengeMethod,
			scope: p.scope,
			resource: p.resource ?? ''
		}
	};
};

export const actions: Actions = {
	approve: async ({ request, url, locals }) => {
		if (!locals.user) throw error(401, 'Not authenticated');
		const data = await request.formData();
		const p = readParams((k) => {
			const v = data.get(k);
			return typeof v === 'string' && v !== '' ? v : null;
		});
		const { redirectUri } = validate(p, url.origin);

		const code = createAuthCode({
			clientId: p.clientId,
			username: locals.user.username,
			redirectUri,
			codeChallenge: p.codeChallenge,
			scope: p.scope,
			resource: p.resource ?? mcpResource(url.origin)
		});
		throw redirect(303, redirectBack(redirectUri, { code, state: p.state }));
	},

	deny: async ({ request, url }) => {
		const data = await request.formData();
		const p = readParams((k) => {
			const v = data.get(k);
			return typeof v === 'string' && v !== '' ? v : null;
		});
		// Only redirect if the client + redirect_uri check out.
		const client = getClient(p.clientId);
		if (!client || !clientRedirectUris(client).includes(p.redirectUri)) {
			return fail(400, { error: 'invalid client or redirect_uri' });
		}
		throw redirect(303, redirectBack(p.redirectUri, { error: 'access_denied', state: p.state }));
	}
};
