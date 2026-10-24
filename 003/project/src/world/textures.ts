import * as THREE from 'three';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

// Fonts are bundled with @fontsource (no network at render time). Canvas textures
// must wait until they are loaded, or the first frames would draw fallback glyphs.
let fontsReady = false;
const fontPromise: Promise<void> | null =
	typeof document === 'undefined'
		? null
		: Promise.all([
				document.fonts.load('800 64px Montserrat'),
				document.fonts.load('700 64px Montserrat'),
				document.fonts.load('600 64px Montserrat'),
				document.fonts.load('700 64px Caveat'),
				document.fonts.load('500 64px "JetBrains Mono"'),
				document.fonts.load('700 64px "JetBrains Mono"'),
			]).then(() => {
				fontsReady = true;
			});

export const useFontsReady = () => {
	const [ready, setReady] = useState(fontsReady);
	const [handle] = useState(() => (fontsReady ? null : delayRender('fonts')));
	useEffect(() => {
		if (fontsReady) {
			if (handle !== null) continueRender(handle);
			return;
		}
		fontPromise?.then(() => {
			setReady(true);
			if (handle !== null) continueRender(handle);
		});
	}, [handle]);
	return ready;
};

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export const canvasTexture = (w: number, h: number, draw: Draw) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d', {willReadFrequently: true})!;
	draw(ctx, w, h);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	t.needsUpdate = true;
	return t;
};

export const redraw = (t: THREE.CanvasTexture, draw: Draw) => {
	const c = t.image as HTMLCanvasElement;
	const ctx = c.getContext('2d', {willReadFrequently: true})!;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, c.width, c.height);
	draw(ctx, c.width, c.height);
	t.needsUpdate = true;
};

// deterministic pseudo random
export const rand = (i: number, s = 0) => {
	const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
	return x - Math.floor(x);
};

export const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
};

// vertical gradient texture (skies, glows)
export const gradientTexture = (stops: [number, string][], w = 4, h = 256) =>
	canvasTexture(w, h, (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		stops.forEach(([o, c]) => g.addColorStop(o, c));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	});

// soft round glow sprite
export const glowTexture = (() => {
	let t: THREE.CanvasTexture | null = null;
	return () => {
		if (t) return t;
		t = canvasTexture(128, 128, (ctx, w, h) => {
			const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
			g.addColorStop(0, 'rgba(255,255,255,1)');
			g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
			g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
			g.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
		});
		return t;
	};
})();
