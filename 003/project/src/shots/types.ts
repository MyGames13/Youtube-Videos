import React from 'react';
import * as THREE from 'three';
import {CamSpec} from '../world/mode';
import {Fx} from '../post/PostFX';
import {PhotoState} from '../world/PhotoWorld';

export type Ctx = {
	t: number; // global seconds
	lt: number; // seconds since the shot started
	dur: number;
	p: number; // 0..1 through the shot
	frame: number;
	start: number;
	end: number;
};

export type Out = {
	world: React.ReactNode;
	cam: CamSpec;
	m: number;
	fx?: Partial<Fx>;
	shake?: [number, number];
	overlay?: React.ReactNode;
	photo?: PhotoState | null; // request the photograph render target
	photoCam?: CamSpec;
	photoOpts?: {hideSubject?: boolean};
	hud?: {hide?: boolean; opacity?: number; hideMeter?: boolean};
	captions?: {lift?: number; hide?: boolean};
};

export type ShotFn = (c: Ctx) => Out;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const sm = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};
export const seg = (t: number, a: number, b: number) => sm((t - a) / (b - a));
export const lin = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIn = (x: number) => Math.pow(clamp01(x), 3);
export const easeInOut = (x: number) => {
	const t = clamp01(x);
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
// pop in: 0.9 to 1.0 with about 4 percent overshoot over ~7 frames
export const pop = (since: number) => {
	if (since <= 0) return 0.9;
	const x = clamp01(since / 0.24);
	const o = 1 + 0.04 * Math.sin(Math.PI * Math.min(1, x * 1.15));
	return (0.9 + 0.1 * easeOut(x)) * (x < 1 ? o : 1);
};
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// handheld micro shake, deterministic, in px at 720p
export const handheld = (t: number, amp = 0.3): [number, number] => [
	amp * (Math.sin(t * 2.1) * 0.6 + Math.sin(t * 5.3 + 1.2) * 0.4),
	amp * (Math.sin(t * 1.7 + 0.5) * 0.6 + Math.sin(t * 4.1 + 2.2) * 0.4),
];

// 2D board space: 1280 x 720 px mapped to a 16 x 9 world plane at z = 0
export const BOARD_CAM: CamSpec = {target: [0, 0, 0], yaw: 0, pitch: 0, frameH: 9, fov3d: 30};
export const bx = (px: number) => (px / 1280 - 0.5) * 16;
export const by = (py: number) => (0.5 - py / 720) * 9;
