import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Ink} from './Ink';
import {COLORS} from './materials';
import {CARD_H, CARD_W} from './Photo';
import {cloneRig, DIM, idle, Rig} from './rig';
import {canvasTexture, redraw, roundRect} from './textures';

// Props with grip sockets, and actions: pure functions of time returning the pose
// AND the prop transform, so a hand and its prop can never disagree.

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sm = (x: number) => {
	const t = clamp01(x);
	return t * t * (3 - 2 * t);
};
const seg = (t: number, a: number, b: number) => sm((t - a) / (b - a));

export type Xf = {p: THREE.Vector3; q: THREE.Quaternion};
const xf = (p: THREE.Vector3, e: THREE.Euler) => ({p, q: new THREE.Quaternion().setFromEuler(e)});
const local = (x: Xf, v: THREE.Vector3) => v.clone().applyQuaternion(x.q).add(x.p);

// ---------- photo: pinch the bottom corners, turn over with a wrist pivot ----------
export const photoCorners = (card: Xf) => ({
	bl: local(card, v3(-CARD_W / 2 + 0.012, -CARD_H / 2 + 0.006, 0)),
	br: local(card, v3(CARD_W / 2 - 0.012, -CARD_H / 2 + 0.006, 0)),
	rm: local(card, v3(CARD_W / 2 - 0.006, 0, 0)),
	lm: local(card, v3(-CARD_W / 2 + 0.006, 0, 0)),
	top: local(card, v3(0, CARD_H / 2 - 0.008, 0)),
	tl: local(card, v3(-CARD_W / 2 + 0.01, CARD_H / 2 - 0.01, 0)),
});

// The image faces the figure's eyes: card turned around (y = PI) and tilted back.
export const lookAtPhoto = (t: number, opts: {lift?: number; tilt?: number; dist?: number; away?: number; base?: Rig} = {}): {rig: Rig; card: Xf} => {
	const r = opts.base ? cloneRig(opts.base) : idle(t);
	const lift = opts.lift ?? 0;
	const tilt = opts.tilt ?? 0.95; // image tilted back toward the eyes
	const dist = opts.dist ?? 0.3;
	const card = xf(v3(0.0, 1.16 + lift, dist), new THREE.Euler(-tilt, Math.PI, 0, 'YXZ'));
	const c = photoCorners(card);
	// photo corners: the figure's left hand takes the corner on its left (+x)
	r.handL.copy(c.bl);
	r.handR.copy(c.br);
	// elbows hang down near the body
	r.elbowL.set(0.32, 0.85, -0.05);
	r.elbowR.set(-0.32, 0.85, -0.05);
	r.gripL = 'pinch';
	r.gripR = 'pinch';
	const away = opts.away ?? 0;
	r.headPitch = 0.58 - 0.45 * away;
	r.headYaw = 0.75 * away;
	return {rig: r, card};
};

// turn over: right hand pinches the right edge, wrist rotates the card about the
// vertical axis through that pinch, left hand lets go and takes it again after
export const turnOver = (t: number, p: number, base?: Rig): {rig: Rig; card: Xf} => {
	const start = lookAtPhoto(t, {base});
	const r = start.rig;
	const pivot = photoCorners(start.card).bl; // figure's left hand side, seen by the figure as right
	const ang = Math.PI * sm(p / 0.7);
	const axis = v3(0, 1, 0).applyQuaternion(start.card.q).normalize();
	const q = new THREE.Quaternion().setFromAxisAngle(axis, ang).multiply(start.card.q);
	const offs = start.card.p.clone().sub(pivot).applyAxisAngle(axis, ang);
	// after the flip the hands bring the card back to the middle
	const back = seg(p, 0.68, 1);
	const swung = pivot.clone().add(offs);
	const card = {p: swung.clone().lerp(start.card.p, back), q};
	const c = photoCorners(card);
	const pivotNow = pivot.clone().add(card.p.clone().sub(swung));
	r.handL.copy(back > 0.5 ? c.br : pivotNow);
	const release = Math.sin(Math.PI * clamp01(p / 0.75));
	const after = p > 0.7 ? c.bl : c.br;
	r.handR.copy(after).add(v3(-0.05 * release, -0.09 * release, 0.02 * release));
	r.gripR = release > 0.4 ? 'open' : 'pinch';
	r.headPitch = 0.6;
	return {rig: r, card};
};

