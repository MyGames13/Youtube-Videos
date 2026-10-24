import React from 'react';
import * as THREE from 'three';
import {at} from '../events';
import {Board, bg, C, mono, noticeCard, text} from '../world/Board';
import {CamSpec, lerpCam} from '../world/mode';
import {PHOTO_CAM, PhotoState, PhotoWorld, SUBJECT_X} from '../world/PhotoWorld';
import {IMG_OFFSET_Y, PHOTO, PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Street} from '../world/Street';
import {Ink} from '../world/Ink';
import {cloneRig, idle, Rig, walk} from '../world/rig';
import {Kinetic} from '../overlay/Kinetic';
import {TitleCard} from '../overlay/Kinetic';
import {Figure, Label} from './common';
import {photoCamAt, photoStateAt} from './story';
import {BOARD_CAM, bx, by, Ctx, easeInOut, easeOut, handheld, lerp, lin, Out, seg, ShotFn, sm, v3} from './types';

const PI = Math.PI;
const VOID_X = 400; // a dark void where single cards float

// the photograph alone on a dark board, filling `fill` of the frame height
export const CardInVoid: React.FC<{lift?: number; glow?: number; develop?: number; stamp?: number; rot?: number}> = ({lift = 0, glow = 0, develop = 1, stamp = 0, rot = 0}) => {
	const tex = usePhotoTex();
	return (
		<>
			<Ink shape={['plane', 60, 40]} color="#06080B" position={[VOID_X, 0, -1]} flat={1} />
			<PhotoCard map={tex} position={[VOID_X, lift, 0]} rotation={[0, 0, rot]} glow={glow} develop={develop} stamp={stamp} flat={1} cast={false} />
		</>
	);
};
export const voidCam = (fillH: number, offY = 0): CamSpec => ({target: [VOID_X, IMG_OFFSET_Y + offY, 0], yaw: 0, pitch: 0, frameH: fillH, fov3d: 30});
export const IMG_FILL = PHOTO.h * 0.985;

// the photographer's long lens across the road: 45 m away, about 7 degrees
export const LONG_LENS: CamSpec = {target: [SUBJECT_X - 0.1, 1.05, 0], yaw: -0.12, pitch: 0.015, roll: 0.0, frameH: 5.4, fov3d: 7, flatFov: 14};

const live = (t: number, o: Partial<PhotoState> = {}): PhotoState => ({...photoStateAt(t), frozen: false, ...o});

// ---------------- title: thing one ----------------
const T1_title: ShotFn = (c) => ({
	cam: voidCam(PHOTO.h * 1.9),
	m: 0,
	world: <CardInVoid />,
	photo: photoStateAt(c.t),
	fx: {exposure: 0.6},
	overlay: <TitleCard t={c.t} t0={c.start} t1={c.end} n={1} title="TAKEN FROM FAR AWAY" frame={c.frame} />,
	captions: {hide: false},
});

// ---------------- dive into the photograph ----------------
const T1_dive: ShotFn = (c) => {
	const lt = c.lt;
	const SWAP = 0.62;
	if (lt < SWAP) {
		const k = easeInOut(lin(lt, 0, SWAP));
		return {
			cam: lerpCam(voidCam(PHOTO.h * 1.9), voidCam(IMG_FILL), k),
			m: 0,
			world: <CardInVoid />,
			photo: photoStateAt(c.t),
		};
	}
	// match cut on the rectangle: the live bus stop, exactly the photo's framing, then 3D
	const m = easeInOut(lin(lt, SWAP + 0.05, c.dur));
	const cam = lerpCam(photoCamAt(c.t), LONG_LENS, m);
	return {
		cam,
		m,
		world: <PhotoWorld s={live(c.t, {frozen: lt < SWAP + 0.35})} />,
		shake: handheld(c.t, 0.6 * m),
	};
};

