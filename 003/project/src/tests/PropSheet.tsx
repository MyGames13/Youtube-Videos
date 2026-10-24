import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useCurrentFrame} from 'remotion';
import {Stage} from '../world/Stage';
import {defaultFx} from '../post/PostFX';
import {CamSpec} from '../world/mode';
import {Stickman} from '../world/Stickman';
import {Ink} from '../world/Ink';
import {PhotoCard, Spot, RenderToTexture, useRenderTarget} from '../world/Photo';
import {PHOTO_CAM, PhotoWorld} from '../world/PhotoWorld';
import {
	drawHandwriting,
	drinkMug,
	Key,
	keyInLock,
	lookAtPhoto,
	Mug,
	Pen,
	Phone,
	phoneUse,
	PhotoBackOnly,
	Pin,
	pinToWall,
	pullDrawer,
	Thumb,
	turnOver,
	useHandwritingTex,
	writeAt,
} from '../world/props';

const ACTIONS = ['photo_hold', 'photo_turn', 'mug', 'phone', 'pin', 'pen', 'key', 'drawer'] as const;

export const PropSheet: React.FC = () => {
	const f = useCurrentFrame();
	const action = ACTIONS[Math.floor(f / 3)] ?? 'photo_hold';
	const p = (f % 3) / 2;
	const t = 1 + p * 1.3;
	const rt = useRenderTarget();
	const hw = useHandwritingTex();
	let world: React.ReactNode = null;
	let cam: CamSpec = {target: [0, 1.15, 0.2], yaw: -0.65, pitch: 0.12, frameH: 0.95, fov3d: 34};
	const wallZ = 0.44;
	if (action === 'photo_hold') {
		const a = lookAtPhoto(t, {away: p === 0.5 ? 1 : 0});
		cam = {target: [0, 1.22, 0.24], yaw: Math.PI - 0.6, pitch: 0.5, frameH: 0.75, fov3d: 34};
		world = (
			<>
				<Stickman rig={a.rig} />
				<PhotoCard map={rt.texture} position={a.card.p} quaternion={a.card.q} />
			</>
		);
	} else if (action === 'photo_turn') {
		const a = turnOver(t, p);
		cam = {target: [0, 1.22, 0.24], yaw: Math.PI - 0.6, pitch: 0.5, frameH: 0.75, fov3d: 34};
		world = (
			<>
				<Stickman rig={a.rig} />
				<PhotoCard map={rt.texture} position={a.card.p} quaternion={a.card.q} />
			</>
		);
	} else if (action === 'mug') {
		const a = drinkMug(t, p);
		cam = {target: [-0.05, 1.42, 0.15], yaw: -0.9, pitch: 0.08, frameH: 0.65, fov3d: 34};
		world = (
			<>
				<Stickman rig={a.rig} />
				<Mug x={a.mug} />
			</>
		);
	} else if (action === 'phone') {
		const a = phoneUse(t + p * 0.45, 1);
		cam = {target: [-0.05, 1.32, 0.2], yaw: -2.44, pitch: 0.45, frameH: 0.55, fov3d: 34};
		world = (
			<>
				<Stickman rig={a.rig} />
				<Phone x={a.phone} />
				<Thumb a={a.thumb[0]} b={a.thumb[1]} />
			</>
		);
	} else if (action === 'pin') {
		const a = pinToWall(t, 0.2 + p * 0.6, wallZ, 0.0, 1.5);
		cam = {target: [0, 1.42, 0.3], yaw: Math.PI / 2 + 0.45, pitch: 0.12, frameH: 0.9, fov3d: 34};
		world = (
			<>
				<Ink shape={['plane', 3, 3]} color="#34404e" position={[0, 1.5, wallZ]} rotation={[0, Math.PI, 0]} receive />
				<Stickman rig={a.rig} />
				<PhotoCard map={rt.texture} position={a.card.p} quaternion={a.card.q} />
				{p > 0.3 ? <Pin p={a.pin} /> : null}
			</>
		);
	} else if (action === 'pen') {
		const paper = new THREE.Vector3(0, 0.92, 0.36);
		const a = writeAt(t, p * 0.9 + 0.05, paper, 0.16);
		drawHandwriting(hw, p);
		cam = {target: [0, 1.1, 0.25], yaw: -0.7, pitch: 0.55, frameH: 0.85, fov3d: 34};
		world = (
			<>
				<Ink shape={['box', 0.8, 0.04, 0.5]} color="#2b3440" position={[0, 0.9, 0.42]} receive cast outline />
				<PhotoBackOnly x={{p: new THREE.Vector3(0, 0.922, 0.36), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))}} tex={hw} />
				<Stickman rig={a.rig} />
				<Pen x={a.pen} />
			</>
		);
	} else if (action === 'key') {
		const lock = new THREE.Vector3(-0.2, 1.0, 0.4);
		const a = keyInLock(t, 0.15 + p * 0.75, lock, new THREE.Vector3(0, 0, -1));
		cam = {target: [-0.2, 0.98, 0.37], yaw: -2.2, pitch: 0.15, frameH: 0.26, fov3d: 34};
		world = (
			<>
				<Ink shape={['box', 1.0, 2.0, 0.05]} color="#26303b" position={[-0.2, 1.0, 0.43]} receive outline />
				<Ink shape={['cyl', 0.018, 0.018, 0.02, 16]} color="#8b97a5" position={[lock.x, lock.y, 0.4]} rotation={[Math.PI / 2, 0, 0]} outline />
				<Stickman rig={a.rig} />
				<Key x={a.key} />
			</>
		);
	} else if (action === 'drawer') {
		const handle = new THREE.Vector3(-0.1, 0.74, 0.38);
		const a = pullDrawer(t, p, handle, 0.22);
		cam = {target: [-0.08, 0.95, 0.25], yaw: -1.9, pitch: 0.3, frameH: 1.1, fov3d: 34};
		world = (
			<>
				<Ink shape={['box', 0.9, 0.86, 0.45]} color="#222a34" position={[0, 0.43, 0.62]} receive cast outline />
				<group position={[0, 0, -a.open]}>
					<Ink shape={['box', 0.5, 0.14, 0.42]} color="#2b3440" position={[-0.1, 0.74, 0.605]} outline cast />
					<Ink shape={['rbox', 0.12, 0.025, 0.03, 0.01]} color="#a7b2bf" position={[handle.x, handle.y, 0.38]} outline />
				</group>
				<Stickman rig={a.rig} />
			</>
		);
	}
	const fx = {...defaultFx(f), grain: 0, scan: 0};
	return (
		<div style={{width: '100%', height: '100%', background: '#06080B'}}>
			<Stage cam={cam} m={1} fx={fx}>
				<RenderToTexture rt={rt} cam={PHOTO_CAM} m={0}>
					<PhotoWorld s={{expr: 'blank', laugh: 0, scarf: 0, hand: 0, friend: 0, t: 0, frozen: true}} />
				</RenderToTexture>
				<Ink shape={['plane', 12, 12]} color="#1c232b" rotation={[-Math.PI / 2, 0, 0]} receive />
				<Spot position={[1.2, 2.6, 2.0]} target={[0, 1.0, 0.2]} intensity={14} angle={0.7} penumbra={0.8} decay={1.4} color="#ffd2a0" />
				<ambientLight intensity={0.9} color="#8496ad" />
				<hemisphereLight args={['#6d84a3', '#1a1f27', 0.8]} />
				{world}
			</Stage>
			<div style={{position: 'absolute', left: 20, bottom: 16, fontFamily: 'JetBrains Mono', color: '#9aa6b4', fontSize: 22}}>
				{action} {p.toFixed(1)}
			</div>
		</div>
	);
};
