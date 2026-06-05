import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Configure marked: GFM (tables, etc.) but disable autolinking of bare URLs
// and emails — the frontend linkifies those itself (so it can attach
// at-mention / hashtag / forward-link behaviour to plain text).
marked.use({
	gfm: true,
	breaks: true,
	tokenizer: {
		url() {
			return false;
		}
	}
});

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
	allowedTags: [
		'p',
		'a',
		'ul',
		'ol',
		'li',
		'blockquote',
		'pre',
		'code',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'img',
		'strong',
		'em',
		'b',
		'i',
		'br',
		'hr',
		'del',
		's',
		'span',
		'div'
	],
	allowedAttributes: {
		a: ['href', 'title', 'target', 'rel'],
		img: ['src', 'alt', 'title'],
		'*': ['class']
	},
	allowedSchemes: ['http', 'https', 'mailto', 'data'],
	transformTags: {
		a: (tagName, attribs) => ({ tagName, attribs })
	}
};

/** Render markdown source into sanitized HTML for storage. */
export function renderMarkdown(md: string): string {
	const raw = marked.parse(md, { async: false }) as string;
	return sanitizeHtml(raw, SANITIZE_OPTS);
}

/** Strip markdown/HTML to plaintext for full-text indexing & previews. */
export function toPlainText(md: string): string {
	const html = marked.parse(md, { async: false }) as string;
	const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
	return text.replace(/\s+/g, ' ').trim();
}
