<script lang="ts" module>
	// Physics-based "Liquid Glass" refraction, ported from /Users/user/Projects/liquid-glass
	// (the SVG `feDisplacementMap` + `backdrop-filter` technique). Instead of blurring a
	// generic texture, we generate a displacement map sized to each glass element whose
	// bezel ring carries real refraction vectors (computed from an index-of-refraction
	// profile) and a neutral centre — so only the edges bend the backdrop, like Apple's.

	// Convex-squircle surface height profile across the bezel (0..1).
	const surfaceFn = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);

	/** Per-bezel refraction displacement profile for a given thickness / IOR. */
	function refractionProfile(thickness: number, bezel: number, ior: number, samples = 128) {
		const eta = 1 / ior;
		const refract = (nx: number, ny: number): [number, number] | null => {
			const dot = ny;
			const k = 1 - eta * eta * (1 - dot * dot);
			if (k < 0) return null;
			const sq = Math.sqrt(k);
			return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
		};
		const profile = new Float64Array(samples);
		for (let i = 0; i < samples; i++) {
			const x = i / samples;
			const y = surfaceFn(x);
			const dx = x < 1 ? 0.0001 : -0.0001;
			const deriv = (surfaceFn(x + dx) - y) / dx;
			const mag = Math.sqrt(deriv * deriv + 1);
			const ref = refract(-deriv / mag, -1 / mag);
			profile[i] = ref ? ref[0] * ((y * bezel + thickness) / ref[1]) : 0;
		}
		return profile;
	}

	/** Encode the rounded-rect bezel displacement into an RG image (128 = no shift). */
	function displacementMap(
		w: number,
		h: number,
		radius: number,
		bezel: number,
		profile: Float64Array,
		maxDisp: number
	): string {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		const img = ctx.createImageData(w, h);
		const d = img.data;
		for (let i = 0; i < d.length; i += 4) {
			d[i] = 128;
			d[i + 1] = 128;
			d[i + 2] = 0;
			d[i + 3] = 255;
		}
		const r = radius;
		const rSq = r * r;
		const r1Sq = (r + 1) ** 2;
		const rBSq = Math.max(r - bezel, 0) ** 2;
		const wB = w - r * 2;
		const hB = h - r * 2;
		const S = profile.length;
		for (let y1 = 0; y1 < h; y1++) {
			for (let x1 = 0; x1 < w; x1++) {
				const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
				const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
				const dSq = x * x + y * y;
				if (dSq > r1Sq || dSq < rBSq) continue;
				const dist = Math.sqrt(dSq);
				const fromSide = r - dist;
				const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
				if (op <= 0 || dist === 0) continue;
				const cos = x / dist;
				const sin = y / dist;
				const bi = Math.min(((fromSide / bezel) * S) | 0, S - 1);
				const disp = profile[bi] || 0;
				const dX = (-cos * disp) / maxDisp;
				const dY = (-sin * disp) / maxDisp;
				const idx = (y1 * w + x1) * 4;
				d[idx] = (128 + dX * 127 * op + 0.5) | 0;
				d[idx + 1] = (128 + dY * 127 * op + 0.5) | 0;
			}
		}
		ctx.putImageData(img, 0, 0);
		return c.toDataURL();
	}

	/** Edge specular-highlight mask (white where light grazes the bezel). */
	function specularMap(w: number, h: number, radius: number, bezel: number, angle = Math.PI / 3): string {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		const img = ctx.createImageData(w, h);
		const d = img.data;
		d.fill(0);
		const r = radius;
		const rSq = r * r;
		const r1Sq = (r + 1) ** 2;
		const rBSq = Math.max(r - bezel, 0) ** 2;
		const wB = w - r * 2;
		const hB = h - r * 2;
		const sv = [Math.cos(angle), Math.sin(angle)];
		for (let y1 = 0; y1 < h; y1++) {
			for (let x1 = 0; x1 < w; x1++) {
				const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
				const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
				const dSq = x * x + y * y;
				if (dSq > r1Sq || dSq < rBSq) continue;
				const dist = Math.sqrt(dSq);
				const fromSide = r - dist;
				const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
				if (op <= 0 || dist === 0) continue;
				const cos = x / dist;
				const sin = -y / dist;
				const dot = Math.abs(cos * sv[0] + sin * sv[1]);
				const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2));
				const coeff = dot * edge;
				const col = (255 * coeff) | 0;
				const alpha = (col * coeff * op) | 0;
				const idx = (y1 * w + x1) * 4;
				d[idx] = col;
				d[idx + 1] = col;
				d[idx + 2] = col;
				d[idx + 3] = alpha;
			}
		}
		ctx.putImageData(img, 0, 0);
		return c.toDataURL();
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	let {
		children,
		class: className = '',
		style = '',
		radius = 22,
		padding = '0',
		/** Glass depth — larger bends the backdrop more. */
		thickness = 14,
		/** Width of the refracting edge ring (px). */
		bezel = 18,
		/** Index of refraction. */
		ior = 1.5,
		/** Overall displacement multiplier. */
		scaleRatio = 1,
		/** Frost: gaussian blur of the refracted backdrop (px). */
		frost = 4,
		/** Backdrop saturation boost. */
		saturate = 1.6,
		/** Edge specular highlight opacity / saturation. */
		specularOpacity = 0.5,
		specularSaturation = 5
	}: {
		children: Snippet;
		class?: string;
		style?: string;
		radius?: number;
		padding?: string;
		thickness?: number;
		bezel?: number;
		ior?: number;
		scaleRatio?: number;
		frost?: number;
		saturate?: number;
		specularOpacity?: number;
		specularSaturation?: number;
	} = $props();

	const uid = $props.id();
	const filterId = `lg-${uid}`;

	let el = $state<HTMLDivElement>();
	let dispUrl = $state('');
	let specUrl = $state('');
	let mapW = $state(0);
	let mapH = $state(0);
	let scale = $state(0);
	const ready = $derived(!!dispUrl);

	function rebuild() {
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const w = Math.round(rect.width);
		const h = Math.round(rect.height);
		if (w < 2 || h < 2) return;
		const b = Math.min(bezel, radius - 1, Math.min(w, h) / 2 - 1);
		if (b <= 0) return;
		const profile = refractionProfile(thickness, b, ior);
		const maxDisp = Math.max(...Array.from(profile).map(Math.abs)) || 1;
		dispUrl = displacementMap(w, h, radius, b, profile, maxDisp);
		specUrl = specularMap(w, h, radius, b * 2.5);
		scale = maxDisp * scaleRatio;
		mapW = w;
		mapH = h;
	}

	onMount(() => {
		let timer: ReturnType<typeof setTimeout>;
		const schedule = () => {
			clearTimeout(timer);
			timer = setTimeout(rebuild, 60);
		};
		// Two rAFs so layout (width: 100% etc.) has settled before measuring.
		requestAnimationFrame(() => requestAnimationFrame(rebuild));
		const ro = new ResizeObserver(schedule);
		ro.observe(el!);
		return () => {
			clearTimeout(timer);
			ro.disconnect();
		};
	});
