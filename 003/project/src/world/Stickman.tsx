import React, {useMemo} from 'react';
import * as THREE from 'three';
import {COLORS, makeInk, makeOutline, setFlat} from './materials';
import {DIM, Joints, Rig, solveRig} from './rig';
import {useMode} from './mode';

const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
const UNIT_SPH = new THREE.SphereGeometry(1, 24, 16);
const HEAD_SPH = new THREE.SphereGeometry(1, 40, 28);
const HALF_DISC = new THREE.CircleGeometry(1, 28, Math.PI, Math.PI);
const DISC = new THREE.CircleGeometry(1, 24);
const SMILE = new THREE.TorusGeometry(1, 0.17, 8, 24, Math.PI * 0.82);
const Y = new THREE.Vector3(0, 1, 0);

type Seg = {a: THREE.Vector3; b: THREE.Vector3; r: number};

const segPose = (s: Seg) => {
	const d = s.b.clone().sub(s.a);
	const len = Math.max(1e-4, d.length());
	const q = new THREE.Quaternion().setFromUnitVectors(Y, d.divideScalar(len));
	const p = s.a.clone().add(s.b).multiplyScalar(0.5);
	return {p, q, len};
};

export type StickmanProps = {
	rig: Rig;
	position?: [number, number, number];
	yaw?: number;
	scale?: number;
	flat?: number; // overrides the scene mode for this figure
	scarf?: number; // 0..1 how much of the scarf exists
	glow?: number;
	shadows?: boolean;
	color?: string;
	outline?: number;
	visible?: boolean;
	hideHead?: boolean; // point of view shots: the camera is the head
};

