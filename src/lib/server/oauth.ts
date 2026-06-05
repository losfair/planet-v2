// OAuth 2.1 authorization server + resource server for the MCP endpoint.
//
// Planet hosts both roles itself (the common MCP single-origin setup). The flow
// a client such as Claude follows is:
//
//   1. POST /mcp with no token            → 401 + WWW-Authenticate (see /mcp)
//   2. GET  /.well-known/oauth-protected-resource[/mcp]  (served from hooks)
//   3. GET  /.well-known/oauth-authorization-server      (served from hooks)
//   4. POST /oauth/register                → dynamic client registration
//   5. GET  /oauth/authorize?…             → user logs in + consents, gets code
//   6. POST /oauth/token (code + PKCE)     → access + refresh tokens
//   7. POST /mcp with the access token     → authenticated tool calls
//
// Implements: OAuth 2.1 (auth code + PKCE S256), RFC 7591 (DCR), RFC 8414 (AS
// metadata), RFC 9728 (protected-resource metadata), RFC 8707 (resource
// indicators / audience binding). Only hashes of codes and tokens are stored.

import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { logEvent } from './log';

export const OAUTH_SCOPE = 'mcp';
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ACCESS_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// --- helpers ---------------------------------------------------------------

function sha256(s: string): string {
	return createHash('sha256').update(s).digest('hex');
}

function randomToken(): string {
	return randomBytes(32).toString('base64url');
}

/** The canonical resource identifier (audience) for this server's MCP endpoint. */
export function mcpResource(origin: string): string {
	return `${origin}/mcp`;
}

/** Normalise a resource URI for comparison (lowercase scheme+host, no trailing slash). */
function normalizeResource(uri: string): string {
	try {
		const u = new URL(uri);
		u.hash = '';
		let s = `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${u.pathname}`;
		if (s.endsWith('/')) s = s.slice(0, -1);
		return s + (u.search || '');
	} catch {
		return uri;
	}
}

/** True when `requested` targets this server's MCP resource (or its bare origin). */
export function resourceMatches(requested: string | null | undefined, origin: string): boolean {
	if (!requested) return true; // lenient: clients that omit it default to our resource
	const want = normalizeResource(requested);
	return want === normalizeResource(mcpResource(origin)) || want === normalizeResource(origin);
}

/** Verify a PKCE code_verifier against a stored S256 challenge. */
function verifyPkce(verifier: string, challenge: string): boolean {
	const computed = createHash('sha256').update(verifier).digest('base64url');
	return computed === challenge;
}

// --- discovery metadata (RFC 8414 / RFC 9728) ------------------------------

export function protectedResourceMetadata(origin: string) {
	return {
		resource: mcpResource(origin),
		authorization_servers: [origin],
		scopes_supported: [OAUTH_SCOPE],
		bearer_methods_supported: ['header']
	};
}