// ---------- phone: one hand, thumb on the glass ----------
export const PHONE = {w: 0.072, h: 0.152, d: 0.009};
export const phoneUse = (t: number, swipe = 1, base?: Rig): {rig: Rig; phone: Xf; thumb: [THREE.Vector3, THREE.Vector3]} => {
	const r = base ? cloneRig(base) : idle(t);
	// screen faces the face: phone turned to face the figure, tilted back
	const phone = xf(v3(-0.06, 1.2, 0.27), new THREE.Euler(-1.05, Math.PI + 0.15, 0, 'YXZ'));
	const grip = local(phone, v3(PHONE.w / 2 - 0.004, -PHONE.h * 0.22, -PHONE.d / 2 - 0.012));
	r.handR.copy(grip);
	r.elbowR.set(-0.5, 0.7, -0.4);
	r.gripR = 'hold';
	r.headPitch = 0.45;
	r.headYaw = 0.12;
	// thumb: from the hand's front to the glass, its tip sweeps up the screen
	const sw = swipe > 0 ? ((t * 1.1) % 1) : 0;
	const lift = sw > 0.75 ? (sw - 0.75) * 4 : 0;
	const tipY = -0.012 + 0.06 * sm(sw / 0.75);
	const tip = local(phone, v3(-PHONE.w * 0.05, tipY, PHONE.d / 2 + 0.004 + 0.012 * lift));
	const base0 = local(phone, v3(PHONE.w / 2 + 0.006, -PHONE.h * 0.18, PHONE.d / 2 - 0.004));
	return {rig: r, phone, thumb: [base0, tip]};
};

export const Phone: React.FC<{x: Xf; screen?: THREE.Texture | null; flat?: number; glow?: number}> = ({x, screen, flat, glow = 0.6}) => (
	<group position={x.p} quaternion={x.q}>
		<Ink shape={['rbox', PHONE.w, PHONE.h, PHONE.d, 0.008]} color="#1d232b" outline cast flat={flat} />
		{screen ? (
			<Ink shape={['plane', PHONE.w - 0.006, PHONE.h - 0.01]} map={screen} color="#ffffff" position={[0, 0, PHONE.d / 2 + 0.0006]} flat={1} glow={glow} />
		) : (
			<Ink shape={['plane', PHONE.w - 0.006, PHONE.h - 0.01]} color="#0d2733" position={[0, 0, PHONE.d / 2 + 0.0006]} flat={1} glow={glow} />
		)}
	</group>
);

export const Thumb: React.FC<{a: THREE.Vector3; b: THREE.Vector3; flat?: number}> = ({a, b, flat}) => {
	const d = b.clone().sub(a);
	const len = d.length();
	const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.clone().normalize());
	return <Ink shape={['capsule', DIM.limbR * 0.72, Math.max(0.001, len)]} position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q} color={COLORS.white} outline flat={flat} />;
};

// ---------- pin: one hand presses the pin, the other steadies the photo ----------
export const pinToWall = (t: number, p: number, wallZ: number, cx: number, cy: number): {rig: Rig; card: Xf; pin: THREE.Vector3; pinIn: number} => {
	const r = idle(t);
	// photo travels from the chest to the wall
	const reach = sm(p / 0.4);
	const cardP = v3(cx, 1.16 + (cy - 1.16) * reach, 0.3 + (wallZ - 0.006 - 0.3) * reach);
	const card = xf(cardP, new THREE.Euler(-0.95 * (1 - reach), Math.PI, 0, 'YXZ'));
	const c = photoCorners(card);
	// steadying hand on the left edge; the other hand fetches the pin then presses
	r.handL.copy(c.lm).add(v3(0.012, 0, -0.012 * reach));
	r.gripL = 'open';
	const pinTop = c.top.clone().add(v3(0, 0, -0.004));
	const fetch = seg(p, 0.4, 0.62);
	const press = seg(p, 0.66, 0.8);
	const away = seg(p, 0.86, 1);
	const pinPos = pinTop.clone().add(v3(0, 0.004, 0.03 * (1 - press)));
	if (p < 0.4) {
		r.handR.copy(c.br);
		r.gripR = 'pinch';
	} else {
		const from = c.br;
		const handAt = pinPos.clone().add(v3(0, 0.016, -0.018));
		r.handR.lerpVectors(from, handAt, fetch).add(v3(0, 0, -0.12 * away)).add(v3(-0.08 * away, -0.2 * away, 0));
		r.gripR = away > 0.3 ? 'open' : 'pinch';
	}
	if (away > 0.3) r.handL.lerp(v3(0.2, 0.86, 0.05), seg(p, 0.9, 1));
	r.elbowL.set(0.7, 0.9, -0.3);
	r.elbowR.set(-0.7, 0.9, -0.3);
	r.headPitch = 0.05;
	return {rig: r, card, pin: pinPos, pinIn: press};
};

