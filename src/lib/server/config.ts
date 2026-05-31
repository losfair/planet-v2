// Centralized server configuration & domain constants.

export const config = {
	siteOrigin: process.env.PUBLIC_SITE_ORIGIN || 'http://localhost:3030',
	sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-session-secret-change-me',
	s3: {
		region: process.env.S3_REGION || 'auto',
		endpoint: process.env.S3_ENDPOINT || '',
		bucket: process.env.S3_BUCKET || 'planet-images',
		accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
		publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || 'http://localhost:3030/img'
	}
};

// Limits — mirror the original common_config.ts values.
export const limits = {
	maxNoteSize: 10 * 1024,
	maxForwardLinks: 100,
	maxLensPerUser: 30,
	maxImageUploadSize: 10 * 1024 * 1024,
	pageSizeFeed: 20,
	pageSizeNotes: 25,
	pageSizeFollow: 20,
	pageSizeSearch: 25
};

export const SESSION_COOKIE = 'planet-session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const usernameRegex = /^[a-z0-9][a-z0-9.-]{1,18}[a-z0-9]$/;
