import type { Handle, HandleFetch } from '@sveltejs/kit';
import { resolveSession } from '$server/auth';
import { forwardAuthEnabled, resolveForwardAuth } from '$server/forwardauth';
import { SESSION_COOKIE, config } from '$server/config';

export const handle: Handle = async ({ event, resolve }) => {
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