export const Stickman: React.FC<StickmanProps> = ({
	rig,
	position = [0, 0, 0],
	yaw = 0,
	scale = 1,
	flat,
	scarf = 0,
	glow = 0,
	shadows = true,
	color = COLORS.white,
	outline,
	visible = true,
	hideHead = false,
}) => {
	const mode = useMode();
	const mats = useMemo(
		() => ({
			body: makeInk(color, {rim: 0.28, rimColor: '#a9c7dc'}),
			face: makeInk('#0b0e12', {rim: 0}),
			scarfA: makeInk('#FFA21A', {rim: 0.3, rimColor: '#ffd28a'}),
			scarfB: makeInk('#c96a0e', {rim: 0.2}),
			line: makeOutline(2.2),
		}),
		[color],
	);
	const f = flat ?? mode.flat;
	setFlat(mats.body, f, glow);
	setFlat(mats.face, f);
	setFlat(mats.scarfA, f, glow * 0.5);
	setFlat(mats.scarfB, f, glow * 0.5);
	(mats.line.uniforms.uWidth as {value: number}).value = (outline ?? mode.outline) * (mode.res.y / 720);
	(mats.line.uniforms.uRes as {value: THREE.Vector2}).value.copy(mode.res);

	const j: Joints = solveRig(rig);
	const r = DIM.limbR;
	const segs: Seg[] = [
		{a: j.pelvis, b: j.neck, r},
		{a: j.shoulder, b: j.elbowL, r},
		{a: j.elbowL, b: j.handL, r},
		{a: j.shoulder, b: j.elbowR, r},
		{a: j.elbowR, b: j.handR, r},
		{a: j.pelvis, b: j.kneeL, r},
		{a: j.kneeL, b: j.footL, r},
		{a: j.pelvis, b: j.kneeR, r},
		{a: j.kneeR, b: j.footR, r},
		{a: j.footL, b: j.toeL, r},
		{a: j.footR, b: j.toeR, r},
	];
	const handR = (g: string) => (g === 'fist' ? r * 2.0 : g === 'pinch' ? r * 1.65 : r * 1.55);
	const balls: {p: THREE.Vector3; r: number}[] = [
		{p: j.neck, r},
		{p: j.shoulder, r},
		{p: j.pelvis, r},
		{p: j.elbowL, r},
		{p: j.elbowR, r},
		{p: j.kneeL, r},
		{p: j.kneeR, r},
		{p: j.footL, r},
		{p: j.footR, r},
		{p: j.toeL, r},
		{p: j.toeR, r},
		{p: j.handL, r: handR(rig.gripL)},
		{p: j.handR, r: handR(rig.gripR)},
	];

	// face features live on the head sphere, oriented by the head quaternion
	const hr = DIM.headR;
	const onHead = (yawA: number, pitchA: number, out = 1.0) => {
		const d = new THREE.Vector3(Math.sin(yawA) * Math.cos(pitchA), Math.sin(pitchA), Math.cos(yawA) * Math.cos(pitchA));
		d.applyQuaternion(j.headQ);
		return {p: j.head.clone().add(d.clone().multiplyScalar(hr * out)), d};
	};
	const faceQ = (d: THREE.Vector3) => {
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
		// keep the feature upright relative to the head
		const upW = new THREE.Vector3(0, 1, 0).applyQuaternion(j.headQ);
		const upNow = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
		const ang = Math.atan2(upNow.clone().cross(upW).dot(d), upNow.dot(upW));
		return new THREE.Quaternion().setFromAxisAngle(d, ang).multiply(q);
	};
	const blink = Math.min(1, rig.blink);
	const eyeH = rig.expr === 'laugh' ? 0.25 : rig.expr === 'flinch' ? 0.35 : 1 - blink * 0.88;
	const eyes = [-0.36, 0.36].map((a) => onHead(a, 0.14, 0.985));
	const mouthSpot = onHead(0, rig.expr === 'laugh' ? -0.36 : -0.3, 0.99);
	const mq = faceQ(mouthSpot.d);

	const s = scarf;
	const neckDir = j.neck.clone().sub(j.pelvis).normalize();
	const scarfQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), neckDir);

	return (
		<group position={position} rotation={[0, yaw, 0]} scale={scale} visible={visible}>
			{segs.map((sg, i) => {
				const {p, q, len} = segPose(sg);
				return (
					<group key={i} position={p} quaternion={q}>
						<mesh geometry={UNIT_CYL} material={mats.body} scale={[sg.r, len, sg.r]} castShadow={shadows} />
						<mesh geometry={UNIT_CYL} material={mats.line} scale={[sg.r, len, sg.r]} />
					</group>
				);
			})}
			{balls.map((b, i) => (
				<group key={i} position={b.p}>
					<mesh geometry={UNIT_SPH} material={mats.body} scale={b.r} castShadow={shadows} />
					<mesh geometry={UNIT_SPH} material={mats.line} scale={b.r} />
				</group>
			))}
			<group position={j.head} quaternion={j.headQ} visible={!hideHead}>
				<mesh geometry={HEAD_SPH} material={mats.body} scale={hr} castShadow={shadows} />
				<mesh geometry={HEAD_SPH} material={mats.line} scale={hr} />
			</group>
			{hideHead ? null : eyes.map((e, i) => (
				<mesh
					key={i}
					geometry={UNIT_SPH}
					material={mats.face}
					position={e.p}
					quaternion={faceQ(e.d)}
					scale={[0.0185, 0.0185 * Math.max(0.12, eyeH), 0.006]}
				/>
			))}
			{hideHead ? null : rig.expr === 'laugh' ? (
				<mesh
					geometry={HALF_DISC}
					material={mats.face}
					position={mouthSpot.p.clone().add(mouthSpot.d.clone().multiplyScalar(0.004))}
					quaternion={mq}
					scale={[0.05 + 0.012 * rig.mouth, 0.026 + 0.03 * rig.mouth, 1]}
				/>
			) : rig.expr === 'smile' ? (
				<mesh
					geometry={SMILE}
					material={mats.face}
					position={mouthSpot.p.clone().add(mouthSpot.d.clone().multiplyScalar(0.004)).add(new THREE.Vector3(0, 0.022, 0).applyQuaternion(j.headQ))}
					quaternion={mq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI + Math.PI * 0.09)))}
					scale={[0.036 + 0.01 * rig.mouth, 0.03 + 0.008 * rig.mouth, 0.03]}
				/>
			) : rig.expr === 'o' ? (
				<mesh geometry={DISC} material={mats.face} position={mouthSpot.p.clone().add(mouthSpot.d.clone().multiplyScalar(0.004))} quaternion={mq} scale={[0.017, 0.022, 1]} />
			) : (
				<mesh
					geometry={UNIT_SPH}
					material={mats.face}
					position={mouthSpot.p}
					quaternion={mq}
					scale={[rig.expr === 'flinch' ? 0.03 : 0.036, 0.0055, 0.006]}
				/>
			)}
			{s > 0 ? (
				<group position={j.neck.clone().sub(neckDir.clone().multiplyScalar(0.035))} quaternion={scarfQ}>
					<mesh scale={[1, 1, 1]} material={mats.scarfA} castShadow={shadows}>
						<torusGeometry args={[0.042, 0.02, 10, 28, Math.PI * 2 * Math.min(1, s * 1.4)]} />
					</mesh>
					{s > 0.6 ? (
						<group rotation={[0, 0, 0]}>
							<mesh position={[0.03, -0.03, -0.085 * (s - 0.6) * 2.5]} rotation={[Math.PI / 2 - 0.15, 0, 0.12]} material={mats.scarfA} castShadow={shadows}>
								<boxGeometry args={[0.04, 0.17 * (s - 0.6) * 2.5, 0.012]} />
							</mesh>
							<mesh position={[0.03, -0.031, -0.06 * (s - 0.6) * 2.5]} rotation={[Math.PI / 2 - 0.15, 0, 0.12]} material={mats.scarfB}>
								<boxGeometry args={[0.042, 0.012, 0.014]} />
							</mesh>
						</group>
					) : null}
				</group>
			) : null}
		</group>
	);
};
