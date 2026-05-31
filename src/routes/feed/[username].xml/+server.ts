import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUser } from '$server/users';
import { getSnippets } from '$server/queries';
import { config } from '$server/config';

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET: RequestHandler = ({ params }) => {
	const user = getUser(params.username);
	if (!user) throw error(404, 'User not found');
	const rsp = getSnippets({ username: params.username, viewer: null, limit: 25 });
	const snippets = rsp?.snippets ?? [];

	const title = `${user.display_name || user.username}'s Planet`;
	const siteLink = `${config.siteOrigin}/people/${user.username}/notes`;
	const selfUrl = `${config.siteOrigin}/feed/${user.username}.xml`;

	const items = snippets
		.map(
			(s) => `    <item>
      <guid isPermaLink="false">${esc(s.id)}</guid>
      <link>${esc(`${config.siteOrigin}/people/${user.username}/${s.id}`)}</link>
      <pubDate>${esc(new Date(s.utcDate).toUTCString())}</pubDate>
      <description><![CDATA[${s.content}]]></description>
    </item>`
		)
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(siteLink)}</link>
    <atom:link href="${esc(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>${esc(`Public notes by @${user.username}`)}</description>
${items}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
	});
};
