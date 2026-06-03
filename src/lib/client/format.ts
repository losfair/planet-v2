export function pad(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

/** YYYY-MM-DD HH:MM in local time (matches the original formatDate). */
export function formatDate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoDate(d: Date): string {
	return d.toISOString().split('T')[0];
}

export const urlRegex =
	/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
export { hashTagRegex } from '$lib/tags';
export const atMentionRegex = /(\s|^)@([a-z0-9.-]{1,30}[a-z0-9])/g;