// ---------------- crooked, hiding ----------------
const Brackets: React.FC<{roll: number; a: number; rec?: boolean; t: number}> = ({roll, a, rec, t}) => (
	<svg width={1280} height={720} style={{position: 'absolute', inset: 0, opacity: a, transform: `rotate(${roll}rad)`}}>
		{[
			[140, 110, 1, 1],
			[1140, 110, -1, 1],
			[140, 560, 1, -1],
			[1140, 560, -1, -1],
		].map(([x, y, sx, sy], i) => (
			<path key={i} d={`M${x},${y + 46 * sy} L${x},${y} L${x + 70 * sx},${y}`} stroke="#F4F6F8" strokeWidth={3} fill="none" opacity={0.85} />
		))}
		<line x1={628} y1={335} x2={652} y2={335} stroke="#F4F6F8" strokeWidth={2} opacity={0.6} />
		<line x1={640} y1={323} x2={640} y2={347} stroke="#F4F6F8" strokeWidth={2} opacity={0.6} />
		{rec ? <circle cx={170} cy={140} r={7} fill="#FF2B2B" opacity={Math.floor(t * 2) % 2 ? 1 : 0.25} /> : null}
	</svg>
);

const T1_crooked: ShotFn = (c) => {
	const lt = c.lt;
	const roll = 0.055 * Math.sin(Math.min(1, lt / 1.2) * PI * 0.5);
	const hide = seg(lt, at('L020.ss') - c.start - 0.2, at('L020.ss') - c.start + 0.6);
	const cam: CamSpec = {...LONG_LENS, roll, frameH: LONG_LENS.frameH * (1 - 0.06 * c.p), target: [LONG_LENS.target[0] + 0.25 * hide, LONG_LENS.target[1], 0]};
	return {
		cam,
		m: 1,
		world: (
			<>
				<PhotoWorld s={live(c.t)} />
				{/* the photographer hides behind a post: dark, very close to the lens */}
				<Ink shape={['box', 0.45, 6, 0.3]} color="#05070a" position={[SUBJECT_X - 3.0 + 0.9 * (1 - hide), 1.5, 30]} flat={1} />
			</>
		),
		shake: handheld(c.t, 0.9),
		overlay: <Brackets roll={0} a={seg(lt, 0.0, 0.3)} rec t={c.t} />,
		fx: {vignette: 0.4},
	};
};

// ---------------- what you are doing in it ----------------
const MID: CamSpec = {target: [SUBJECT_X, 1.25, 0], yaw: -0.1, pitch: 0.02, frameH: 2.3, fov3d: 12};
const T1_close: ShotFn = (c) => ({
	cam: lerpCam(LONG_LENS, MID, easeInOut(lin(c.lt, 0, 1.2))),
	m: 1,
	world: <PhotoWorld s={live(c.t)} />,
	shake: handheld(c.t, 0.7),
});

const T1_nothing: ShotFn = (c) => {
	const t = c.t;
	const wBus = at('L022.w1') - 0.08;
	const wCoffee = at('L022.w4') - 0.08;
	const wStare = at('L022.w6') - 0.08;
	if (t < wBus) {
		return {cam: {...MID, frameH: 2.6 - 0.15 * c.lt}, m: 1, world: <PhotoWorld s={live(t)} />, shake: handheld(t, 0.5)};
	}
	if (t < wCoffee) {
		const k = t - wBus;
		return {
			cam: {target: [-1.95, 2.45, 0.55], yaw: -0.25, pitch: -0.05, frameH: 1.05 - 0.05 * k, fov3d: 18},
			m: 1,
			world: <PhotoWorld s={live(t)} />,
			shake: handheld(t, 0.5),
		};
	}
	if (t < wStare) {
		const k = t - wCoffee;
		const sip = seg(k, 0.1, 0.7) * (1 - seg(k, 1.3, 1.9));
		return {
			cam: {target: [SUBJECT_X - 0.02, 1.42, 0.15], yaw: -0.55, pitch: 0.02, frameH: 0.62 - 0.03 * k, fov3d: 20},
			m: 1,
			world: <PhotoWorld s={live(t, {sipping: sip})} />,
			shake: handheld(t, 0.4),
		};
	}
	const k = t - wStare;
	return {
		cam: {target: [SUBJECT_X + 0.04, 1.62, 0], yaw: -0.08, pitch: 0.0, frameH: 0.5 - 0.04 * k, fov3d: 16},
		m: 1,
		world: <PhotoWorld s={live(t, {look: 0.5})} />,
		shake: handheld(t, 0.35),
	};
};