export function authServerMetadata(origin: string) {
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/oauth/token`,
		registration_endpoint: `${origin}/oauth/register`,
		scopes_supported: [OAUTH_SCOPE],
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic']
	};
}

// --- dynamic client registration (RFC 7591) --------------------------------

export interface ClientRow {
	client_id: string;
	client_secret_hash: string | null;
	redirect_uris: string; // JSON
	client_name: string;
	token_auth_method: string;
	scope: string;
	created_at: number;
}

export interface RegistrationResult {
	client_id: string;
	client_secret?: string;
	client_id_issued_at: number;
	redirect_uris: string[];
	token_endpoint_auth_method: string;
	grant_types: string[];
	response_types: string[];
	client_name: string;
	scope: string;
}

export class OAuthError extends Error {
	code: string;
	status: number;
	constructor(code: string, message: string, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

/** A redirect URI must be loopback (http) or otherwise HTTPS (OAuth 2.1 §1.5). */
function validRedirectUri(uri: string): boolean {
	let u: URL;
	try {
		u = new URL(uri);
	} catch {
		return false;
	}
	if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') return true;
	return u.protocol === 'https:';
}

export function registerClient(meta: Record<string, unknown>): RegistrationResult {
	const redirectUris = Array.isArray(meta.redirect_uris)
		? (meta.redirect_uris as unknown[]).filter((u): u is string => typeof u === 'string')
		: [];
	if (redirectUris.length === 0) {
		throw new OAuthError('invalid_redirect_uri', 'At least one redirect_uri is required');
	}
	for (const uri of redirectUris) {
		if (!validRedirectUri(uri)) {
			throw new OAuthError('invalid_redirect_uri', `redirect_uri must be https or loopback: ${uri}`);
		}
	}

	const method =
		typeof meta.token_endpoint_auth_method === 'string'
			? meta.token_endpoint_auth_method
			: 'none';
	if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method)) {
		throw new OAuthError('invalid_client_metadata', `Unsupported token_endpoint_auth_method: ${method}`);
	}

	const clientId = `mcp_client_${randomBytes(8).toString('hex')}`;
	const clientName = typeof meta.client_name === 'string' ? meta.client_name.slice(0, 120) : '';
	const now = Date.now();

	let clientSecret: string | undefined;
	let secretHash: string | null = null;
	if (method !== 'none') {
		clientSecret = randomToken();
		secretHash = sha256(clientSecret);
	}

	db.query(
		`INSERT INTO oauth_clients
		   (client_id, client_secret_hash, redirect_uris, client_name, token_auth_method, scope, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(clientId, secretHash, JSON.stringify(redirectUris), clientName, method, OAUTH_SCOPE, now);

	logEvent(clientName || clientId, 'oauth_register_client', null, { clientId, method });

	const result: RegistrationResult = {
		client_id: clientId,
		client_id_issued_at: Math.floor(now / 1000),
		redirect_uris: redirectUris,
		token_endpoint_auth_method: method,
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		client_name: clientName,
		scope: OAUTH_SCOPE
	};
	if (clientSecret) result.client_secret = clientSecret;
	return result;
}

export function getClient(clientId: string): ClientRow | null {
	return (
		db.query<ClientRow, [string]>('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId) ??
		null
	);
}

export function clientRedirectUris(client: ClientRow): string[] {
	try {
		const arr = JSON.parse(client.redirect_uris);
		return Array.isArray(arr) ? arr : [];
	} catch {
		return [];
	}
}

// --- authorization codes ---------------------------------------------------

export function createAuthCode(input: {
	clientId: string;
	username: string;
	redirectUri: string;
	codeChallenge: string;
	scope: string;
	resource: string | null;
}): string {
	const code = randomToken();
	db.query(
		`INSERT INTO oauth_codes
		   (code_hash, client_id, username, redirect_uri, code_challenge, scope, resource, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		sha256(code),
		input.clientId,
		input.username,
		input.redirectUri,
		input.codeChallenge,
		input.scope,
		input.resource,
		Date.now() + CODE_TTL_MS
	);
	return code;
}

interface CodeRow {
	code_hash: string;
	client_id: string;
	username: string;
	redirect_uri: string;
	code_challenge: string;
	scope: string;
	resource: string | null;
	expires_at: number;
}

/** Look up and atomically consume (delete) an authorization code. */
function consumeCode(code: string): CodeRow | null {
	const hash = sha256(code);
	const row = db.query<CodeRow, [string]>('SELECT * FROM oauth_codes WHERE code_hash = ?').get(hash);
	if (row) db.query('DELETE FROM oauth_codes WHERE code_hash = ?').run(hash);
	if (!row || row.expires_at < Date.now()) return null;
	return row;
}

// --- access / refresh tokens -----------------------------------------------

export interface TokenResponse {
	access_token: string;
	token_type: 'Bearer';
	expires_in: number;
	refresh_token: string;
	scope: string;
}

function issueTokens(input: {
	clientId: string;
	username: string;
	scope: string;
	resource: string | null;
}): TokenResponse {
	const access = randomToken();
	const refresh = randomToken();
	const now = Date.now();
	db.query(
		`INSERT INTO oauth_tokens
		   (access_hash, refresh_hash, client_id, username, scope, resource, expires_at, refresh_expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		sha256(access),
		sha256(refresh),
		input.clientId,
		input.username,
		input.scope,
		input.resource,
		now + ACCESS_TTL_MS,
		now + REFRESH_TTL_MS,
		now
	);
	return {
		access_token: access,
		token_type: 'Bearer',
		expires_in: Math.floor(ACCESS_TTL_MS / 1000),
		refresh_token: refresh,
		scope: input.scope
	};
}

interface ClientAuth {
	clientId: string;
	clientSecret?: string;
}

function authenticateClient(client: ClientRow, auth: ClientAuth): void {
	if (client.token_auth_method === 'none') return; // public client — PKCE is the proof
	if (!auth.clientSecret || sha256(auth.clientSecret) !== client.client_secret_hash) {
		throw new OAuthError('invalid_client', 'Client authentication failed', 401);
	}
}

/** grant_type=authorization_code */
export function exchangeAuthCode(input: {
	code: string;
	redirectUri: string;
	codeVerifier: string;
	resource: string | null;
	clientAuth: ClientAuth;
	origin: string;
}): TokenResponse {
	const row = consumeCode(input.code);
	if (!row) throw new OAuthError('invalid_grant', 'Authorization code is invalid or expired');
	if (row.client_id !== input.clientAuth.clientId) {
		throw new OAuthError('invalid_grant', 'Authorization code was issued to a different client');
	}
	const client = getClient(row.client_id);
	if (!client) throw new OAuthError('invalid_client', 'Unknown client', 401);
	authenticateClient(client, input.clientAuth);

	if (row.redirect_uri !== input.redirectUri) {
		throw new OAuthError('invalid_grant', 'redirect_uri mismatch');
	}
	if (!input.codeVerifier || !verifyPkce(input.codeVerifier, row.code_challenge)) {
		throw new OAuthError('invalid_grant', 'PKCE verification failed');
	}
	// Audience: the token must be issued for this server's resource.
	if (!resourceMatches(input.resource ?? row.resource, input.origin)) {
		throw new OAuthError('invalid_target', 'resource does not match this MCP server');
	}

	logEvent(row.username, 'oauth_token_issue', null, { clientId: row.client_id, grant: 'code' });
	return issueTokens({
		clientId: row.client_id,
		username: row.username,
		scope: row.scope,
		resource: row.resource ?? mcpResource(input.origin)
	});
}

interface TokenRow {
	access_hash: string;
	refresh_hash: string | null;
	client_id: string;
	username: string;
	scope: string;
	resource: string | null;
	expires_at: number;
	refresh_expires_at: number | null;
}

/** grant_type=refresh_token — rotates the refresh token (OAuth 2.1 public-client requirement). */
export function refreshTokens(input: {
	refreshToken: string;
	clientAuth: ClientAuth;
	resource: string | null;
	origin: string;
}): TokenResponse {
	const hash = sha256(input.refreshToken);
	const row = db
		.query<TokenRow, [string]>('SELECT * FROM oauth_tokens WHERE refresh_hash = ?')
		.get(hash);
	if (!row || (row.refresh_expires_at ?? 0) < Date.now()) {
		throw new OAuthError('invalid_grant', 'Refresh token is invalid or expired');
	}
	if (row.client_id !== input.clientAuth.clientId) {
		throw new OAuthError('invalid_grant', 'Refresh token was issued to a different client');
	}
	const client = getClient(row.client_id);
	if (!client) throw new OAuthError('invalid_client', 'Unknown client', 401);
	authenticateClient(client, input.clientAuth);
	if (!resourceMatches(input.resource ?? row.resource, input.origin)) {
		throw new OAuthError('invalid_target', 'resource does not match this MCP server');
	}

	// Rotation: invalidate the old grant, issue a fresh access + refresh pair.
	db.query('DELETE FROM oauth_tokens WHERE access_hash = ?').run(row.access_hash);
	logEvent(row.username, 'oauth_token_issue', null, { clientId: row.client_id, grant: 'refresh' });
	return issueTokens({
		clientId: row.client_id,
		username: row.username,
		scope: row.scope,
		resource: row.resource
	});
}

/**
 * Resolve a bearer access token to its owner, enforcing expiry and audience.
 * Returns null for anything that isn't a live token for this server.
 */
export function resolveAccessToken(token: string, origin: string): string | null {
	const row = db
		.query<TokenRow, [string]>('SELECT * FROM oauth_tokens WHERE access_hash = ?')
		.get(sha256(token));
	if (!row) return null;
	if (row.expires_at < Date.now()) return null;
	if (!resourceMatches(row.resource, origin)) return null;
	return row.username;
}

/** Best-effort cleanup of expired codes/tokens (called opportunistically). */
export function pruneExpired(): void {
	const now = Date.now();
	db.query('DELETE FROM oauth_codes WHERE expires_at < ?').run(now);
	db.query('DELETE FROM oauth_tokens WHERE refresh_expires_at < ?').run(now);
}
