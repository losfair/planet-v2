import type { SessionUser } from '$server/auth';

declare global {
	namespace App {
		interface Locals {
			/** The authenticated user for this request, or null. */
			user: SessionUser | null;
		}
		interface PageData {
			user?: SessionUser | null;
		}
		// interface Error {}
		// interface Platform {}
	}
}

export {};
