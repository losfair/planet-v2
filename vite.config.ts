import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 3030,
		host: 'localhost'
	},
	ssr: {
		// Bun built-ins must not be bundled/transformed — leave them to the runtime.
		external: ['bun:sqlite']
	},
	optimizeDeps: {
		exclude: ['bun:sqlite'],
		// Pre-bundle the graph page's heavy dynamic imports at startup, so Vite
		// doesn't discover them mid-session and force a full-page reload (which can
		// interrupt SPA navigation and flash the graph's fixed-position canvas over
		// other pages in dev).
		include: ['vis-network', 'vis-data']
	}
});
