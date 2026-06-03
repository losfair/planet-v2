<script lang="ts">
	import { page } from '$app/state';

	const user = $derived(page.data.user);

	type Ep = { method: 'GET' | 'POST'; path: string; desc: string; body?: string };

	const publicEps: Ep[] = [
		{ method: 'GET', path: '/api/v1/user?username={u}', desc: 'Public profile (and your own private fields when authenticated as {u}).' },
		{ method: 'GET', path: '/api/v1/notes?username={u}&cursor=&id=&limit=', desc: 'Paginated notes. With a token for your own account, private notes are included. limit 1–100.' },
		{ method: 'GET', path: '/api/v1/stream/user?username={u}&cursor=', desc: "A user's note stream." },
		{ method: 'GET', path: '/api/v1/stream/global?cursor=', desc: 'Global public stream.' },
		{ method: 'GET', path: '/api/v1/search_note/{u}?keyword=&before=', desc: 'Full-text + #tag search. before is a pagination cursor.' },
		{ method: 'GET', path: '/api/v1/tags/{u}', desc: "A user's hierarchical tags." },
		{ method: 'GET', path: '/api/v1/lens/list?username={u}', desc: 'Lenses visible to you.' },
		{ method: 'GET', path: '/api/v1/lens/query?username={u}&id={lens}&cursor=', desc: 'Run a saved lens query.' },
		{ method: 'GET', path: '/api/v1/graph/{u}?q={json-expr}', desc: 'Link graph (nodes + edges). q is a JSON GraphQueryExpr.' },
		{ method: 'GET', path: '/api/v1/user/follower?username={u}&cursor=', desc: 'Followers.' },
		{ method: 'GET', path: '/api/v1/user/following?username={u}&cursor=', desc: 'Following.' },
		{ method: 'GET', path: '/api/v1/user/follow_stat?username={u}', desc: 'Follower / following counts.' },
		{ method: 'GET', path: '/feed/{u}.xml', desc: 'RSS feed of public notes.' }
	];

	const authEps: Ep[] = [
		{ method: 'GET', path: '/edge/api/v1/basic_info', desc: 'The authenticated identity ({ username, features }).' },
		{ method: 'GET', path: '/me/api/v1/history?id=&cursor=', desc: 'Your mutation log for the last 90 days.' },
		{ method: 'GET', path: '/me/api/v1/notification/list?cursor=', desc: 'Your notifications.' },
		{ method: 'GET', path: '/me/api/v1/stream/follow?cursor=', desc: 'Your personalised follow feed.' },
		{ method: 'GET', path: '/me/api/v1/emails', desc: 'Email addresses on your account.' },
		{ method: 'POST', path: '/me/api/v1/create_note', desc: 'Create a note.', body: '{ "content": "string", "private": true }' },
		{ method: 'POST', path: '/me/api/v1/update_note', desc: 'Update a note.', body: '{ "id": "string", "content": "string", "private": false }' },
		{ method: 'POST', path: '/me/api/v1/delete_note', desc: 'Delete a note.', body: '{ "id": "string" }' },
		{ method: 'POST', path: '/me/api/v1/set_top_note', desc: 'Pin (or unpin with "") a note.', body: '{ "noteId": "string" }' },
		{ method: 'POST', path: '/me/api/v1/annotate_note', desc: 'Set a note colour.', body: '{ "id": "string", "color": "blue" }' },
		{ method: 'POST', path: '/me/api/v1/follow_control/follow', desc: 'Follow a user.', body: '{ "peer": "username" }' },
		{ method: 'POST', path: '/me/api/v1/follow_control/unfollow', desc: 'Unfollow a user.', body: '{ "peer": "username" }' },
		{ method: 'POST', path: '/me/api/v1/update_user', desc: 'Update your profile.', body: '{ "displayName": "string", "description": "string" }' },
		{ method: 'POST', path: '/me/api/v1/upload_image', desc: 'Get a presigned image upload ticket.', body: '{ "fileType": "png", "size": 12345 }' },
		{ method: 'POST', path: '/me/api/v1/lens/edit', desc: 'Create or update a lens.', body: '{ "id": "work", "query": "tag work and public", "access": "public", "update": true }' },
		{ method: 'POST', path: '/me/api/v1/lens/delete', desc: 'Delete a lens.', body: '{ "id": "work" }' },
		{ method: 'GET', path: '/me/api/v1/openapi/tokens', desc: 'List your API tokens (id, name, createdAt).' },
		{ method: 'POST', path: '/me/api/v1/openapi/create_token', desc: 'Issue a new API token (returned once).', body: '{ "name": "CLI" }' },
		{ method: 'POST', path: '/me/api/v1/openapi/revoke_token', desc: 'Revoke one token by id.', body: '{ "id": "string" }' },
		{ method: 'POST', path: '/me/api/v1/openapi/revoke_all_tokens', desc: 'Revoke every API token.' }
	];

	const origin = $derived(page.url.origin);
