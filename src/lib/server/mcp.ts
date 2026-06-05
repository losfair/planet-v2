// Model Context Protocol (MCP) server.
//
// A dependency-free implementation of the MCP "Streamable HTTP" transport in
// its stateless form: each request is a self-contained JSON-RPC 2.0 message
// answered with a single JSON response (no SSE / session state needed, since
// every tool here is a synchronous request→response operation).
//
// Auth reuses the existing API-token flow: `hooks.server.ts` already resolves a
// `Authorization: Bearer pat_…` header to `locals.user`, so the same personal
// access tokens minted in Settings authenticate an MCP client. Read tools work
// anonymously (viewer = null); write tools require a token.
//
// Spec: https://modelcontextprotocol.io/specification/2025-06-18

import type { SessionUser } from './auth';
import {
	createNote,
	updateNote,
	deleteNote,
	getNoteRow,
	canView,
	rowToSnippet,
	ApiError
} from './notes';
import { getSnippets, globalStream, followStream } from './queries';
import { searchNotes } from './search';
import { getUser, buildApiUserInfo } from './users';
import { limits } from './config';

export const MCP_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const SERVER_INFO = { name: 'planet-mcp', version: '1.0.0' };

// --- JSON-RPC 2.0 types ----------------------------------------------------

interface JsonRpcRequest {
	jsonrpc: '2.0';
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id: string | number | null;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

// Standard JSON-RPC error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

export interface McpContext {
	user: SessionUser | null;
}

// --- Tool registry ---------------------------------------------------------

interface Tool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	/** Returns a JSON-serialisable result, or throws ApiError on failure. */
	handler: (args: Record<string, unknown>, ctx: McpContext) => unknown;
}

function requireUser(ctx: McpContext): string {
	if (!ctx.user) {
		throw new ApiError(401, 'This tool requires authentication — set Authorization: Bearer <token>.');
	}
	return ctx.user.username;
}

function str(args: Record<string, unknown>, key: string, required = true): string {
	const v = args[key];
	if (v === undefined || v === null || v === '') {
		if (required) throw new ApiError(400, `Missing required argument: ${key}`);
		return '';
	}
	if (typeof v !== 'string') throw new ApiError(400, `Argument ${key} must be a string`);
	return v;
}

function clampLimit(args: Record<string, unknown>, fallback: number): number {
	const n = Number(args.limit);
	return Number.isFinite(n) && n >= 1 && n <= 100 ? Math.floor(n) : fallback;
}

