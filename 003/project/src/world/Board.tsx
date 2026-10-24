import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Ink} from './Ink';
import {canvasTexture, Draw, redraw, roundRect} from './textures';

// A full frame 2D board: a canvas texture on a 16 x 9 plane, flat, in the same
// world as everything else (so it can tilt, fold, or be pushed into).
export const Board: React.FC<{
	draw: Draw;
	w?: number;
	h?: number;
	px?: [number, number];
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: number;
	opacity?: number;
	flat?: number;
	glow?: number;
	transparent?: boolean;
}> = ({draw, w = 16, h = 9, px = [1280, 720], position = [0, 0, 0], rotation, scale = 1, opacity, flat = 1, glow = 0, transparent = false}) => {
	const tex = useMemo(() => canvasTexture(px[0], px[1], () => undefined), [px[0], px[1]]);
	redraw(tex, draw);
	return (
		<Ink
			shape={['plane', w, h]}
			map={tex}
			color="#ffffff"
			position={position}
			rotation={rotation}
			scale={scale}
			flat={flat}
			glow={glow}
			opacity={opacity}
			opts={{transparent: transparent || opacity !== undefined}}
		/>
	);
};

// ---------- drawing helpers (pixel space) ----------
export const C = {
	bg: '#06080B',
	ink: '#0b0e12',
	white: '#F4F6F8',
	grey: '#8f9aa7',
	dim: '#3a4452',
	amber: '#FFA21A',
	cyan: '#5CF2E6',
	red: '#FF2B2B',
	paper: '#ece6d8',
	paperInk: '#2b2f36',
};

export const bg = (ctx: CanvasRenderingContext2D, w: number, h: number, color = C.bg, glow?: {x: number; y: number; r: number; color: string; a: number}) => {
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, w, h);
	if (glow) {
		const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
		g.addColorStop(0, hexA(glow.color, glow.a));
		g.addColorStop(1, hexA(glow.color, 0));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
	}
	// faint grid, like the reference boards, very low contrast
	ctx.strokeStyle = 'rgba(255,255,255,0.025)';
	ctx.lineWidth = 1;
	for (let x = 0; x < w; x += 64) {
		ctx.beginPath();
		ctx.moveTo(x + 0.5, 0);
		ctx.lineTo(x + 0.5, h);
		ctx.stroke();
	}
	for (let y = 0; y < h; y += 64) {
		ctx.beginPath();
		ctx.moveTo(0, y + 0.5);
		ctx.lineTo(w, y + 0.5);
		ctx.stroke();
	}
};

export const hexA = (hex: string, a: number) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const text = (
	ctx: CanvasRenderingContext2D,
	s: string,
	x: number,
	y: number,
	o: {size?: number; weight?: number; font?: string; color?: string; align?: CanvasTextAlign; ls?: number; base?: CanvasTextBaseline; alpha?: number; glow?: number} = {},
) => {
	ctx.save();
	ctx.globalAlpha = o.alpha ?? 1;
	ctx.font = `${o.weight ?? 800} ${o.size ?? 32}px ${o.font ?? 'Montserrat'}`;
	ctx.fillStyle = o.color ?? C.white;
	ctx.textAlign = o.align ?? 'center';
	ctx.textBaseline = o.base ?? 'middle';
	if (o.glow) {
		ctx.shadowColor = o.color ?? C.white;
		ctx.shadowBlur = o.glow;
	}
	if (o.ls) {
		(ctx as unknown as {letterSpacing: string}).letterSpacing = `${o.ls}px`;
	}
	ctx.fillText(s, x, y);
	ctx.restore();
};

export const mono = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size = 14, color = C.grey, align: CanvasTextAlign = 'left', ls = 2.5) =>
	text(ctx, s, x, y, {size, weight: 500, font: '"JetBrains Mono"', color, align, ls});

// a typed management notice card, like the series' building notices
export const noticeCard = (
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	w: number,
	h: number,
	o: {header: string; title: string; lines: [string, string][]; rot?: number; footer?: string; highlight?: number; strike?: number; hl?: number; s?: number},
) => {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(o.rot ?? -0.015);
	const s = o.s ?? 1;
	ctx.scale(s, s);
	w /= s;
	h /= s;
	ctx.shadowColor = 'rgba(0,0,0,0.6)';
	ctx.shadowBlur = 30;
	ctx.shadowOffsetY = 10;
	ctx.fillStyle = C.paper;
	roundRect(ctx, -w / 2, -h / 2, w, h, 6);
	ctx.fill();
	ctx.shadowColor = 'transparent';
	const x0 = -w / 2 + 34;
	let y = -h / 2 + 40;
	mono(ctx, o.header, x0, y, 13, '#6b6f76');
	y += 34;
	text(ctx, o.title, x0, y, {size: 30, weight: 800, color: C.paperInk, align: 'left'});
	y += 22;
	ctx.fillStyle = 'rgba(43,47,54,0.25)';
	ctx.fillRect(x0, y, w - 68, 2);
	y += 30;
	o.lines.forEach(([k, v], i) => {
		const yy = y + i * 34;
		if (o.hl !== undefined && i === o.hl) {
			ctx.fillStyle = hexA(C.amber, 0.28 * (o.highlight ?? 1));
			ctx.fillRect(x0 - 8, yy - 15, (w - 68 + 16) * (o.highlight ?? 1), 30);
		}
		mono(ctx, k, x0, yy, 16, '#4a4f57', 'left', 1.5);
		text(ctx, v, x0 + 170, yy, {size: 17, weight: 500, font: '"JetBrains Mono"', color: C.paperInk, align: 'left'});
		if (o.strike !== undefined && i === o.strike) {
			ctx.strokeStyle = C.paperInk;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(x0 - 4, yy);
			ctx.lineTo(x0 + (w - 60) * 1, yy);
			ctx.stroke();
		}
	});
	mono(ctx, o.footer ?? 'MANAGEMENT', w / 2 - 34, h / 2 - 28, 13, '#6b6f76', 'right');
	ctx.restore();
};

export const stamp = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, rot = -0.18, alpha = 1, scale = 1) => {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rot);
	ctx.scale(scale, scale);
	ctx.globalAlpha = alpha;
	ctx.font = `800 ${size}px Montserrat`;
	const tw = ctx.measureText(s).width;
	ctx.strokeStyle = color;
	ctx.lineWidth = size * 0.09;
	roundRect(ctx, -tw / 2 - size * 0.35, -size * 0.75, tw + size * 0.7, size * 1.5, size * 0.18);
	ctx.stroke();
	ctx.fillStyle = color;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(s, 0, size * 0.05);
	ctx.restore();
};

export const dashed = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, p = 1, w = 3, dash = [10, 9]) => {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = w;
	ctx.setLineDash(dash);
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p);
	ctx.stroke();
	ctx.restore();
};

export const ring = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, w = 3, a = 1) => {
	ctx.save();
	ctx.globalAlpha = a;
	ctx.strokeStyle = color;
	ctx.lineWidth = w;
	ctx.shadowColor = color;
	ctx.shadowBlur = 12;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
};