// ---------------- not posing, not performing, not holding your stomach in ----------------
const posing = (t: number): Rig => {
	const r = idle(t);
	r.handL.set(0.12, 0.98, 0.0); // hand on hip
	r.elbowL.set(0.6, 1.1, -0.1);
	r.handR.set(-0.14, 1.7, 0.12); // peace sign by the face
	r.elbowR.set(-0.6, 1.3, 0.0);
	r.headRoll = 0.12;
	r.expr = 'smile';
	r.mouth = 1;
	r.pelvis.x = 0.04;
	r.side = -0.05;
	return r;
};
const performing = (t: number): Rig => {
	const r = idle(t);
	const sh = Math.sin(t * 22) * 0.02;
	r.handL.set(0.55, 1.75 + sh, 0.12);
	r.handR.set(-0.55, 1.75 - sh, 0.12);
	r.elbowL.set(0.9, 1.0, 0);
	r.elbowR.set(-0.9, 1.0, 0);
	r.gripL = 'open';
	r.gripR = 'open';
	r.expr = 'o';
	r.footL.set(0.22, 0, 0.05);
	r.footR.set(-0.22, 0, 0.05);
	r.pelvis.y -= 0.05;
	return r;
};
const stomachIn = (t: number): Rig => {
	const r = idle(t);
	r.lean = -0.12;
	r.shrug = 0.03;
	r.handL.set(0.1, 0.9, -0.05);
	r.handR.set(-0.1, 0.9, -0.05);
	r.elbowL.set(0.5, 1.2, -0.5);
	r.elbowR.set(-0.5, 1.2, -0.5);
	r.expr = 'flinch';
	r.headPitch = -0.08;
	return r;
};

const T1_posing: ShotFn = (c) => {
	const lt = c.lt;
	const w = (i: number) => at(`L023.w${i}`) - c.start;
	const show = [w(0) - 0.05, w(2) - 0.05, w(4) - 0.05];
	const cross = [w(1) + 0.35, w(3) + 0.35, w(8) + 0.25];
	const labels = ['POSING', 'PERFORMING', 'STOMACH IN'];
	const rigs = [posing(c.t), performing(c.t), stomachIn(c.t)];
	const xs = [bx(260), bx(640), bx(1020)];
	return {
		cam: {...BOARD_CAM, frameH: 9 * (1 - 0.03 * c.p)},
		m: 0,
		world: (
			<>
				<Board
					draw={(ctx, W, H) => {
						bg(ctx, W, H);
						[260, 640, 1020].forEach((x, i) => {
							if (lt < show[i]) return;
							ctx.strokeStyle = 'rgba(244,246,248,0.55)';
							ctx.lineWidth = 3;
							ctx.strokeRect(x - 165, 120, 330, 430);
							mono(ctx, labels[i], x, 585, 18, C.grey, 'center', 6);
							const k = Math.min(1, Math.max(0, (lt - cross[i]) / 0.18));
							if (k > 0) {
								ctx.strokeStyle = C.white;
								ctx.lineWidth = 9;
								ctx.lineCap = 'round';
								ctx.beginPath();
								ctx.moveTo(x - 130, 160);
								ctx.lineTo(x - 130 + 260 * k, 160 + 360 * k);
								ctx.stroke();
								if (k >= 1) {
									const k2 = Math.min(1, (lt - cross[i] - 0.15) / 0.15);
									ctx.beginPath();
									ctx.moveTo(x + 130, 160);
									ctx.lineTo(x + 130 - 260 * Math.max(0, k2), 160 + 360 * Math.max(0, k2));
									ctx.stroke();
								}
							}
						});
					}}
				/>
				{rigs.map((r, i) => (lt >= show[i] ? <Figure key={i} f={{pos: v3(xs[i], by(540), 0.2), yaw: 0}} rig={r} scale={1.95} /> : null))}
			</>
		),
	};
};

// ---------------- flatten back into the photograph ----------------
const T1_flatten: ShotFn = (c) => {
	const lt = c.lt;
	const m = 1 - easeInOut(lin(lt, 1.0, 2.6));
	if (lt < 2.65) {
		return {cam: lerpCam(photoCamAt(c.t), LONG_LENS, m), m, world: <PhotoWorld s={live(c.t, {frozen: m < 0.35})} />, shake: handheld(c.t, 0.6 * m)};
	}
	const k = easeOut(lin(lt, 2.65, 3.6));
	return {cam: lerpCam(voidCam(IMG_FILL), voidCam(PHOTO.h * 1.7), k), m: 0, world: <CardInVoid />, photo: photoStateAt(c.t)};
};

