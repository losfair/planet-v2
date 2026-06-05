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
	'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version'
};

function rpcError(code: number, message: string, status: number): Response {
	return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code, message } }), {
		status,
		headers: { 'content-type': 'application/json', ...CORS_HEADERS }
	});
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// Streamable HTTP requires the client to accept JSON (and optionally SSE).
	const accept = request.headers.get('accept') ?? '';
	if (accept && !accept.includes('application/json') && !accept.includes('*/*')) {
		return rpcError(-32600, 'Client must accept application/json', 406);
	}

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
