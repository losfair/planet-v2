import type { LayoutServerLoad } from './$types';
import { config } from '$server/config';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		user: locals.user ? { username: locals.user.username, features: locals.user.features } : null,
		forwardAuth: config.forwardAuth.enabled
	};
};
