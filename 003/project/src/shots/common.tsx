import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Ink} from '../world/Ink';
import {canvasTexture, redraw} from '../world/textures';
import {Stickman} from '../world/Stickman';
import {Rig, basePose, idle} from '../world/rig';
import {CameraProp} from '../world/Arm';
import {PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';

// figure space <-> world space (figure at pos, turned by yaw about +y)
export type Fig = {pos: THREE.Vector3; yaw: number};
export const toWorld = (f: Fig, v: THREE.Vector3) => v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw).add(f.pos);
export const toFig = (f: Fig, v: THREE.Vector3) => v.clone().sub(f.pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -f.yaw);
export const qWorld = (f: Fig, q: THREE.Quaternion) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw).multiply(q);

export const Figure: React.FC<{f: Fig; rig: Rig; scarf?: number; color?: string; flat?: number; glow?: number; hideHead?: boolean; scale?: number}> = ({f, rig, scarf, color, flat, glow, hideHead, scale}) => (
	<group position={f.pos} rotation={[0, f.yaw, 0]} scale={scale ?? 1}>
		<Stickman rig={rig} scarf={scarf} color={color} flat={flat} glow={glow} hideHead={hideHead} />
	</group>
);

// card held in figure space, drawn in world space
export const HeldCard: React.FC<{f: Fig; p: THREE.Vector3; q: THREE.Quaternion; glow?: number; develop?: number; stamp?: number; flat?: number}> = ({f, p, q, glow, develop, stamp, flat}) => {
	const tex = usePhotoTex();
	return <PhotoCard map={tex} position={toWorld(f, p)} quaternion={qWorld(f, q)} glow={glow} develop={develop} stamp={stamp} flat={flat} />;
};

// text label as a small canvas plane (for diagrams in flat world space)
export const Label: React.FC<{
	text: string;
	position: [number, number, number];
	h: number; // world height of the plane
	color?: string;
	font?: string;
	weight?: number;
	align?: 'left' | 'center' | 'right';
	opacity?: number;
	glow?: number;
	ls?: number;
}> = ({text, position, h, color = '#F4F6F8', font = 'Montserrat', weight = 800, align = 'center', opacity = 1, glow = 0, ls = 0}) => {
	const tex = useMemo(() => canvasTexture(1024, 128, () => undefined), []);
	redraw(tex, (ctx, w, hh) => {
		ctx.font = `${weight} 88px ${font}`;
		ctx.fillStyle = color;
		ctx.textAlign = align;
		ctx.textBaseline = 'middle';
		if (ls) (ctx as unknown as {letterSpacing: string}).letterSpacing = `${ls}px`;
		const x = align === 'left' ? 8 : align === 'right' ? w - 8 : w / 2;
		ctx.fillText(text, x, hh / 2 + 4);
	});
	const ww = h * 8;
	const off = align === 'left' ? ww / 2 : align === 'right' ? -ww / 2 : 0;
	return <Ink shape={['plane', ww, h]} map={tex} color="#ffffff" position={[position[0] + off, position[1], position[2]]} flat={1} glow={glow} opacity={opacity} opts={{transparent: true, depthWrite: false}} />;
};

// photographer: a grey figure holding a camera to its face (two hands on the body)
export const photographerRig = (t: number, lensAim = 0): {rig: Rig; cam: THREE.Vector3} => {
	const r = idle(t);
	const cam = new THREE.Vector3(0.0, 1.62, 0.16);
	r.handL.set(cam.x + 0.075, cam.y - 0.02, cam.z - 0.02);
	r.handR.set(cam.x - 0.075, cam.y - 0.02, cam.z - 0.02);
	r.elbowL.set(0.5, 1.2, -0.2);
	r.elbowR.set(-0.5, 1.2, -0.2);
	r.gripL = 'hold';
	r.gripR = 'hold';
	r.headPitch = 0.02 + lensAim;
	return {rig: r, cam};
};

export const Photographer: React.FC<{f: Fig; t: number; lens?: number; flat?: number; color?: string; scale?: number}> = ({f, t, lens = 0, flat, color = '#8b97a5', scale = 1}) => {
	const {rig, cam} = photographerRig(t);
	return (
		<group position={f.pos} rotation={[0, f.yaw, 0]} scale={scale}>
			<Stickman rig={rig} color={color} flat={flat} />
			<CameraProp p={cam} lens={lens} flat={flat} />
		</group>
	);
};

// a thin bar between two points in a plane (measuring lines, sight lines)
export const Bar: React.FC<{a: [number, number, number]; b: [number, number, number]; w: number; color: string; glow?: number; dashed?: number; flat?: number}> = ({a, b, w, color, glow = 0, dashed = 0, flat = 1}) => {
	const A = new THREE.Vector3(...a);
	const B = new THREE.Vector3(...b);
	const d = B.clone().sub(A);
	const len = d.length();
	if (len < 1e-4) return null;
	const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
	if (!dashed) {
		return <Ink shape={['box', 1, 1, 1]} scale={[len, w, w * 0.2]} position={A.clone().add(B).multiplyScalar(0.5)} quaternion={q} color={color} flat={flat} glow={glow} />;
	}
	const n = Math.max(1, Math.floor(len / dashed));
	return (
		<group position={A} quaternion={q}>
			{Array.from({length: n}).map((_, i) => (
				<Ink key={i} shape={['box', 1, 1, 1]} scale={[dashed * 0.55, w, w * 0.2]} position={[(i + 0.3) * dashed, 0, 0]} color={color} flat={flat} glow={glow} />
			))}
		</group>
	);
};

export const restRig = (t: number) => idle(t);
export const neutral = basePose;
