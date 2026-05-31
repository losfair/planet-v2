import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mkdirSync, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { s3Configured } from '$server/image';
import { requireUser } from '$server/http';
import { db } from '$server/db';

// Local-disk image store used when S3 is not configured (dev / self-host).
const ROOT = join(process.cwd(), 'data', 'img');

const MIME: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml'
};

function safePath(p: string): string {
	const cleaned = normalize(p).replace(/^(\.\.[/\\])+/, '');
	const full = join(ROOT, cleaned);
	if (!full.startsWith(ROOT)) throw error(400, 'Bad path');
	return full;
}

export const GET: RequestHandler = async ({ params }) => {
	if (s3Configured()) throw error(404, 'Served from S3');
	const full = safePath(params.path);
	if (!existsSync(full)) throw error(404, 'Not found');
	const ext = (params.path.split('.').pop() || '').toLowerCase();
	const data = await readFile(full);
	return new Response(new Uint8Array(data), {
		headers: { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000' }
	});
};

export const PUT: RequestHandler = async (event) => {
	if (s3Configured()) throw error(404, 'Use S3');
	const me = requireUser(event);
	// Only allow writing to a filename that this user registered.
	const filename = event.params.path;
	const row = db
		.query('SELECT 1 FROM images WHERE filename = ? AND username = ?')
		.get(filename, me);
	if (!row) throw error(403, 'Unknown upload target');
	const full = safePath(filename);
	mkdirSync(dirname(full), { recursive: true });
	const buf = Buffer.from(await event.request.arrayBuffer());
	await writeFile(full, buf);
	return new Response(null, { status: 200 });
};
