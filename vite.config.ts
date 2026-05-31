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
		exclude: ['bun:sqlite']
	}
});