export const Pin: React.FC<{p: THREE.Vector3; flat?: number}> = ({p, flat}) => (
	<group position={p}>
		<Ink shape={['sphere', 0.008]} color="#FFA21A" outline flat={flat} />
		<Ink shape={['cyl', 0.0012, 0.0012, 0.02, 6]} color="#c9d1da" rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.012]} flat={flat} />
	</group>
);

// ---------- pen: tripod grip near the tip, wrist writes ----------
export const PEN = {len: 0.14, r: 0.0045};
export const writeAt = (t: number, p: number, paper: THREE.Vector3, lineW: number): {rig: Rig; tip: THREE.Vector3; pen: Xf} => {
	const r = idle(t);
	r.pelvis.y -= 0.02;
	r.lean = 0.32;
	r.headPitch = 0.55;
	// letters: small loops moving left to right along the line
	const x = paper.x - lineW / 2 + lineW * clamp01(p);
	const loop = p > 0 && p < 1 ? 1 : 0;
	const ph = t * 14;
	const tip = v3(x + 0.004 * Math.cos(ph) * loop, paper.y, paper.z + 0.007 * Math.sin(ph) * loop);
	const lift = p <= 0 || p >= 1 ? 0.02 : 0;
	tip.y += lift;
	// pen leans back toward the writer and to the right
	const dir = v3(-0.35, 0.82, -0.45).normalize();
	const pen = {p: tip.clone().add(dir.clone().multiplyScalar(PEN.len / 2)), q: new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir)};
	// tripod grip: hand sits about a quarter of the way up the pen
	r.handR.copy(tip.clone().add(dir.clone().multiplyScalar(0.035))).add(v3(-0.012, 0.008, -0.004));
	r.gripR = 'pinch';
	r.elbowR.set(-0.6, 0.9, -0.2);
	// other hand flat on the paper, steadying it
	r.handL.set(paper.x + lineW / 2 + 0.07, paper.y + 0.012, paper.z + 0.02);
	r.elbowL.set(0.6, 0.9, -0.2);
	return {rig: r, tip, pen};
};

export const Pen: React.FC<{x: Xf; flat?: number}> = ({x, flat}) => (
	<group position={x.p} quaternion={x.q}>
		<Ink shape={['cyl', PEN.r, PEN.r * 0.6, PEN.len, 12]} color="#262d36" outline flat={flat} />
		<Ink shape={['cone', PEN.r * 0.6, 0.012]} color="#c9d1da" position={[0, -PEN.len / 2 - 0.006, 0]} rotation={[Math.PI, 0, 0]} flat={flat} />
		<Ink shape={['cyl', PEN.r * 1.05, PEN.r * 1.05, 0.02, 12]} color={COLORS.amber} position={[0, PEN.len / 2 - 0.012, 0]} flat={flat} />
	</group>
);

// ---------- key: pinched at the bow, inserted, turned by the wrist ----------
export const keyInLock = (t: number, p: number, lock: THREE.Vector3, normal: THREE.Vector3): {rig: Rig; key: Xf} => {
	const r = idle(t);
	const insert = seg(p, 0.1, 0.45);
	const turn = seg(p, 0.55, 0.8);
	const out = 0.075 * (1 - insert);
	const along = normal.clone().normalize();
	const keyTip = lock.clone().add(along.clone().multiplyScalar(out));
	// key lies along the normal (blade into the lock), rotated about it by the turn
	const qa = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), along);
	const ang = (-Math.PI / 2) * turn;
	const q = new THREE.Quaternion().setFromAxisAngle(along, ang).multiply(qa);
	const key = {p: keyTip.clone().add(along.clone().multiplyScalar(0.034)), q};
	// the hand pinches the edge of the bow (so the bow stays visible) and orbits the
	// key axis as the wrist turns
	const bow = keyTip.clone().add(along.clone().multiplyScalar(0.07));
	const side = v3(0, -1, 0).applyAxisAngle(along, ang).multiplyScalar(0.034);
	r.handR.copy(bow.clone().add(side));
	r.gripR = 'pinch';
	r.elbowR.set(-0.6, 0.8, -0.4);
	r.headPitch = 0.3;
	r.lean = 0.08;
	return {rig: r, key};
};

export const Key: React.FC<{x: Xf; flat?: number}> = ({x, flat}) => (
	<group position={x.p} quaternion={x.q}>
		<Ink shape={['box', 0.007, 0.014, 0.05]} color="#d9c27a" position={[0, 0, -0.01]} flat={flat} />
		<Ink shape={['box', 0.007, 0.006, 0.012]} color="#d9c27a" position={[0, -0.009, -0.02]} flat={flat} />
		<Ink shape={['cyl', 0.021, 0.021, 0.005, 24]} color="#d9c27a" rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.034]} outline flat={flat} />
		<Ink shape={['cyl', 0.006, 0.006, 0.006, 12]} color="#06080B" rotation={[0, 0, Math.PI / 2]} position={[0, 0.009, 0.036]} flat={flat} />
	</group>
);

