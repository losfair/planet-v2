import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// CSRF origin checking is re-implemented in hooks.server.ts so the OAuth
		// token endpoint (a machine-to-machine, PKCE-protected POST) can be
		// exempted while every cookie-authenticated form post stays protected.
		csrf: { checkOrigin: false },
		alias: {
			$components: 'src/lib/components',
			$server: 'src/lib/server'
		}
	}
};

export default config;