const TOOLS: Tool[] = [
	{
		name: 'whoami',
		description:
			'Return the identity authenticated by the current API token ({ username, features }), or null if the request is anonymous.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false },
		handler: (_args, ctx) => ctx.user ?? null
	},
	{
		name: 'get_user',
		description:
			"Get a user's public profile (display name, description, pinned note, follow relationship). Returns your private fields too when the token belongs to that user.",
		inputSchema: {
			type: 'object',
			properties: { username: { type: 'string', description: 'The username to look up.' } },
			required: ['username'],
			additionalProperties: false
		},
		handler: (args, ctx) => {
			const user = getUser(str(args, 'username'));
			if (!user) throw new ApiError(404, 'User not found');
			return buildApiUserInfo(user, ctx.user?.username ?? null);
		}
	},
	{
		name: 'list_notes',
		description:
			"List a user's notes newest-first, with pagination. Private notes are included only when the token belongs to that user. Pass `cursor` from a previous result to page; pass `id` to fetch a single note by id.",
		inputSchema: {
			type: 'object',
			properties: {
				username: { type: 'string', description: 'Whose notes to list.' },
				cursor: { type: 'string', description: 'Pagination cursor from a previous response.' },
				id: { type: 'string', description: 'Fetch a single note by its id instead of a page.' },
				limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Page size (1–100).' }
			},
			required: ['username'],
			additionalProperties: false
		},
		handler: (args, ctx) => {
			const rsp = getSnippets({
				username: str(args, 'username'),
				viewer: ctx.user?.username ?? null,
				cursor: str(args, 'cursor', false) || undefined,
				id: str(args, 'id', false) || undefined,
				limit: clampLimit(args, limits.pageSizeNotes)
			});
			if (!rsp) throw new ApiError(404, 'User not found');
			return rsp;
		}
	},
	{
		name: 'get_note',
		description:
			'Fetch a single note by author and id, including its rendered HTML, markdown, forward links and backlinks. A private note is returned only when the token belongs to its author.',
		inputSchema: {
			type: 'object',
			properties: {
				username: { type: 'string', description: 'The author of the note.' },
				id: { type: 'string', description: 'The note id (e.g. 2026-06-05-0000000cdd88).' }
			},
			required: ['username', 'id'],
			additionalProperties: false
		},
		handler: (args, ctx) => {
			const row = getNoteRow(str(args, 'username'), str(args, 'id'));
			if (!row || !canView(row, ctx.user?.username ?? null)) throw new ApiError(404, 'Note not found');
			return rowToSnippet(row, { withBacklinks: true });
		}
	},
	{
		name: 'search_notes',
		description:
			"Full-text + #tag search over a user's notes. Tokens starting with # are hierarchical tag filters; the rest are matched against the full-text index. Private notes are searched only for the token owner.",
		inputSchema: {
			type: 'object',
			properties: {
				username: { type: 'string', description: 'Whose notes to search.' },
				keyword: {
					type: 'string',
					description: 'Search terms; prefix a term with # to filter by tag (e.g. "rust #projects").'
				},
				cursor: { type: 'string', description: 'Pagination cursor from a previous response.' }
			},
			required: ['username', 'keyword'],
			additionalProperties: false
		},
		handler: (args, ctx) =>
			searchNotes({
				username: str(args, 'username'),
				keyword: str(args, 'keyword').slice(0, 200),
				viewer: ctx.user?.username ?? null,
				cursor: str(args, 'cursor', false) || undefined,
				limit: limits.pageSizeSearch
			})
	},
	{
		name: 'global_stream',
		description: 'The global public stream — all public notes across every user, newest first.',
		inputSchema: {
			type: 'object',
			properties: {
				cursor: { type: 'string', description: 'Pagination cursor from a previous response.' }
			},
			additionalProperties: false
		},
		handler: (args) => globalStream(str(args, 'cursor', false) || undefined, limits.pageSizeFeed)
	},
	{
		name: 'follow_stream',
		description:
			'Your personalised follow feed — public notes from people you follow plus your own notes, newest first. Requires authentication.',
		inputSchema: {
			type: 'object',
			properties: {
				cursor: { type: 'string', description: 'Pagination cursor from a previous response.' }
			},
			additionalProperties: false
		},
		handler: (args, ctx) =>
			followStream(requireUser(ctx), str(args, 'cursor', false) || undefined, limits.pageSizeFollow)
	},
	{
		name: 'create_note',
		description:
			'Create a note authored by the authenticated user. Content is markdown (supports #tags, @mentions and [[wiki links]]). Returns the new note id. Requires authentication.',
		inputSchema: {
			type: 'object',
			properties: {
				content: { type: 'string', description: 'Markdown body of the note.' },
				private: {
					type: 'boolean',
					description: 'When true, the note is visible only to you. Defaults to false (public).'
				}
			},
			required: ['content'],
			additionalProperties: false
		},
		handler: (args, ctx) =>
			createNote(requireUser(ctx), { content: str(args, 'content'), private: !!args.private })
	},
	{
		name: 'update_note',
		description: "Replace the content (and visibility) of one of the authenticated user's notes. Requires authentication.",
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Id of the note to update.' },
				content: { type: 'string', description: 'New markdown body.' },
				private: { type: 'boolean', description: 'New visibility. Defaults to false (public).' }
			},
			required: ['id', 'content'],
			additionalProperties: false
		},
		handler: (args, ctx) => {
			updateNote(requireUser(ctx), {
				id: str(args, 'id'),
				content: str(args, 'content'),
				private: !!args.private
			});
			return { ok: true };
		}
	},
	{
		name: 'delete_note',
		description: "Delete one of the authenticated user's notes by id. Requires authentication.",
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Id of the note to delete.' } },
			required: ['id'],
			additionalProperties: false
		},
		handler: (args, ctx) => {
			deleteNote(requireUser(ctx), str(args, 'id'));
			return { ok: true };
		}
	}
];

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

