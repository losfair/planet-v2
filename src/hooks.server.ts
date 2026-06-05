import { json, type Handle, type HandleFetch } from '@sveltejs/kit';
import { resolveSession, FEATURES } from '$server/auth';
import { forwardAuthEnabled, resolveForwardAuth } from '$server/forwardauth';
import { resolveToken } from '$server/openapi';
import {
	resolveAccessToken,
	protectedResourceMetadata,
	authServerMetadata
} from '$server/oauth';
import { SESSION_COOKIE, config } from '$server/config';

// OAuth discovery documents (RFC 9728 / RFC 8414) for the MCP authorization
// flow. Served from the hook so they sit at the exact `.well-known` paths
// clients probe, independent of SvelteKit's route tree. The path suffix (e.g.
// `/mcp`) some clients append per RFC 9728 §3 is accepted and ignored.
const WELL_KNOWN_CORS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

function wellKnownMetadata(event: Parameters<Handle>[0]['event']): Response | null {
	const { pathname, origin } = event.url;
	const base = pathname.replace(/\/mcp$/, '');
	let body: unknown;
	if (base === '/.well-known/oauth-protected-resource') {
		body = protectedResourceMetadata(origin);
	} else if (
		base === '/.well-known/oauth-authorization-server' ||
		base === '/.well-known/openid-configuration'
	) {
		body = authServerMetadata(origin);
	} else {
		return null;
	}
	if (event.request.method === 'OPTIONS') return new Response(null, { status: 204, headers: WELL_KNOWN_CORS });
	return json(body, { headers: WELL_KNOWN_CORS });
}

export const handle: Handle = async ({ event, resolve }) => {
	const meta = wellKnownMetadata(event);
	if (meta) return meta;

	if (forwardAuthEnabled()) {
		// Identity comes solely from the trusted proxy headers; session cookies
		// are ignored entirely. Public pages stay accessible anonymously — the
		// redirect to the proxy's auth endpoint happens only where auth is
		// actually required (protected loads + the sign-in affordance).
		event.locals.user = resolveForwardAuth(event.request.headers);
	} else {
		const token = event.cookies.get(SESSION_COOKIE);
		event.locals.user = resolveSession(token);
	}

	// Programmatic access: a Bearer token authenticates the request when no
	// interactive session/proxy identity is present. Works in either auth mode.
	// Two token kinds are accepted — long-lived personal API tokens (`pat_…`)
	// and OAuth 2.1 access tokens issued to MCP clients.
	if (!event.locals.user) {
		const authz = event.request.headers.get('authorization');
		if (authz?.startsWith('Bearer ')) {
			const token = authz.slice(7).trim();
			const username = resolveToken(token) ?? resolveAccessToken(token, event.url.origin);
			if (username) event.locals.user = { username, features: FEATURES };
		}
	}

	return resolve(event);
};

// SvelteKit forwards cookies on internal (same-origin) fetches during SSR, but
// not custom headers. Propagate the forward-auth headers so server-side load
// functions hitting our own API are authenticated as the proxy user.
export const handleFetch: HandleFetch = ({ event, request, fetch }) => {
	if (config.forwardAuth.enabled && new URL(request.url).origin === event.url.origin) {
		const headers = new Headers(request.headers);
		for (const name of [
			config.forwardAuth.userHeader,
			config.forwardAuth.emailHeader,
			config.forwardAuth.nameHeader
		]) {
			const value = event.request.headers.get(name);
			if (value) headers.set(name, value);
		}
		request = new Request(request, { headers });
	}
	return fetch(request);
};