// ---------------- the only rule ----------------
const T1_rule: ShotFn = (c) => {
	const lt = c.lt;
	const l026 = at('L026.ss') - c.start;
	const dim = seg(lt, l026 - 0.2, l026 + 0.1);
	return {
		cam: {...BOARD_CAM, frameH: 9 * (1 - 0.04 * c.p)},
		m: 0,
		world: (
			<Board
				draw={(ctx, W, H) => {
					bg(ctx, W, H);
					ctx.save();
					ctx.globalAlpha = 1 - 0.75 * dim;
					noticeCard(ctx, W / 2, H / 2 - 10, 680, 380, {
						header: 'BUILDING NOTICE 003',
						title: 'THE ONLY RULE',
						lines: [
							['APPLIES', 'TODAY'],
							['READ', 'ONCE'],
							['TEXT', '_______________________'],
						],
						hl: 2,
						highlight: seg(lt, 0.6, 1.4),
					});
					ctx.restore();
				}}
			/>
		),
		overlay: (
			<Kinetic
				t={c.t}
				frame={c.frame}
				items={[
					{text: 'DO NOT ASK WHO', t0: at('L026.ss'), t1: at('L026.w6') - 0.05, size: 78, y: 300, glitch: true},
					{text: 'ASK WHEN.', t0: at('L026.w6') - 0.05, t1: c.end, size: 118, y: 320, color: C.amber, glitch: true},
				]}
			/>
		),
	};
};

// ---------------- strangers: a poor use of an evening ----------------
const T1_lineup: ShotFn = (c) => {
	const lt = c.lt;
	const n = 7;
	const xs = Array.from({length: n}, (_, i) => -5.4 + i * 1.8);
	// our stickman walks along the row, leaning in to each face
	const walkX = lerp(-6.6, 5.2, lin(lt, 0.2, c.dur - 0.3));
	const near = xs.reduce((a, x) => (Math.abs(x - walkX) < Math.abs(a - walkX) ? x : a), xs[0]);
	const peer = Math.max(0, 1 - Math.abs(near - walkX) / 0.7);
	const r = walk(c.t, 0.7, 0.22);
	r.lean = 0.06 + 0.22 * peer;
	r.headPitch = 0.0;
	r.headYaw = 0.6 * peer;
	const l028 = at('L028.ss') - c.start;
	const late = seg(lt, l028, l028 + 2.2);
	return {
		cam: {target: [walkX * 0.25, 1.15, 0], yaw: 0, pitch: 0, frameH: 4.3},
		m: 0,
		world: (
			<>
				<Board
					w={30}
					h={16.9}
					position={[0, 1.2, -2]}
					draw={(ctx, W, H) => {
						bg(ctx, W, H);
						// a small wall clock: the evening going
						const cx = W * 0.5;
						const cy = H * 0.24;
						ctx.strokeStyle = C.dim;
						ctx.lineWidth = 3;
						ctx.beginPath();
						ctx.arc(cx, cy, 26, 0, PI * 2);
						ctx.stroke();
						ctx.strokeStyle = C.grey;
						ctx.beginPath();
						ctx.moveTo(cx, cy);
						ctx.lineTo(cx + Math.sin(late * PI * 1.2 + 4.2) * 15, cy - Math.cos(late * PI * 1.2 + 4.2) * 15);
						ctx.stroke();
						ctx.beginPath();
						ctx.moveTo(cx, cy);
						ctx.lineTo(cx + Math.sin(late * PI * 14) * 21, cy - Math.cos(late * PI * 14) * 21);
						ctx.stroke();
					}}
				/>
				<Ink shape={['box', 30, 0.02, 0.02]} color="#2a3340" position={[0, -0.01, -0.3]} flat={1} />
				{xs.map((x, i) => {
					const s = idle(c.t + i * 0.7);
					s.headYaw = (walkX > x ? 0.35 : -0.35) * Math.max(0, 1 - Math.abs(x - walkX) / 1.2);
					return <Figure key={i} f={{pos: v3(x, 0, -0.6), yaw: 0}} rig={s} color="#7d8896" />;
				})}
				<Figure f={{pos: v3(walkX, 0, 0.2), yaw: PI / 2}} rig={r} />
			</>
		),
	};
};

