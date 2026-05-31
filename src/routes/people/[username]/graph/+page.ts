import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ApiUserInfo, PublicUserInfo } from '$lib/types';

export const load: PageLoad = async ({ params, fetch }) => {
	const rsp = await fetch(`/api/v1/user?username=${encodeURIComponent(params.username)}`);
	if (rsp.status === 404) throw error(404, 'User not found');
	const publicInfo = (await rsp.json()) as ApiUserInfo<PublicUserInfo>;
	return { username: params.username, publicInfo };
};
