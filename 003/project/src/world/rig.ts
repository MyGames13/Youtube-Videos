import * as THREE from 'three';

// Stickman skeleton. Figure space: origin on the ground between the feet, +y up,
// the figure faces +z, its left hand side is +x. Proportions follow the brief:
// total height H, head diameter H/6, torso 0.30H, arm 0.17H + 0.17H, leg 0.26H + 0.26H.

export const H = 1.8;
export const DIM = {
	headR: H / 12,
	torso: 0.3 * H,
	upper: 0.17 * H,
	fore: 0.17 * H,
	thigh: 0.26 * H,
	shin: 0.26 * H,
	limbR: 0.021,
	shoulderDrop: 0.06, // arms leave the spine a little below the neck
	foot: 0.085,
};

export type Expr = 'blank' | 'smile' | 'laugh' | 'flinch' | 'o' | 'closed';
export type Grip = 'open' | 'pinch' | 'fist' | 'hold';

export type Rig = {
	pelvis: THREE.Vector3; // pelvis point (legs meet), figure space
	lean: number; // spine pitch, + forward (rad)
	side: number; // spine roll, + toward figure left (rad)
	twist: number; // spine yaw (rad)
	headPitch: number; // + looks down
	headYaw: number; // + turns to figure left
	headRoll: number;
	handL: THREE.Vector3;
	handR: THREE.Vector3;
	elbowL: THREE.Vector3; // pole hints
	elbowR: THREE.Vector3;
	footL: THREE.Vector3;
	footR: THREE.Vector3;
	kneeL: THREE.Vector3;
	kneeR: THREE.Vector3;
	footYawL: number;
	footYawR: number;
	gripL: Grip;
	gripR: Grip;
	expr: Expr;
	mouth: number; // 0..1 how open or wide the expression is
	blink: number; // 0 open, 1 closed
	shrug: number; // shoulder lift (m)
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const STAND_PELVIS = DIM.thigh + DIM.shin - 0.004;

export const basePose = (): Rig => ({
	pelvis: v(0, STAND_PELVIS, 0),
	lean: 0.02,
	side: 0,
	twist: 0,
	headPitch: 0.04,
	headYaw: 0,
	headRoll: 0,
	handL: v(0.2, 0.86, 0.03),
	handR: v(-0.2, 0.86, 0.03),
	elbowL: v(0.5, 1.2, -0.6),
	elbowR: v(-0.5, 1.2, -0.6),
	footL: v(0.11, 0, 0),
	footR: v(-0.11, 0, 0),
	kneeL: v(0.14, 0.5, 1.0),
	kneeR: v(-0.14, 0.5, 1.0),
	footYawL: 0.12,
	footYawR: -0.12,
	gripL: 'open',
	gripR: 'open',
	expr: 'blank',
	mouth: 0.5,
	blink: 0,
	shrug: 0,
});

export const cloneRig = (r: Rig): Rig => ({
	...r,
	pelvis: r.pelvis.clone(),
	handL: r.handL.clone(),
	handR: r.handR.clone(),
	elbowL: r.elbowL.clone(),
	elbowR: r.elbowR.clone(),
	footL: r.footL.clone(),
	footR: r.footR.clone(),
	kneeL: r.kneeL.clone(),
	kneeR: r.kneeR.clone(),
});

const VEC_KEYS = ['pelvis', 'handL', 'handR', 'elbowL', 'elbowR', 'footL', 'footR', 'kneeL', 'kneeR'] as const;
const NUM_KEYS = ['lean', 'side', 'twist', 'headPitch', 'headYaw', 'headRoll', 'footYawL', 'footYawR', 'mouth', 'blink', 'shrug'] as const;

export const mixRig = (a: Rig, b: Rig, t: number): Rig => {
	const o = cloneRig(a);
	for (const k of VEC_KEYS) o[k].lerpVectors(a[k], b[k], t);
	for (const k of NUM_KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
	o.gripL = t < 0.5 ? a.gripL : b.gripL;
	o.gripR = t < 0.5 ? a.gripR : b.gripR;
	o.expr = t < 0.5 ? a.expr : b.expr;
	return o;
};

// Analytic two bone IK with a pole hint.
export const solve2 = (root: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3) => {
	const toT = target.clone().sub(root);
	let d = toT.length();
	const dir = d > 1e-6 ? toT.clone().divideScalar(d) : v(0, -1, 0);
	d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
	const a = (l1 * l1 + d * d - l2 * l2) / (2 * d);
	const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
	const toP = pole.clone().sub(root);
	const perp = toP.sub(dir.clone().multiplyScalar(toP.dot(dir)));
	if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
	perp.normalize();
	const mid = root.clone().add(dir.clone().multiplyScalar(a)).add(perp.multiplyScalar(h));
	const end = root.clone().add(dir.multiplyScalar(d));
	return {mid, end};
};

export type Joints = {
	pelvis: THREE.Vector3;
	neck: THREE.Vector3;
	shoulder: THREE.Vector3;
	head: THREE.Vector3;
	headQ: THREE.Quaternion;
	elbowL: THREE.Vector3;
	elbowR: THREE.Vector3;
	handL: THREE.Vector3;
	handR: THREE.Vector3;
	kneeL: THREE.Vector3;
	kneeR: THREE.Vector3;
	footL: THREE.Vector3;
	footR: THREE.Vector3;
	toeL: THREE.Vector3;
	toeR: THREE.Vector3;
	spineQ: THREE.Quaternion;
};

export const solveRig = (r: Rig): Joints => {
	const spineQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.lean, r.twist, -r.side, 'YXZ'));
	const up = v(0, 1, 0).applyQuaternion(spineQ);
	const pelvis = r.pelvis.clone();
	const neck = pelvis.clone().add(up.clone().multiplyScalar(DIM.torso));
	const shoulder = neck
		.clone()
		.sub(up.clone().multiplyScalar(DIM.shoulderDrop - r.shrug));
	const headQ = spineQ
		.clone()
		.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(r.headPitch, r.headYaw, r.headRoll, 'YXZ')));
	const headUp = v(0, 1, 0).applyQuaternion(headQ);
	const head = neck.clone().add(headUp.multiplyScalar(DIM.headR + 0.012));
	const armL = solve2(shoulder, r.handL, DIM.upper, DIM.fore, r.elbowL);
	const armR = solve2(shoulder, r.handR, DIM.upper, DIM.fore, r.elbowR);
	const legL = solve2(pelvis, r.footL, DIM.thigh, DIM.shin, r.kneeL);
	const legR = solve2(pelvis, r.footR, DIM.thigh, DIM.shin, r.kneeR);
	const toe = (foot: THREE.Vector3, yaw: number) =>
		foot.clone().add(v(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(DIM.foot));
	return {
		pelvis,
		neck,
		shoulder,
		head,
		headQ,
		elbowL: armL.mid,
		elbowR: armR.mid,
		handL: armL.end,
		handR: armR.end,
		kneeL: legL.mid,
		kneeR: legR.mid,
		footL: legL.end,
		footR: legR.end,
		toeL: toe(legL.end, r.footYawL),
		toeR: toe(legR.end, r.footYawR),
		spineQ,
	};
};

