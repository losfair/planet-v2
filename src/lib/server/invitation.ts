import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from './config';

interface InvitePayload {
	invitedBy: string;
	nonce: string;
	exp: number; // ms epoch
}

function sign(data: string): string {
	return createHmac('sha256', config.sessionSecret + ':invite').update(data).digest('base64url');
}

export function createInvitation(invitedBy: string): string {
	const payload: InvitePayload = {
		invitedBy,
		nonce: randomUUID(),
		exp: Date.now() + 30 * 24 * 60 * 60 * 1000
	};
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${body}.${sign(body)}`;
}

export function decodeInvitation(token: string): string | null {
	const [body, sig] = token.split('.');
	if (!body || !sig) return null;
	const expected = sign(body);
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as InvitePayload;
		if (payload.exp < Date.now()) return null;
		return payload.invitedBy;
	} catch {
		return null;
	}
}
