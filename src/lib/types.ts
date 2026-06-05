// Shared API contract types — kept compatible with the original Bluebird
// frontend so the ported UI can consume identical payloads.

export type ApiBasicUserInfo = {
	username: string;
	features?: string[];
};

export type ApiUserInfo<T> = {
	username: string;
	followedByYou: boolean;
	followsYou: boolean;
} & T;

export interface NoteLink {
	username: string;
	fullId: string;
	title?: string;
}

export type NoteLinkWithPosition = NoteLink & {
	position: number;
	text: string;
};

export interface NoteLensWitnessAnnotation {
	accessGrantedBasedOnLenses: string[];
}

export interface RenderableSnippet {
	id: string;
	utcDate: string;
	content: string;
	editCount?: number;
	private: boolean;
	markdown: string;
	forwardLinks: NoteLinkWithPosition[];
	username: string;
	backlinks?: NoteLink[];
	lensAnnotation?: NoteLensWitnessAnnotation;
	color?: string;
}

export interface ApiGetSnippetsRsp {
	snippets: RenderableSnippet[];
	title: string;
	author: string;
	topNote: RenderableSnippet | null;
	cursor: string | null;
}

export interface ApiSearchNoteRsp {
	notes: RenderableSnippet[];
	cursor: string | null;
	tagSearch: boolean;
}

export interface ApiCreateSnippetReq {
	private: boolean;
	content: string;
}
export interface ApiUpdateSnippetReq {
	id: string;
	private: boolean;
	content: string;
}
export interface ApiDeleteSnippetReq {
	id: string;
}
export interface ApiUploadImageReq {
	fileType: string;
	size: number;
}

export type PublicUserInfo = {
	description: string;
	displayName: string;
	topNote: string;
	contentFontFamily?: string;
	/** URL of an image shown as the background of the user's notes page. */
	backgroundImage?: string;
};

export type PrivateUserInfo = {
	private: true;
	openapiLastRevoke: number;
	noteViewV2?: boolean;
	waybackMachine?: { where: string; ak: string; sk: string };
};

export type FullUserInfo = PublicUserInfo & PrivateUserInfo;

export type GraphQueryExpr =
	| { type: 'and'; left: GraphQueryExpr; right: GraphQueryExpr }
	| { type: 'or'; left: GraphQueryExpr; right: GraphQueryExpr }
	| { type: 'not'; expr: GraphQueryExpr }
	| { type: 'hasId'; id: string }
	| { type: 'hasTag'; tag: string }
	| { type: 'withoutTag'; tag: string }
	| { type: 'timeAfter'; time: number }
	| { type: 'timeBefore'; time: number }
	| { type: 'color'; color: string }
	| { type: 'true' }
	| { type: 'false' }
	| { type: 'public' }
	| { type: 'everyday'; from: number; to: number };

export interface ApiLensInfo {
	id: string;
	description: string;
	query: string;
	access: 'private' | 'group' | 'public' | 'public-hidden';
	group?: string[];
	createdAt: number;
}

export interface LinkGraphNode {
	id: string;
	tags: string[];
	head: string;
	priv: number;
}

export interface LinkGraphEdge {
	from: string;
	to: string;
}

export interface LinkGraph {
	nodes: LinkGraphNode[];
	edges: LinkGraphEdge[];
}

export interface UserTagSummary {
	pub?: string[] | null;
	priv?: string[] | null;
	ts: number;
}

export interface UserNotification {
	lsn: string;
	ts: number;
	notifType: string;
	notifPayload: string;
}
