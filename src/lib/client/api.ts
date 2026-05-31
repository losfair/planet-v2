export class ApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

/**
 * Fetch JSON from the API. GET when no payload, POST (JSON body) otherwise —
 * mirrors the original loadJson() contract the components were written against.
 */
export async function loadJson<T = unknown>(
	path: string,
	payload?: unknown,
	opts: { abort?: AbortSignal; headers?: Record<string, string> } = {}
): Promise<T> {
	const rsp = await fetch(path, {
		method: payload ? 'POST' : 'GET',
		body: payload ? JSON.stringify(payload) : undefined,
		credentials: 'include',
		signal: opts.abort,
		headers: {
			...(payload ? { 'Content-Type': 'application/json' } : {}),
			...(opts.headers || {})
		}
	});
	if (!rsp.ok) {
		const text = await rsp.text();
		throw new ApiError(text, rsp.status);
	}
	const ct = rsp.headers.get('content-type') || '';
	return (ct.includes('application/json') ? await rsp.json() : await rsp.text()) as T;
}