</script>

<svelte:head><title>API · Planet</title></svelte:head>

<header class="bar">
	<a class="brand" href="/"><img src="/icon.svg" alt="" width="26" /><span>Planet</span></a>
	<span class="spacer"></span>
	{#if user?.username}
		<a class="link" href={`/people/${user.username}/notes`}>@{user.username}</a>
	{/if}
</header>

<main class="doc">
	<h1>Planet API</h1>
	<p class="lede">
		A small JSON HTTP API. Read endpoints under <code>/api</code> are public; write and
		account endpoints under <code>/me</code> require authentication.
	</p>

	<h2>Authentication</h2>
	<p>
		Authenticate programmatic requests with an API token in the
		<code>Authorization</code> header:
	</p>
	<pre><code>Authorization: Bearer pat_xxxxxxxx...</code></pre>
	<p>
		Create a token in <strong>Settings → Data → API → Create token</strong> (it's shown once —
		copy it then). <em>Revoke all</em> invalidates every previously issued token. Browser
		sessions are authenticated by cookie automatically, so the web app needs no token.
	</p>

	<h2>Base URL</h2>
	<pre><code>{origin}</code></pre>

	<h2>Example</h2>
	<pre><code>{`# create a public note
curl -X POST ${origin}/me/api/v1/create_note \\
  -H "Authorization: Bearer $PLANET_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"hello from the API #demo","private":false}'

# read your notes (private included)
curl "${origin}/api/v1/notes?username=$PLANET_USER" \\
  -H "Authorization: Bearer $PLANET_TOKEN"`}</code></pre>

	<h2>Public endpoints</h2>
	<div class="eps">
		{#each publicEps as ep (ep.method + ep.path)}
			<div class="ep">
				<div class="sig"><span class="m {ep.method.toLowerCase()}">{ep.method}</span><code>{ep.path}</code></div>
				<p class="d">{ep.desc}</p>
			</div>
		{/each}
	</div>

	<h2>Authenticated endpoints</h2>
	<p class="note">Send <code>Authorization: Bearer &lt;token&gt;</code>. POST bodies are JSON.</p>
	<div class="eps">
		{#each authEps as ep (ep.method + ep.path)}
			<div class="ep">
				<div class="sig"><span class="m {ep.method.toLowerCase()}">{ep.method}</span><code>{ep.path}</code></div>
				<p class="d">{ep.desc}</p>
				{#if ep.body}<pre class="body"><code>{ep.body}</code></pre>{/if}
			</div>
		{/each}
	</div>

	<h2>Notes</h2>
	<ul class="bullets">
		<li>Cursors are opaque — pass back the <code>cursor</code> from the previous response.</li>
		<li>Errors return a non-2xx status with a plain-text or <code>{'{ "message" }'}</code> body.</li>
		<li>JSON POSTs aren't subject to CSRF checks; token requests can be cross-origin.</li>
	</ul>
</main>

<style>
	.bar {
		display: flex;
		align-items: center;
		height: 56px;
		padding: 0 20px;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		background: var(--header-bg);
		backdrop-filter: blur(5px);
		z-index: 2;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
	}
	.spacer {
		flex: 1;
	}
	.link {
		color: var(--accent);
		text-decoration: none;
	}
	.doc {
		max-width: 820px;
		margin: 0 auto;
		padding: 32px 20px 80px;
		line-height: 1.6;
	}
	h1 {
		font-size: 32px;
		margin: 0 0 8px;
	}
	h2 {
		font-size: 22px;
		margin: 36px 0 12px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 6px;
	}
	.lede {
		font-size: 18px;
		color: var(--text-secondary);
	}
	code {
		font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 0.9em;
	}
	p code,
	li code {
		background: var(--code-bg);
		padding: 1px 5px;
		border-radius: var(--radius-sm);
	}
	pre {
		background: var(--code-bg);
		border-radius: var(--radius-md);
		padding: 14px 16px;
		overflow-x: auto;
		font-size: 13px;
		line-height: 1.5;
	}
	pre.body {
		margin: 8px 0 0;
		font-size: 12px;
	}
	.eps {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.ep {
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
	}
	.sig {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.sig code {
		word-break: break-all;
	}
	.m {
		font-size: 11px;
		font-weight: 700;
		border-radius: 5px;
		padding: 2px 7px;
		color: #fff;
		flex-shrink: 0;
	}
	.m.get {
		background: var(--chakra-colors-blue-500);
	}
	.m.post {
		background: var(--chakra-colors-green-600);
	}
	.d {
		margin: 6px 0 0;
		color: var(--text-secondary);
		font-size: 14px;
	}
	.note {
		color: var(--text-secondary);
		font-size: 14px;
	}
	.bullets {
		color: var(--text-secondary);
		font-size: 14px;
	}
</style>