// ---------- pose library ----------
// All poses are pure functions of time in seconds and parameters.

const breath = (t: number) => Math.sin(t * 2 * Math.PI * 0.23);

export const idle = (t: number, amt = 1): Rig => {
	const r = basePose();
	const b = breath(t) * amt;
	r.shrug = 0.006 * b;
	r.lean = 0.02 + 0.008 * b;
	r.headPitch = 0.04 - 0.012 * b;
	r.handL.y += 0.004 * b;
	r.handR.y += 0.004 * b;
	r.pelvis.x = 0.004 * Math.sin(t * 0.7);
	r.blink = blinkAt(t);
	return r;
};

// natural blinking every few seconds, deterministic
export const blinkAt = (t: number) => {
	const period = 3.7;
	const ph = (t + 1.3) % period;
	return ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0;
};

export const walk = (t: number, speed = 1.0, stride = 0.32): Rig => {
	const r = basePose();
	const ph = t * speed * 1.7 * Math.PI * 2; // steps per second about 1.7
	const s = Math.sin(ph);
	const c = Math.cos(ph);
	const lift = (x: number) => Math.max(0, x) * 0.09;
	r.footL.set(0.1, lift(Math.sin(ph + Math.PI / 2)), (stride / 2) * s);
	r.footR.set(-0.1, lift(Math.sin(ph - Math.PI / 2)), (-stride / 2) * s);
	r.pelvis.y = STAND_PELVIS - 0.035 + 0.02 * Math.abs(c);
	r.pelvis.z = 0.02;
	r.lean = 0.06;
	r.twist = 0.08 * s;
	r.handL.set(0.21, 0.88, -0.16 * s + 0.03);
	r.handR.set(-0.21, 0.88, 0.16 * s + 0.03);
	r.elbowL.set(0.4, 1.2, -1);
	r.elbowR.set(-0.4, 1.2, -1);
	r.headPitch = 0.02;
	r.blink = blinkAt(t);
	return r;
};

export const sit = (t: number, seatH = 0.5): Rig => {
	const r = idle(t, 0.6);
	r.pelvis.set(0, seatH, -0.05);
	r.footL.set(0.13, 0, 0.42);
	r.footR.set(-0.13, 0, 0.42);
	r.kneeL.set(0.16, 1.2, 2);
	r.kneeR.set(-0.16, 1.2, 2);
	r.lean = 0.05;
	r.handL.set(0.17, seatH + 0.02, 0.25);
	r.handR.set(-0.17, seatH + 0.02, 0.25);
	r.elbowL.set(0.5, 0.8, -0.4);
	r.elbowR.set(-0.5, 0.8, -0.4);
	return r;
};

// both hands pinch the bottom corners of a card held at a given figure space spot
export const holdCard = (t: number, center: THREE.Vector3, w: number, h: number, base?: Rig): Rig => {
	const r = base ? cloneRig(base) : idle(t);
	r.handL.set(center.x + w / 2 - 0.01, center.y - h / 2 + 0.012, center.z);
	r.handR.set(center.x - w / 2 + 0.01, center.y - h / 2 + 0.012, center.z);
	r.elbowL.set(0.7, 0.6, -0.2);
	r.elbowR.set(-0.7, 0.6, -0.2);
	r.gripL = 'pinch';
	r.gripR = 'pinch';
	return r;
};

export const laugh = (t: number, k = 1): Rig => {
	const r = idle(t);
	const bounce = Math.abs(Math.sin(t * Math.PI * 4.2)) * k;
	r.headPitch = -0.32 * k + 0.05 * bounce;
	r.lean = -0.06 * k;
	r.shrug = 0.025 * bounce;
	r.pelvis.y -= 0.006 * bounce;
	r.expr = 'laugh';
	r.mouth = 0.6 + 0.4 * k;
	r.blink = 0.85 * k;
	return r;
};

export const look = (r: Rig, pitch: number, yaw = 0): Rig => {
	const o = cloneRig(r);
	o.headPitch = pitch;
	o.headYaw = yaw;
	return o;
};