// ---------- mug: fingers through the handle, rim to the lips ----------
export const MUG = {r: 0.04, h: 0.095};
export const drinkMug = (t: number, p: number, base?: Rig): {rig: Rig; mug: Xf} => {
	const r = base ? cloneRig(base) : idle(t);
	const k = sm(p);
	// mug held at chest then raised so the rim meets the mouth
	const mouth = v3(0, DIM.thigh + DIM.shin + DIM.torso + DIM.headR * 0.45, DIM.headR * 0.95);
	const rest = v3(-0.12, 1.12, 0.26);
	const mugTopTarget = mouth.clone().add(v3(-0.01, -0.01, 0.045));
	const centre = rest.clone().lerp(mugTopTarget.clone().add(v3(0, -MUG.h / 2 + 0.01, 0.02)), k);
	const tilt = -0.95 * k;
	const mug = xf(centre, new THREE.Euler(tilt, 0, 0, 'XYZ'));
	// the handle is on the mug's -x side: the figure's right hand goes through it
	const handle = local(mug, v3(-MUG.r - 0.052, 0.004, 0));
	r.handR.copy(handle);
	r.gripR = 'hold';
	r.elbowR.set(-0.7, 0.7, -0.3);
	r.headPitch = 0.05 - 0.28 * k;
	return {rig: r, mug};
};

export const Mug: React.FC<{x: Xf; flat?: number; color?: string}> = ({x, flat, color = '#e7e9ec'}) => (
	<group position={x.p} quaternion={x.q}>
		<Ink shape={['cyl', MUG.r, MUG.r * 0.95, MUG.h, 24]} color={color} outline cast flat={flat} />
		<Ink shape={['circle', MUG.r * 0.86]} color="#3b2414" position={[0, MUG.h / 2 - 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} flat={flat} />
		<Ink shape={['torus', 0.024, 0.006, Math.PI * 1.2]} color={color} position={[-MUG.r - 0.003, 0, 0]} rotation={[0, 0, Math.PI * 0.4]} outline flat={flat} />
	</group>
);

// ---------- drawer: hold the handle, pull ----------
export const pullDrawer = (t: number, p: number, handle: THREE.Vector3, out: number): {rig: Rig; open: number} => {
	const r = idle(t);
	const open = sm(p) * out;
	// a low drawer: bend the knees and lean in so the hand really reaches the handle
	r.pelvis.y = 0.84;
	r.pelvis.z = -0.02;
	r.lean = 0.45;
	r.kneeL.set(0.16, 0.6, 1.2);
	r.kneeR.set(-0.16, 0.6, 1.2);
	r.handR.copy(handle.clone().add(v3(0, 0, -open - 0.022)));
	r.gripR = 'fist';
	r.elbowR.set(-0.5, 0.7, -0.3);
	r.handL.set(0.16, 0.8, 0.12);
	r.headPitch = 0.35;
	return {rig: r, open};
};

// ---------- handwriting texture revealed as the pen moves ----------
export const useHandwritingTex = () =>
	useMemo(
		() =>
			canvasTexture(1024, 600, (ctx, w, h) => {
				ctx.fillStyle = '#efe9dc';
				ctx.fillRect(0, 0, w, h);
			}),
		[],
	);

export const drawHandwriting = (tex: THREE.CanvasTexture, reveal: number) =>
	redraw(tex, (ctx, w, h) => {
		ctx.fillStyle = '#efe9dc';
		ctx.fillRect(0, 0, w, h);
		ctx.save();
		ctx.beginPath();
		roundRect(ctx, 0, 0, w * (0.18 + 0.68 * clamp01(reveal)), h, 0);
		ctx.clip();
		ctx.translate(w * 0.5, h * 0.52);
		ctx.rotate(-0.06);
		ctx.fillStyle = '#d9820f';
		ctx.font = '700 190px Caveat';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('Keep it.', 0, 0);
		ctx.restore();
	});

export const PhotoBackOnly: React.FC<{x: Xf; tex: THREE.Texture; flat?: number}> = ({x, tex, flat}) => (
	<group position={x.p} quaternion={x.q}>
		<Ink shape={['rbox', CARD_W, CARD_H, 0.0026, 0.0012]} color="#f1ece2" outline cast flat={flat} />
		<Ink shape={['plane', CARD_W - 0.002, CARD_H - 0.002]} map={tex} color="#ffffff" position={[0, 0, 0.0014]} flat={flat} />
	</group>
);

export {seg, sm, clamp01};
