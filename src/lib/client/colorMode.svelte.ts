import { browser } from '$app/environment';

const KEY = 'chakra-ui-color-mode';

class ColorMode {
	current = $state<'light' | 'dark'>('light');

	init() {
		if (!browser) return;
		const stored = localStorage.getItem(KEY);
		let mode: 'light' | 'dark';
		if (stored === 'light' || stored === 'dark') {
			mode = stored;
		} else {
			mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		this.set(mode);

		// Shift+D toggles color mode (matches the original ColorModeWidget).
		window.addEventListener('keydown', (e) => {
			if (e.repeat) return;
			if (e.key !== 'D') return;
			if (e.target !== document.body) return;
			this.toggle();
		});
	}

	set(mode: 'light' | 'dark') {
		this.current = mode;
		if (browser) {
			localStorage.setItem(KEY, mode);
			document.documentElement.setAttribute('data-theme', mode);
		}
	}

	toggle() {
		this.set(this.current === 'dark' ? 'light' : 'dark');
	}
}

export const colorMode = new ColorMode();
