import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { config } from '$server/config';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		// Send anonymous visitors to the proxy's auth endpoint under forward auth,
		// otherwise to the built-in sign-in form.
		throw redirect(303, config.forwardAuth.enabled ? config.forwardAuth.loginPath : '/login');
	}
	return { username: locals.user.username };
};