</script>

<div bind:this={el} class="lg {className}" style="--lg-radius:{radius}px; {style}">
	<svg class="lg-svg" aria-hidden="true" color-interpolation-filters="sRGB">
		<defs>
			<filter id={filterId} x="0%" y="0%" width="100%" height="100%">
				{#if ready}
					<feGaussianBlur in="SourceGraphic" stdDeviation={frost} result="blurred" />
					<feImage href={dispUrl} x="0" y="0" width={mapW} height={mapH} result="disp" />
					<feDisplacementMap
						in="blurred"
						in2="disp"
						scale={scale}
						xChannelSelector="R"
						yChannelSelector="G"
						result="displaced"
					/>
					<feColorMatrix in="displaced" type="saturate" values={String(specularSaturation)} result="displaced_sat" />
					<feImage href={specUrl} x="0" y="0" width={mapW} height={mapH} result="spec" />
					<feComposite in="displaced_sat" in2="spec" operator="in" result="spec_masked" />
					<feComponentTransfer in="spec" result="spec_faded">
						<feFuncA type="linear" slope={specularOpacity} />
					</feComponentTransfer>
					<feBlend in="spec_masked" in2="displaced" mode="normal" result="with_sat" />
					<feBlend in="spec_faded" in2="with_sat" mode="normal" />
				{/if}
			</filter>
		</defs>
	</svg>

	<!-- Refracted backdrop. -->
	<span
		class="lg-warp"
		style="backdrop-filter: {ready ? `url(#${filterId})` : `blur(${frost + 6}px)`} saturate({saturate}); -webkit-backdrop-filter: blur({frost + 6}px) saturate({saturate});"
	></span>

	<!-- Tint + inner specular rim. -->
	<span class="lg-sheen"></span>

	<!-- Sharp content. -->
	<div class="lg-content" style="padding: {padding};">
		{@render children()}
	</div>
</div>

<style>
	.lg {
		position: relative;
		display: inline-flex;
		border-radius: var(--lg-radius);
		isolation: isolate;
		box-shadow:
			0 6px 24px rgba(0, 0, 0, 0.18),
			0 1px 3px rgba(0, 0, 0, 0.12);
	}
	.lg-svg {
		position: absolute;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.lg-warp {
		position: absolute;
		inset: 0;
		z-index: 0;
		border-radius: inherit;
		overflow: hidden;
	}
	.lg-sheen {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: inherit;
		pointer-events: none;
		/* subtle tint */
		background: rgba(255, 255, 255, 0.06);
		/* soft inner glow + crisp rim = the glass "thickness" */
		box-shadow:
			inset 0 0 20px -6px rgba(255, 255, 255, 0.5),
			inset 0 0 0 0.5px rgba(255, 255, 255, 0.35);
	}
	.lg-content {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		width: 100%;
	}
</style>
