import { json, error } from '@sveltejs/kit';
import { ApiError } from './notes';
import type { RequestEvent } from '@sveltejs/kit';

/** Wrap a handler so ApiError becomes a proper HTTP error response. */
export function handler<T>(fn: () => T): Response {
	try {
		return json(fn());
	} catch (e) {
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
}

export async function handlerAsync(fn: () => Promise<unknown>): Promise<Response> {
	try {
		return json(await fn());
	} catch (e) {
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
}

/** Require an authenticated user; throws 401 otherwise. */
export function requireUser(event: RequestEvent): string {
	if (!event.locals.user) throw error(401, 'Not authenticated');
	return event.locals.user.username;
}