// --- Method dispatch -------------------------------------------------------

function negotiateProtocol(requested: unknown): string {
	return typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
		? requested
		: MCP_PROTOCOL_VERSION;
}

function callTool(params: Record<string, unknown>, ctx: McpContext) {
	const name = params.name;
	if (typeof name !== 'string') throw new ApiError(400, 'tool name required');
	const tool = TOOLS_BY_NAME.get(name);
	if (!tool) throw new ApiError(404, `Unknown tool: ${name}`);
	const args = (params.arguments as Record<string, unknown>) ?? {};
	try {
		const data = tool.handler(args, ctx);
		return {
			content: [{ type: 'text', text: JSON.stringify(data ?? null, null, 2) }]
		};
	} catch (e) {
		// Tool execution errors are reported inside the result (isError) so the
		// model can see and react to them, per the MCP tools spec.
		const message = e instanceof Error ? e.message : 'Tool execution failed';
		return { content: [{ type: 'text', text: message }], isError: true };
	}
}

/**
 * Handle a single JSON-RPC message. Returns the response object for requests,
 * or `null` for notifications (which get no reply).
 */
function dispatch(msg: JsonRpcRequest, ctx: McpContext): JsonRpcResponse | null {
	const isNotification = msg.id === undefined || msg.id === null;
	const id = msg.id ?? null;
	const ok = (result: unknown): JsonRpcResponse | null =>
		isNotification ? null : { jsonrpc: '2.0', id, result };
	const fail = (code: number, message: string): JsonRpcResponse | null =>
		isNotification ? null : { jsonrpc: '2.0', id, error: { code, message } };

	switch (msg.method) {
		case 'initialize':
			return ok({
				protocolVersion: negotiateProtocol(msg.params?.protocolVersion),
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions:
					'Planet is a short-notes app. Read tools (get_user, list_notes, search_notes, global_stream) work anonymously; create/update/delete and follow_stream require an API token from Settings, sent as an Authorization: Bearer header.'
			});

		case 'notifications/initialized':
		case 'notifications/cancelled':
			return null; // notifications — no reply

		case 'ping':
			return ok({});

		case 'tools/list':
			return ok({
				tools: TOOLS.map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: t.inputSchema
				}))
			});

		case 'tools/call':
			try {
				return ok(callTool(msg.params ?? {}, ctx));
			} catch (e) {
				if (e instanceof ApiError) return fail(INVALID_PARAMS, e.message);
				return fail(INTERNAL_ERROR, e instanceof Error ? e.message : 'Internal error');
			}

		default:
			return fail(METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
	}
}

function isValidMessage(m: unknown): m is JsonRpcRequest {
	return (
		typeof m === 'object' &&
		m !== null &&
		(m as JsonRpcRequest).jsonrpc === '2.0' &&
		typeof (m as JsonRpcRequest).method === 'string'
	);
}

/**
 * Process a parsed JSON-RPC body (single message or batch) and return the
 * response payload to serialise, or `null` when there is nothing to send back
 * (e.g. a body consisting solely of notifications/responses → HTTP 202).
 */
export function handleMcpMessage(body: unknown, ctx: McpContext): unknown {
	if (Array.isArray(body)) {
		if (body.length === 0) {
			return { jsonrpc: '2.0', id: null, error: { code: INVALID_REQUEST, message: 'Empty batch' } };
		}
		const responses = body
			.map((m) =>
				isValidMessage(m)
					? dispatch(m, ctx)
					: ({ jsonrpc: '2.0', id: null, error: { code: INVALID_REQUEST, message: 'Invalid request' } } as JsonRpcResponse)
			)
			.filter((r): r is JsonRpcResponse => r !== null);
		return responses.length ? responses : null;
	}

	if (!isValidMessage(body)) {
		return { jsonrpc: '2.0', id: null, error: { code: INVALID_REQUEST, message: 'Invalid request' } };
	}
	return dispatch(body, ctx);
}

export { PARSE_ERROR, INVALID_REQUEST };
