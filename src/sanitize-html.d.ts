declare module 'sanitize-html' {
	type Attributes = Record<string, string>;

	interface TransformResult {
		tagName: string;
		attribs: Attributes;
	}

	interface IOptions {
		allowedTags?: string[];
		allowedAttributes?: Record<string, string[]>;
		allowedSchemes?: string[];
		transformTags?: Record<string, (tagName: string, attribs: Attributes) => TransformResult>;
	}

	function sanitizeHtml(html: string, options?: IOptions): string;

	namespace sanitizeHtml {
		export type { IOptions };
	}

	export default sanitizeHtml;
}
