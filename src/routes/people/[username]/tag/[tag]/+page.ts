import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ApiGetSnippetsRsp, ApiUserInfo, PublicUserInfo } from '$lib/types';

export const load: PageLoad = async ({ params, fetch }) => {
	const username = params.username;
	const [userRsp, notesRsp] = await Promise.all([
		fetch(`/api/v1/user?username=${encodeURIComponent(username)}`),
		fetch(`/api/v1/notes?username=${encodeURIComponent(username)}`)
	]);
	if (userRsp.status === 404) throw error(404, 'User not found');
	const publicInfo = (await userRsp.json()) as ApiUserInfo<PublicUserInfo>;
	const data = (await notesRsp.json()) as ApiGetSnippetsRsp;
	return { username, publicInfo, data, tag: params.tag };
};
