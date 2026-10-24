import {createContext, useContext} from 'react';
import * as THREE from 'three';

// mode m: 0 = flat vector world, 1 = full 3D. Everything derived from it is a
// pure function, so any frame renders the same on any machine.

export type ModeState = {
	m: number;
	flat: number; // material flatness derived from m
	outline: number; // outline width in px at 720p
	res: THREE.Vector2;
	zSpread: number;
	light: number; // light intensity multiplier
};

export const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

export const modeState = (m: number, res = new THREE.Vector2(1280, 720)): ModeState => ({
	m,
	flat: 1 - smooth(0.12, 0.8, m),
	// outline width in px at the frame's short side of 720 (vertical shorts keep the same line weight)
	outline: (2.4 * Math.min(res.x, res.y)) / res.y,
	res,
	zSpread: 0.025 + 0.975 * smooth(0.0, 0.9, m),
	light: smooth(0.1, 0.85, m),
});

export const ModeContext = createContext<ModeState>(modeState(1));
export const useMode = () => useContext(ModeContext);

// Camera that slides from near orthographic (2D) to perspective (3D) while
// keeping the framing height at the focus point constant: a dolly zoom.
export type CamSpec = {
	target: [number, number, number];
	yaw: number; // rad, 0 looks along -z
	pitch: number; // rad, + looks down
	roll?: number;
	frameH: number; // visible height at the target in world units
	fov3d?: number; // degrees
	flatYaw?: number;
	flatPitch?: number;
	clip?: number; // keep only this much depth in front of the target when flat (near plane)
	flatFov?: number; // projection used at m = 0 (default near orthographic). A photograph keeps its lens.
};

export const FLAT_FOV = 2.4;

export const camFor = (spec: CamSpec, m: number, aspect = 16 / 9) => {
	const e = smooth(0, 1, m);
	const fov3d = spec.fov3d ?? 38;
	// interpolate fov in log space so the ramp feels even
	const f0 = spec.flatFov ?? FLAT_FOV;
	const fov = Math.exp(Math.log(f0) + (Math.log(fov3d) - Math.log(f0)) * e);
	const yaw = (spec.flatYaw ?? 0) + (spec.yaw - (spec.flatYaw ?? 0)) * e;
	const pitch = (spec.flatPitch ?? 0) + (spec.pitch - (spec.flatPitch ?? 0)) * e;
	const dist = spec.frameH / (2 * Math.tan(((fov / 2) * Math.PI) / 180));
	const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
	const t = new THREE.Vector3(...spec.target);
	const pos = t.clone().sub(dir.clone().multiplyScalar(dist));
	const depth = Math.max(spec.frameH * 6, 30);
	const clip = spec.clip ?? 1e6;
	return {
		fov,
		pos,
		target: t,
		yaw,
		pitch,
		roll: spec.roll ?? 0,
		// flat views sit far away: pull the near plane out so thin layers keep their depth order
		near: Math.max(0.02, dist - clip, dist * 0.35 * (1 - e) * (1 - e)),
		far: dist + depth * 3,
		aspect,
		dist,
	};
};

export const lerpCam = (a: CamSpec, b: CamSpec, t: number): CamSpec => {
	const l = (x: number, y: number) => x + (y - x) * t;
	return {
		target: [l(a.target[0], b.target[0]), l(a.target[1], b.target[1]), l(a.target[2], b.target[2])],
		yaw: l(a.yaw, b.yaw),
		pitch: l(a.pitch, b.pitch),
		roll: l(a.roll ?? 0, b.roll ?? 0),
		frameH: Math.exp(l(Math.log(a.frameH), Math.log(b.frameH))),
		fov3d: l(a.fov3d ?? 38, b.fov3d ?? 38),
		flatYaw: l(a.flatYaw ?? 0, b.flatYaw ?? 0),
		flatPitch: l(a.flatPitch ?? 0, b.flatPitch ?? 0),
		clip: Math.exp(l(Math.log(a.clip ?? 1e6), Math.log(b.clip ?? 1e6))),
		flatFov: Math.exp(l(Math.log(a.flatFov ?? FLAT_FOV), Math.log(b.flatFov ?? FLAT_FOV))),
	};
};

// apply a camFor() result to a three camera without lookAt (works straight down too)
export const applyCam = (camera: THREE.PerspectiveCamera, c: ReturnType<typeof camFor>) => {
	camera.fov = c.fov;
	camera.near = c.near;
	camera.far = c.far;
	camera.aspect = c.aspect;
	camera.position.copy(c.pos);
	camera.rotation.set(-c.pitch, c.yaw, c.roll, 'YXZ');
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld();
};

// a subtree with its own flatness (pop out: one object gains volume, the rest stays flat)
export const withFlat = (s: ModeState, flat: number): ModeState => ({...s, flat});
