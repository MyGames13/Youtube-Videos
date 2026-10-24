import React, {useMemo} from 'react';
import * as THREE from 'three';
import {COLORS, makeInk, makeOutline, setFlat} from './materials';
import {useMode} from './mode';
import {DIM, Grip, solve2} from './rig';
import {Ink} from './Ink';

// An arm that enters from the frame edge (no body): same stroke, same outline,
// same two bone IK as the stickman.
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
const SPH = new THREE.SphereGeometry(1, 24, 16);
const Y = new THREE.Vector3(0, 1, 0);

export const Arm: React.FC<{
	root: THREE.Vector3;
	target: THREE.Vector3;
	pole: THREE.Vector3;
	grip?: Grip;
	flat?: number;
	color?: string;
	upper?: number;
	fore?: number;
}> = ({root, target, pole, grip = 'open', flat, color = COLORS.white, upper = DIM.upper, fore = DIM.fore}) => {
	const mode = useMode();
	const mats = useMemo(() => ({body: makeInk(color, {rim: 0.28, rimColor: '#a9c7dc'}), line: makeOutline(2.2)}), [color]);
	setFlat(mats.body, flat ?? mode.flat);
	(mats.line.uniforms.uWidth as {value: number}).value = mode.outline * (mode.res.y / 720);
	(mats.line.uniforms.uRes as {value: THREE.Vector2}).value.copy(mode.res);
	const {mid, end} = solve2(root, target, upper, fore, pole);
	const r = DIM.limbR;
	const segs = [
		[root, mid],
		[mid, end],
	];
	const hr = grip === 'fist' ? r * 2 : grip === 'pinch' ? r * 1.65 : r * 1.55;
	return (
		<group>
			{segs.map(([a, b], i) => {
				const d = b.clone().sub(a);
				const len = d.length();
				const q = new THREE.Quaternion().setFromUnitVectors(Y, d.normalize());
				const p = a.clone().add(b).multiplyScalar(0.5);
				return (
					<group key={i} position={p} quaternion={q}>
						<mesh geometry={CYL} material={mats.body} scale={[r, len, r]} castShadow />
						<mesh geometry={CYL} material={mats.line} scale={[r, len, r]} />
					</group>
				);
			})}
			{[
				[mid, r],
				[end, hr],
			].map(([p, rr], i) => (
				<group key={i} position={p as THREE.Vector3}>
					<mesh geometry={SPH} material={mats.body} scale={rr as number} castShadow />
					<mesh geometry={SPH} material={mats.line} scale={rr as number} />
				</group>
			))}
		</group>
	);
};

// A compact camera for the photographer figure, with a telescoping zoom lens.
export const CameraProp: React.FC<{p: THREE.Vector3; q?: THREE.Quaternion; lens?: number; flat?: number; scale?: number}> = ({p, q, lens = 0, flat, scale = 1}) => {
	const segs = Math.max(0, lens);
	const n = Math.ceil(segs / 0.9);
	return (
		<group position={p} quaternion={q} scale={scale}>
			<Ink shape={['rbox', 0.13, 0.085, 0.06, 0.012]} color="#2a313b" outline flat={flat} />
			<Ink shape={['rbox', 0.04, 0.025, 0.03, 0.006]} color="#2a313b" position={[-0.035, 0.05, 0]} outline flat={flat} />
			<Ink shape={['cyl', 0.03, 0.03, 0.06, 20]} color="#3a434f" position={[0.02, 0, 0.055]} rotation={[Math.PI / 2, 0, 0]} outline flat={flat} />
			{Array.from({length: n}).map((_, i) => {
				const len = Math.min(0.9, segs - i * 0.9);
				const rr = 0.028 - Math.min(0.012, i * 0.0006);
				return (
					<group key={i}>
						<Ink shape={['cyl', rr, rr, len, 16]} color={i % 2 ? '#3a434f' : '#4a5361'} position={[0.02, 0, 0.085 + i * 0.9 + len / 2]} rotation={[Math.PI / 2, 0, 0]} outline flat={flat} />
						<Ink shape={['cyl', rr + 0.004, rr + 0.004, 0.012, 16]} color="#c9d1da" position={[0.02, 0, 0.085 + i * 0.9 + len]} rotation={[Math.PI / 2, 0, 0]} flat={flat} />
					</group>
				);
			})}
			<Ink shape={['circle', 0.022]} color="#5CF2E6" position={[0.02, 0, 0.087 + segs + (n ? 0.004 : 0.03)]} flat={1} glow={0.8} />
		</group>
	);
};
