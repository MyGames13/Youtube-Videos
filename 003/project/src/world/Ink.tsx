import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {InkOpts, makeInk, makeOutline, setFlat} from './materials';
import {useMode} from './mode';

// Shape descriptors so the outline hull can reuse the exact same geometry.
export type Shape =
	| ['box', number, number, number]
	| ['rbox', number, number, number, number]
	| ['sphere', number]
	| ['cyl', number, number, number, number?]
	| ['plane', number, number]
	| ['circle', number, number?]
	| ['torus', number, number, number?]
	| ['capsule', number, number]
	| ['ring', number, number]
	| ['cone', number, number];

const cache = new Map<string, THREE.BufferGeometry>();

export const geom = (s: Shape): THREE.BufferGeometry => {
	const k = JSON.stringify(s);
	const hit = cache.get(k);
	if (hit) return hit;
	let g: THREE.BufferGeometry;
	switch (s[0]) {
		case 'box':
			g = new THREE.BoxGeometry(s[1], s[2], s[3]);
			break;
		case 'rbox':
			g = new RoundedBoxGeometry(s[1], s[2], s[3], 3, s[4]);
			break;
		case 'sphere':
			g = new THREE.SphereGeometry(s[1], 32, 20);
			break;
		case 'cyl':
			g = new THREE.CylinderGeometry(s[1], s[2], s[3], s[4] ?? 28);
			break;
		case 'plane':
			g = new THREE.PlaneGeometry(s[1], s[2]);
			break;
		case 'circle':
			g = new THREE.CircleGeometry(s[1], s[2] ?? 40);
			break;
		case 'torus':
			g = new THREE.TorusGeometry(s[1], s[2], 12, 40, s[3] ?? Math.PI * 2);
			break;
		case 'capsule':
			g = new THREE.CapsuleGeometry(s[1], s[2], 6, 14);
			break;
		case 'ring':
			g = new THREE.RingGeometry(s[1], s[2], 48);
			break;
		case 'cone':
			g = new THREE.ConeGeometry(s[1], s[2], 28);
			break;
		default:
			throw new Error('shape');
	}
	cache.set(k, g);
	return g;
};

export type InkProps = {
	shape?: Shape;
	geometry?: THREE.BufferGeometry;
	color?: string;
	opts?: InkOpts;
	outline?: boolean | number;
	position?: [number, number, number] | THREE.Vector3;
	rotation?: [number, number, number] | THREE.Euler;
	quaternion?: THREE.Quaternion;
	scale?: number | [number, number, number];
	cast?: boolean;
	receive?: boolean;
	flat?: number;
	glow?: number;
	visible?: boolean;
	renderOrder?: number;
	map?: THREE.Texture | null;
	opacity?: number;
	children?: React.ReactNode;
	emissive?: string;
	emissiveIntensity?: number;
};

export const useInk = (color: string, opts: InkOpts = {}) => {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	return useMemo(() => makeInk(color, opts), [color, opts.map, opts.transparent, opts.side, opts.smooth, opts.emissive]);
};

export const Ink: React.FC<InkProps> = ({
	shape,
	geometry,
	color = '#F4F6F8',
	opts,
	outline,
	position,
	rotation,
	quaternion,
	scale,
	cast = false,
	receive = false,
	flat,
	glow = 0,
	visible = true,
	renderOrder,
	map,
	opacity,
	children,
	emissive,
	emissiveIntensity,
}) => {
	const mode = useMode();
	const g = geometry ?? geom(shape!);
	const mat = useMemo(
		() =>
			makeInk(color, {
				...(opts ?? {}),
				map: map ?? opts?.map ?? null,
				transparent: opts?.transparent ?? opacity !== undefined,
				emissive,
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[color, map, opts?.transparent, opts?.side, opts?.smooth, opacity !== undefined, emissive],
	);
	setFlat(mat, flat ?? mode.flat, glow);
	if (opacity !== undefined) mat.opacity = opacity;
	if (emissiveIntensity !== undefined) mat.emissiveIntensity = emissiveIntensity;
	const line = useMemo(() => (outline ? makeOutline() : null), [outline]);
	if (line) {
		const w = typeof outline === 'number' ? outline : mode.outline;
		(line.uniforms.uWidth as {value: number}).value = w * (mode.res.y / 720);
		(line.uniforms.uRes as {value: THREE.Vector2}).value.copy(mode.res);
		if (opacity !== undefined) {
			line.transparent = true;
			(line.uniforms.uOpacity as {value: number}).value = opacity;
		}
	}
	return (
		<group position={position as never} rotation={rotation as never} quaternion={quaternion} scale={scale as never} visible={visible}>
			<mesh geometry={g} material={mat} castShadow={cast} receiveShadow={receive} renderOrder={renderOrder} />
			{line ? <mesh geometry={g} material={line} renderOrder={renderOrder} /> : null}
			{children}
		</group>
	);
};

// Additive glow sprite for lamps and the photograph (bloom friendly).
export const Glow: React.FC<{
	position: [number, number, number];
	size: number;
	color: string;
	intensity?: number;
	tex: THREE.Texture;
}> = ({position, size, color, intensity = 1, tex}) => {
	const mat = useMemo(
		() =>
			new THREE.SpriteMaterial({
				map: tex,
				color: new THREE.Color(color),
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				transparent: true,
			}),
		[tex, color],
	);
	mat.opacity = Math.max(0, intensity);
	return <sprite material={mat} position={position} scale={[size, size, 1]} />;
};
