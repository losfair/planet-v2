import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { config, limits } from './config';
import { dateStr } from './ids';
import { logEvent } from './log';
import { ApiError } from './notes';

const ALLOWED_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml'
};

export function s3Configured(): boolean {
	return !!(config.s3.endpoint && config.s3.accessKeyId && config.s3.secretAccessKey);
}

let _client: S3Client | null = null;
function client(): S3Client {
	if (_client) return _client;
	_client = new S3Client({
		region: config.s3.region,
		endpoint: config.s3.endpoint,
		forcePathStyle: true,
		credentials: {
			accessKeyId: config.s3.accessKeyId,
			secretAccessKey: config.s3.secretAccessKey
		}
	});
	return _client;
}

export interface UploadTicket {
	uploadUrl: string;
	uploadHeaders: Record<string, string[]>;
	finalUrl: string;
	contentType: string;
}

export async function createUploadTicket(
	username: string,
	fileType: string,
	size: number
): Promise<UploadTicket> {
	const ext = fileType.toLowerCase();
	const contentType = ALLOWED_TYPES[ext];
	if (!contentType) throw new ApiError(400, 'Unsupported file type');
	if (size <= 0 || size > limits.maxImageUploadSize) throw new ApiError(400, 'Invalid file size');

	const now = Date.now();
	const seq = randomBytes(4).toString('hex');
	const rand = randomBytes(3).toString('hex');
	const imageId = `${dateStr(now)}-${seq}-${rand}`;
	const filename = `${username}/${imageId}.${ext}`;

	db.query(
		'INSERT INTO images (username, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?)'
	).run(username, filename, contentType, size, now);
	logEvent(username, 'upload_img', null, { filename, size });

	if (s3Configured()) {
		const cmd = new PutObjectCommand({
			Bucket: config.s3.bucket,
			Key: filename,
			ContentType: contentType
		});
		const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 600 });
		return {
			uploadUrl,
			uploadHeaders: { 'Content-Type': [contentType] },
			finalUrl: `${config.s3.publicBaseUrl}/${filename}`,
			contentType
		};
	}

	// Local fallback: images are served by our own /img route, so the final URL
	// is a same-origin relative path (S3_PUBLIC_BASE_URL is not used here).
	return {
		uploadUrl: `/img/${filename}`,
		uploadHeaders: { 'Content-Type': [contentType] },
		finalUrl: `/img/${filename}`,
		contentType
	};
}