// ---------------- a stranger's head grows into the night street ----------------
const T1_street: ShotFn = (c) => {
	const lt = c.lt;
	if (lt < 0.55) {
		// push into a stranger's round head (flat), it fills the frame
		const k = easeInOut(lin(lt, 0, 0.55));
		return {
			cam: {target: [0.0, 1.66, -0.6], yaw: 0, pitch: 0, frameH: lerp(4.3, 0.16, k)},
			m: 0,
			world: (
				<>
					<Board w={30} h={16.9} position={[0, 1.2, -2]} draw={(ctx, W, H) => bg(ctx, W, H)} />
					<Figure f={{pos: v3(0, 0, -0.6), yaw: 0}} rig={idle(c.t)} color="#7d8896" />
				</>
			),
		};
	}
	// match cut on the circle: a street lamp globe, then pull back into the 3D street
	const k = easeInOut(lin(lt, 0.55, 2.2));
	const lampCam: CamSpec = {target: [0, 4.25, 0.3], yaw: 0, pitch: 0, frameH: 0.36, fov3d: 34};
	const streetCam: CamSpec = {target: [0.6, 1.35, 0.2], yaw: 0.18, pitch: 0.06, frameH: 3.2, fov3d: 34};
	const cam = lerpCam(lampCam, streetCam, k);
	const m = easeInOut(lin(lt, 0.55, 1.6));
	const meX = lerp(-1.6, 0.8, lin(lt, 0.55, c.dur));
	const r = walk(c.t, 0.8);
	// he turns to look at every face that passes
	r.headYaw = 0.7 * Math.sin(c.t * 2.2);
	return {
		cam,
		m,
		world: (
			<>
				<Street t={c.t + 3} />
				<Figure f={{pos: v3(meX, 0, -0.2), yaw: PI / 2}} rig={r} />
			</>
		),
		shake: handheld(c.t, 0.4),
	};
};

// ---------------- forty one ----------------
const T1_tally: ShotFn = (c) => {
	const lt = c.lt;
	const w = (i: number) => at(`L030.w${i}`) - c.start;
	const count = Math.min(41, Math.floor(41 * easeOut(lin(lt, w(4) - 0.4, w(8) + 0.15))));
	return {
		cam: {...BOARD_CAM, frameH: 9 * (1 - 0.04 * c.p)},
		m: 0,
		world: (
			<Board
				draw={(ctx, W, H) => {
					bg(ctx, W, H);
					mono(ctx, 'FACES CHECKED SINCE YOU FOUND IT', W / 2, 120, 16, C.grey, 'center', 5);
					ctx.strokeStyle = C.white;
					ctx.lineCap = 'round';
					ctx.lineWidth = 7;
					for (let i = 0; i < count; i++) {
						const g = Math.floor(i / 5);
						const k = i % 5;
						const gx = 250 + (g % 5) * 170;
						const gy = 210 + Math.floor(g / 5) * 120;
						ctx.beginPath();
						if (k < 4) {
							ctx.moveTo(gx + k * 26, gy);
							ctx.lineTo(gx + k * 26 + 4, gy + 72);
						} else {
							ctx.moveTo(gx - 12, gy + 54);
							ctx.lineTo(gx + 100, gy + 14);
						}
						ctx.stroke();
					}
					if (count >= 41) {
						text(ctx, '41', W / 2 + 330, 470, {size: 120, color: C.cyan, glow: 22});
						mono(ctx, 'NONE OF THEM', W / 2 + 330, 540, 16, C.grey, 'center', 5);
					}
				}}
			/>
		),
	};
};

export const THING1: Record<string, ShotFn> = {
	T1_title,
	T1_dive,
	T1_crooked,
	T1_close,
	T1_nothing,
	T1_posing,
	T1_flatten,
	T1_rule,
	T1_lineup,
	T1_street,
	T1_tally,
};

export {cloneRig, Label, sm};
export type {Ctx, Out};
