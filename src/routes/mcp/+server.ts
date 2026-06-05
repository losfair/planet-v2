import type { RequestHandler } from './$types';
import { handleMcpMessage, MCP_PROTOCOL_VERSION, type McpContext } from '$server/mcp';

// MCP "Streamable HTTP" endpoint (stateless). Clients POST JSON-RPC 2.0
// messages and receive a single JSON response. Authentication is the same
// `Authorization: Bearer <token>` API token resolved in hooks.server.ts, so an
// MCP client is configured exactly like any other API consumer.

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
	'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate'
};

function rpcError(code: number, message: string, status: number): Response {
	return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code, message } }), {
		status,
		headers: { 'content-type': 'application/json', ...CORS_HEADERS }
	});
}

/**
 * RFC 9728 §5.1 challenge: tell the client where to find this resource's
 * metadata so it can discover the authorization server and start the OAuth
 * flow. Returned for any unauthenticated MCP request.
 */
function unauthorized(origin: string): Response {
	const metadataUrl = `${origin}/.well-known/oauth-protected-resource/mcp`;
	return new Response(
		JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Authentication required' } }),
		{
			status: 401,
			headers: {
				'content-type': 'application/json',
				'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"`,
				...CORS_HEADERS
			}
		}
	);
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	// Streamable HTTP requires the client to accept JSON (and optionally SSE).
	const accept = request.headers.get('accept') ?? '';
	if (accept && !accept.includes('application/json') && !accept.includes('*/*')) {
		return rpcError(-32600, 'Client must accept application/json', 406);
	}

	// The MCP endpoint requires authentication (PAT or OAuth access token). An
	// unauthenticated request is challenged so OAuth-capable clients (Claude,
	// ChatGPT) can discover the authorization server and obtain a token.
	if (!locals.user) return unauthorized(url.origin);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return rpcError(-32700, 'Parse error', 400);
	}

	const ctx: McpContext = { user: locals.user };
	const payload = handleMcpMessage(body, ctx);

	// A body of only notifications/responses yields nothing to return → 202.
	if (payload === null) {
		return new Response(null, { status: 202, headers: CORS_HEADERS });
	}

	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: {
			'content-type': 'application/json',
			'Mcp-Protocol-Version': MCP_PROTOCOL_VERSION,
			...CORS_HEADERS
		}
	});
};

// This stateless server offers no server-initiated (SSE) stream, so a GET for
// one is declined per the spec.
export const GET: RequestHandler = () =>
	rpcError(-32600, 'This MCP endpoint does not offer an event stream; use POST.', 405);

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: CORS_HEADERS });
