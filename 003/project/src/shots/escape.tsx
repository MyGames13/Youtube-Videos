import React from 'react';
import * as THREE from 'three';
import {at, TL} from '../events';
import {Board, bg, C, mono, text} from '../world/Board';
import {CamSpec, lerpCam} from '../world/mode';
import {PhotoWorld} from '../world/PhotoWorld';
import {PHOTO, PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Hallway, HALL, PIN_SPOT} from '../world/Hallway';
import {Kitchen, KITCHEN_X, KETTLE, KTABLE, Desk, DESK_X} from '../world/Rooms';
import {Street} from '../world/Street';
import {Ink} from '../world/Ink';
import {CameraProp} from '../world/Arm';
import {cloneRig, idle, laugh, Rig, sit, walk} from '../world/rig';
import {drinkMug, Key, keyInLock, Mug, Pin, pinToWall} from '../world/props';
import {SevenSeg} from '../overlay/HUD';
import {Fig, Figure, qWorld, toWorld} from './common';
import {CardInVoid, voidCam} from './thing1';
import {FINAL_CAM, photoStateAt} from './story';
import {BOARD_CAM, bx, by, clamp01, easeIn, easeInOut, easeOut, handheld, lerp, lin, pop, seg, ShotFn, v3} from './types';

const PI = Math.PI;

// where the photograph ends up: pinned on the right wall by the door
export const PIN_FIG: Fig = {pos: v3(HALL.w / 2 - 0.44, 0, PIN_SPOT.z), yaw: PI / 2};
const pinned = pinToWall(0, 1, 0.44, 0, PIN_SPOT.y);
export const PINNED = {p: toWorld(PIN_FIG, pinned.card.p), q: qWorld(PIN_FIG, pinned.card.q), pin: toWorld(PIN_FIG, pinned.pin)};

export const PinnedPhoto: React.FC<{glow?: number}> = ({glow = 0}) => {
	const tex = usePhotoTex();
	return (
		<>
			<PhotoCard map={tex} position={PINNED.p} quaternion={PINNED.q} glow={glow} />
			<Pin p={PINNED.pin} />
		</>
	);
};

// ---------------- pin it where you pass it every day ----------------
const E1_pin: ShotFn = (c) => {
	const p = easeInOut(lin(c.t, at('L081.ss') - 0.4, at('L082.ss') - 0.1));
	const a = pinToWall(c.t, p, 0.44, 0, PIN_SPOT.y);
	const after = seg(c.t, at('L082.ss'), at('L082.ss') + 0.8);
	const r = cloneRig(a.rig);
	if (after > 0) {
		const rest = idle(c.t);
		r.handL.lerp(rest.handL, after);
		r.handR.lerp(rest.handR, after);
		r.gripL = r.gripR = 'open';
	}
	const back = easeInOut(lin(c.t, at('L082.ss') + 0.2, at('L082.ss') + 1.3));
	const f: Fig = {pos: PIN_FIG.pos.clone().add(v3(-0.25 * back, 0, 0)), yaw: PI / 2};
	const cardP = toWorld(PIN_FIG, a.card.p);
	const cardQ = qWorld(PIN_FIG, a.card.q);
	const cam: CamSpec = {target: [0.95, 1.32, 0.5], yaw: -0.85, pitch: 0.12, frameH: lerp(1.5, 1.3, c.p), fov3d: 36};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Figure f={f} rig={r} />
				<CardAt p={cardP} q={cardQ} />
				{p > 0.55 ? <Pin p={toWorld(PIN_FIG, a.pin)} /> : null}
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.3),
	};
};
const CardAt: React.FC<{p: THREE.Vector3; q: THREE.Quaternion; glow?: number}> = ({p, q, glow}) => {
	const tex = usePhotoTex();
	return <PhotoCard map={tex} position={p} quaternion={q} glow={glow} />;
};

// ---------------- do not look for the bus stop, do not buy the scarf ----------------
const E2_dont: ShotFn = (c) => {
	const s1 = at('L083.ss') - c.start;
	const s2 = at('L083.w7') - c.start;
	const x1 = at('L083.we6') - c.start;
	const x2 = at('L083.se') - c.start;
	return {
		cam: {...BOARD_CAM, frameH: 9 * (1 - 0.03 * c.p)},
		m: 0,
		world: (
			<Board
				draw={(ctx, W, H) => {
					bg(ctx, W, H, C.bg, {x: W / 2, y: H / 2, r: 600, color: '#2a1d10', a: 0.4});
					const lt = c.lt;
					if (lt > s1) {
						ctx.save();
						const s = pop(lt - s1);
						ctx.translate(380, 330);
						ctx.scale(s, s);
						ctx.strokeStyle = '#8b97a5';
						ctx.lineWidth = 12;
						ctx.beginPath();
						ctx.moveTo(0, -60);
						ctx.lineTo(0, 170);
						ctx.stroke();
						ctx.fillStyle = C.white;
						ctx.beginPath();
						ctx.arc(0, -110, 70, 0, PI * 2);
						ctx.fill();
						ctx.fillStyle = '#1b2028';
						ctx.fillRect(-42, -132, 84, 46);
						ctx.fillRect(-36, -86, 14, 12);
						ctx.fillRect(22, -86, 14, 12);
						ctx.restore();
						mono(ctx, 'THE BUS STOP', 380, 545, 16, C.grey, 'center', 5);
					}
					if (lt > s2) {
						ctx.save();
						const s = pop(lt - s2);
						ctx.translate(900, 300);
						ctx.scale(s, s);
						ctx.lineCap = 'round';
						ctx.strokeStyle = C.amber;
						ctx.lineWidth = 36;
						ctx.beginPath();
						ctx.arc(0, 0, 70, PI * 0.15, PI * 0.85, true);
						ctx.stroke();
						ctx.beginPath();
						ctx.moveTo(40, 55);
						ctx.lineTo(60, 200);
						ctx.moveTo(10, 60);
						ctx.lineTo(0, 190);
						ctx.stroke();
						ctx.fillStyle = C.paper;
						ctx.save();
						ctx.translate(95, 150);
						ctx.rotate(0.3);
						ctx.fillRect(0, 0, 90, 50);
						ctx.restore();
						ctx.restore();
						mono(ctx, 'THE SCARF', 900, 545, 16, C.grey, 'center', 5);
					}
					const strike = (x: number, k: number) => {
						if (k <= 0) return;
						ctx.strokeStyle = C.white;
						ctx.lineWidth = 10;
						ctx.lineCap = 'round';
						ctx.beginPath();
						ctx.moveTo(x - 150, 140);
						ctx.lineTo(x - 150 + 300 * k, 140 + 380 * k);
						ctx.stroke();
					};
					strike(380, clamp01((lt - x1) / 0.2));
					strike(900, clamp01((lt - x2) / 0.2));
				}}
			/>
		),
	};
};

// ---------------- do not arrange the laugh: moments built on purpose come out stiff ----------------
const E3_arrange: ShotFn = (c) => {
	const lt = c.lt;
	const stiffT = at('L084.we12') - c.start;
	const press = seg(lt, 0.2, 0.6);
	const run = easeInOut(lin(lt, 0.8, 1.9));
	const pose = seg(lt, 1.9, 2.3);
	const flashT = stiffT - 0.75;
	const topple = easeIn(lin(lt, stiffT - 0.05, stiffT + 0.55));
	let r: Rig;
	if (lt < 0.8) {
		r = idle(c.t);
		r.handR.set(-0.1, 1.25, 0.32);
		r.handR.y -= 0.04 * press;
		r.headPitch = 0.3;
	} else if (lt < 1.9) {
		r = walk(c.t, 1.6, 0.4);
	} else {
		// a forced laugh: the shape of it, none of the give
		r = laugh(2.3, 0.8);
		r.shrug = 0.02;
		r.handL.set(0.35, 1.25, 0.15);
		r.handR.set(-0.35, 1.25, 0.15);
		r.headPitch = -0.2;
		r.expr = 'smile';
		r.mouth = 1;
		r.blink = 0;
		r = pose < 1 ? r : r;
	}
	const x = lerp(-2.0, 2.0, run);
	const yaw = lt < 0.8 ? -PI / 2 : lt < 1.9 ? PI / 2 : 0;
	const blink = lt > 0.6 && lt < flashT && Math.floor(lt * 4) % 2 === 0;
	const flash = lt > flashT && lt < flashT + 0.12 ? 1 - (lt - flashT) / 0.12 : 0;
	return {
		cam: {target: [-0.3, 1.0, 0], yaw: 0, pitch: 0, frameH: 2.75},
		m: 0,
		world: (
			<>
				<Board draw={(ctx, W, H) => bg(ctx, W, H)} position={[0, 1.2, -1]} scale={0.75} />
				<Ink shape={['box', 16, 0.02, 0.02]} color="#2a3340" position={[0, 0, -0.2]} />
				{/* tripod and camera */}
				<group position={[-2.6, 0, 0]}>
					<Ink shape={['cyl', 0.015, 0.015, 1.15, 8]} color="#5a6573" position={[-0.12, 0.55, 0]} rotation={[0, 0, -0.12]} />
					<Ink shape={['cyl', 0.015, 0.015, 1.15, 8]} color="#5a6573" position={[0.12, 0.55, 0]} rotation={[0, 0, 0.12]} />
					<Ink shape={['cyl', 0.015, 0.015, 1.15, 8]} color="#5a6573" position={[0, 0.55, 0]} />
					<CameraProp p={v3(0, 1.17, 0)} q={new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI / 2, 0))} />
					<Ink shape={['sphere', 0.025]} color={blink ? C.amber : '#3a3f47'} position={[-0.04, 1.24, 0.04]} glow={blink ? 1.5 : 0} flat={1} />
				</group>
				<group position={[lt < 0.8 ? -2.25 : x, 0, 0]} rotation={[0, 0, -PI / 2 * topple]}>
					<Figure f={{pos: v3(0, 0, 0), yaw}} rig={r} />
				</group>
			</>
		),
		fx: {flash},
	};
};

// ---------------- go to work, come home, pass the photograph on the way to the kettle ----------------
const E4_work: ShotFn = (c) => {
	const t = c.t;
	const home = at('L085.w3') - 0.15;
	const pass = at('L085.w5') - 0.15;
	if (t < home) {
		const r = sit(t, 0.52);
		r.handL.set(0.1, 0.8, 0.42 + 0.01 * Math.sin(t * 20));
		r.handR.set(-0.1, 0.8, 0.42 + 0.01 * Math.sin(t * 23 + 1));
		r.headPitch = 0.1;
		return {
			cam: {target: [DESK_X, 1.0, -0.4], yaw: 0.7, pitch: 0.12, frameH: 1.6, fov3d: 34},
			m: 1,
			world: (
				<>
					<Desk t={t} />
					<Figure f={{pos: v3(DESK_X, 0, -0.05), yaw: PI}} rig={r} />
					<Ink shape={['box', 0.45, 0.48, 0.45]} color="#3a4452" position={[DESK_X, 0.24, 0.05]} outline />
				</>
			),
			shake: handheld(t, 0.3),
		};
	}
	if (t < pass) {
		// come home: the key goes in and turns
		const k = clamp01((t - home) / (pass - home));
		const lock = v3(1600 - 0.2, 1.0, 0.4);
		const figPos = v3(1600, 0, 0);
		// keyInLock works in figure space (the figure faces +z, yaw 0)
		const a = keyInLock(t, 0.15 + 0.85 * k, lock.clone().sub(figPos), v3(0, 0, -1));
		a.key.p.add(figPos);
		return {
			cam: {target: [1600 - 0.16, 1.2, 0.26], yaw: -2.2, pitch: 0.1, frameH: lerp(1.15, 1.0, k), fov3d: 34},
			m: 1,
			world: (
				<>
					<Ink shape={['box', 3, 2.6, 0.06]} color="#2d3642" position={[1600, 1.3, 0.45]} receive />
					<Ink shape={['rbox', 0.86, 2.04, 0.05, 0.01]} color="#26303b" position={[1600 - 0.3, 1.03, 0.41]} outline receive />
					<Ink shape={['cyl', 0.018, 0.018, 0.02, 16]} color="#8b97a5" position={[lock.x, lock.y, 0.4]} rotation={[PI / 2, 0, 0]} outline />
					<Figure f={{pos: v3(1600, 0, 0), yaw: 0}} rig={a.rig} />
					<Key x={a.key} />
					<ambientLight intensity={0.9} color="#8496ad" />
					<pointLight position={[1600 - 0.6, 1.8, -0.4]} intensity={1.4} distance={4} color="#ffd9a8" />
				</>
			),
		};
	}
	// walk past the pinned photograph toward the kettle; a glance
	const k = (t - pass) / (c.end - pass);
	const z = lerp(2.0, -0.6, easeInOut(k));
	const r = walk(t, 0.9);
	const near = 1 - Math.min(1, Math.abs(z - PIN_SPOT.z) / 0.6);
	r.headYaw = -0.9 * near;
	return {
		cam: {target: [0.35, 1.3, z - 0.2], yaw: PI + 0.35, pitch: 0.08, frameH: 1.9, fov3d: 36},
		m: 1,
		world: (
			<>
				<Hallway t={t} book="closed" />
				<PinnedPhoto />
				<Figure f={{pos: v3(0.25, 0, z), yaw: PI}} rig={r} />
			</>
		),
		photo: photoStateAt(t),
		shake: handheld(t, 0.4),
	};
};

// ---------------- the days in between: pages flip into rooms ----------------
const Page: React.FC<{t: number; t0: number; day: string; label: string}> = ({t, t0, day, label}) => {
	const d = t - t0;
	if (d < -0.02 || d > 0.42) return null;
	const k = clamp01(d / 0.4);
	const ang = easeIn(k) * 100;
	return (
		<div style={{position: 'absolute', inset: 0, perspective: 1400}}>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background: '#ece6d8',
					transformOrigin: '50% 0%',
					transform: `rotateX(${ang}deg)`,
					backfaceVisibility: 'hidden',
					boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 90, background: '#c43a1a'}} />
				<div style={{fontFamily: 'Montserrat', fontWeight: 800, fontSize: 200, color: '#2b2f36', marginTop: 60}}>{day}</div>
				<div style={{fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 22, letterSpacing: 6, color: '#6b6f76'}}>{label}</div>
			</div>
		</div>
	);
};

const E5_days: ShotFn = (c) => {
	const t = c.t;
	const b = [c.start, at('L087.ss') - 0.2, at('L087.w6') - 0.15, at('L088.ss') - 0.2, at('L089.ss') - 0.2, at('L089.w5') - 0.15, at('L090.ss') - 0.2];
	const seg_i = b.filter((x) => t >= x).length - 1;
	const lt = t - b[seg_i];
	const pages = (
		<>
			<Page t={t} t0={b[0]} day="1" label="DAY ONE" />
			<Page t={t} t0={b[1]} day="37" label="AN ORDINARY ONE" />
			<Page t={t} t0={b[2]} day="88" label="ANOTHER ONE" />
			<Page t={t} t0={b[3]} day="203" label="A BAD ONE" />
			<Page t={t} t0={b[4]} day="290" label="NOT YET" />
			<Page t={t} t0={b[5]} day="351" label="NOT YET" />
			<Page t={t} t0={b[6]} day="389" label="SOON" />
		</>
	);
	let out;
	if (seg_i === 0) {
		// morning kitchen, a mug: fingers through the handle, rim to the lips
		const sip = seg(lt, 0.6, 1.3) * (1 - seg(lt, 1.8, 2.3));
		const a = drinkMug(t, sip);
		out = {
			cam: {target: [KITCHEN_X - 0.4, 1.35, -0.2], yaw: -0.75, pitch: 0.05, frameH: 1.1, fov3d: 34} as CamSpec,
			world: (
				<>
					<Kitchen t={t} morning={1} />
					<Figure f={{pos: v3(KITCHEN_X - 0.4, 0, -0.3), yaw: 0.35}} rig={a.rig} />
					<group position={[KITCHEN_X - 0.4, 0, -0.3]} rotation={[0, 0.35, 0]}>
						<Mug x={a.mug} color="#FFA21A" />
					</group>
				</>
			),
		};
	} else if (seg_i === 1) {
		// all four hundred and twelve: a grid of days filling in
		const n = Math.floor(412 * clamp01(lt / 1.6));
		out = {
			cam: BOARD_CAM,
			world: (
				<Board
					draw={(ctx, W, H) => {
						bg(ctx, W, H);
						for (let i = 0; i < 412; i++) {
							const col = i % 32;
							const row = Math.floor(i / 32);
							ctx.fillStyle = i < n ? (i % 7 === 1 ? C.amber : 'rgba(244,246,248,0.85)') : 'rgba(244,246,248,0.08)';
							ctx.fillRect(170 + col * 30, 140 + row * 30, 22, 22);
						}
						mono(ctx, `${n} / 412`, W / 2, 570, 18, C.grey, 'center', 5);
					}}
				/>
			),
		};
	} else if (seg_i === 2) {
		const r = sit(t, 0.52);
		r.handL.set(0.1, 0.8, 0.42 + 0.01 * Math.sin(t * 20));
		r.handR.set(-0.1, 0.8, 0.42 + 0.01 * Math.sin(t * 23 + 1));
		r.headPitch = 0.12;
		r.headYaw = 0.6 * seg(lt, 0.8, 1.2);
		out = {
			cam: {target: [DESK_X, 1.05, -0.5], yaw: -0.55, pitch: 0.1, frameH: 1.4, fov3d: 34} as CamSpec,
			world: (
				<>
					<Desk t={t} />
					<Figure f={{pos: v3(DESK_X, 0, -0.05), yaw: PI}} rig={r} />
				</>
			),
		};
	} else if (seg_i === 3) {
		// a bad one: rain, head down, walking anyway
		const r = walk(t, 0.55, 0.22);
		r.headPitch = 0.45;
		r.lean = 0.14;
		out = {
			cam: {target: [lerp(-0.8, 0.4, lt / 2.4), 1.2, -0.4], yaw: 0.25, pitch: 0.05, frameH: 2.4, fov3d: 34} as CamSpec,
			world: (
				<>
					<Street t={t + 20} passers={false} rain={1} />
					<Figure f={{pos: v3(lerp(-1.2, 0.2, lt / 2.4), 0, -0.6), yaw: PI / 2}} rig={r} />
				</>
			),
		};
	} else if (seg_i === 4) {
		// do not hurry the date: he pulls the calendar page, it springs back
		const tug = Math.max(0, Math.sin(lt * 9)) * (1 - seg(lt, 1.2, 1.6));
		const r = idle(t);
		r.handR.set(-0.05, 1.45 - 0.08 * tug, 0.32);
		r.gripR = 'pinch';
		r.lean = 0.05 + 0.08 * tug;
		out = {
			cam: {target: [0.6, 1.4, -0.1], yaw: -0.7, pitch: 0.05, frameH: 1.3, fov3d: 34} as CamSpec,
			world: (
				<>
					<Hallway t={t} book="closed" />
					<group position={[0.55, 1.5, -0.1]} rotation={[0, PI / 2, 0]}>
						<Ink shape={['box', 0.32, 0.42, 0.01]} color="#ece6d8" outline />
						<Ink shape={['box', 0.32, 0.08, 0.012]} color="#c43a1a" position={[0, 0.17, 0.001]} />
						<Ink shape={['box', 0.3, 0.3, 0.004]} color="#e2dccd" position={[0, -0.06 - 0.05 * tug, 0.009]} rotation={[0.3 * tug, 0, 0]} />
					</group>
					<Figure f={{pos: v3(0.18, 0, -0.1), yaw: PI / 2}} rig={r} />
				</>
			),
		};
	} else if (seg_i === 5) {
		// do not pose: he poses at the pinned photograph, then stops
		const r = idle(t);
		const posing = seg(lt, 0.0, 0.3) * (1 - seg(lt, 0.9, 1.3));
		r.handL.lerp(v3(0.12, 0.98, 0.0), posing);
		r.handR.lerp(v3(-0.14, 1.7, 0.12), posing);
		r.headRoll = 0.12 * posing;
		r.expr = posing > 0.5 ? 'smile' : 'blank';
		r.mouth = 1;
		out = {
			cam: {target: [0.8, 1.3, 0.4], yaw: -0.95, pitch: 0.08, frameH: 1.6, fov3d: 34} as CamSpec,
			world: (
				<>
					<Hallway t={t} book="closed" />
					<PinnedPhoto />
					<Figure f={{pos: v3(0.55, 0, 0.55), yaw: -PI / 2}} rig={r} />
				</>
			),
		};
	} else {
		// the number shrinks without your help: an evening, a mug, calm
		const r = sit(t, 0.5);
		r.handR.set(-0.08, 0.86, 0.32);
		r.handL.set(0.08, 0.86, 0.32);
		r.headPitch = 0.05;
		out = {
			cam: {target: [KTABLE.x, 1.0, KTABLE.z], yaw: 0.6, pitch: 0.18, frameH: 1.5, fov3d: 34} as CamSpec,
			world: (
				<>
					<Kitchen t={t} morning={0.35} />
					<Figure f={{pos: v3(KTABLE.x - 0.05, 0, KTABLE.z + 0.55), yaw: PI}} rig={r} />
					<Mug x={{p: v3(KTABLE.x - 0.05, KTABLE.y + 0.07, KTABLE.z + 0.15), q: new THREE.Quaternion()}} color="#FFA21A" />
				</>
			),
		};
	}
	return {
		...out,
		m: 1,
		overlay: pages,
		photo: photoStateAt(t),
		shake: handheld(t, 0.35),
	};
};

// ---------------- check the corner: zero ----------------
const E6_count: ShotFn = (c) => {
	const count = TL.meter.find((k) => k.kind === 'count' && (k as {to: number}).to === 0) as {t: number; until: number; from: number};
	const p = clamp01((c.t - count.t) / (count.until - count.t));
	const v = c.t < count.t ? 38 : Math.round(38 * (1 - (1 - Math.pow(1 - p, 2.2))));
	const zero = v === 0;
	const sinceZero = zero ? c.t - count.until : -1;
	return {
		cam: {target: [PINNED.p.x - 0.4, PINNED.p.y, PINNED.p.z], yaw: -1.25, pitch: 0.05, frameH: 0.9, fov3d: 34},
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" lamp={0.8} />
				<PinnedPhoto glow={zero ? 0.4 : 0.1} />
			</>
		),
		photo: photoStateAt(c.t),
		fx: {exposure: 0.45},
		hud: {hideMeter: true},
		overlay: (
			<div style={{position: 'absolute', left: 640, top: 320, transform: 'translate(-50%, -50%) scale(2.4)'}}>
				<div style={{padding: '8px 14px 10px 14px', borderRadius: 8, border: `1.5px solid ${zero ? '#5CF2E6' : '#FFA21A'}88`, background: 'rgba(6,8,11,0.82)', minWidth: 214, position: 'relative'}}>
					<div style={{fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 11, letterSpacing: 2.2, color: '#9aa6b4', marginBottom: 5}}>TAKEN IN</div>
					<div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8}}>
						<SevenSeg text={String(v).padStart(3, '0')} color={zero ? '#5CF2E6' : '#FFA21A'} />
						<div style={{fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 15, color: zero ? '#5CF2E6' : '#FFA21A', minWidth: 40}}>DAYS</div>
					</div>
					{sinceZero >= 0 && sinceZero < 1 ? <div style={{position: 'absolute', inset: -8 - sinceZero * 50, borderRadius: 14 + sinceZero * 30, border: '2px solid #5CF2E6', opacity: 1 - sinceZero}} /> : null}
				</div>
			</div>
		),
	};
};

// ---------------- an ordinary Tuesday ----------------
const TUESDAY_CAM: CamSpec = {target: [0.2, 1.35, 0], yaw: -0.3, pitch: 0.03, frameH: 2.1, fov3d: 22};
const momentState = (t: number) => {
	const s = photoStateAt(t);
	const talkStart = at('L092.w9');
	const talk = t > talkStart && t < talkStart + 1.4 ? 1 : 0;
	const handOn = seg(t, at('L092.w4'), at('L092.w4') + 0.6);
	const lg = seg(t, at('L093.w5') - 0.1, TL.laugh_t - 0.05);
	return {...s, frozen: false, friend: 1, hand: handOn, laugh: lg, expr: (lg > 0.02 ? 'laugh' : 'blank') as 'laugh' | 'blank', talk};
};
const E7_tuesday: ShotFn = (c) => {
	const s = momentState(c.t);
	const cam: CamSpec = {...TUESDAY_CAM, frameH: lerp(2.6, 1.9, easeInOut(c.p)), yaw: lerp(-0.42, -0.3, c.p)};
	return {
		cam,
		m: easeInOut(lin(c.lt, 0, 0.6)),
		world: <PhotoWorld s={s} />,
		shake: handheld(c.t, 0.3),
		fx: {warm: 0.25},
		overlay:
			s.talk > 0 ? (
				<div style={{position: 'absolute', left: 820, top: 230, fontFamily: 'Montserrat', fontWeight: 800, fontSize: 40, color: '#F4F6F8', opacity: 0.9}}>
					<span style={{background: 'rgba(6,8,11,0.6)', padding: '4px 14px', borderRadius: 18}}>...</span>
				</div>
			) : undefined,
	};
};
const E8_laugh: ShotFn = (c) => {
	const freezeT = TL.laugh_t;
	const t = Math.min(c.t, freezeT);
	const s = momentState(t);
	if (c.t < freezeT) {
		const cam: CamSpec = {...TUESDAY_CAM, frameH: lerp(1.9, 1.7, c.p), yaw: -0.3};
		return {cam, m: 1, world: <PhotoWorld s={s} />, shake: handheld(c.t, 0.3), fx: {warm: 0.25}};
	}
	// the shutter: freeze, flatten, and it is the photograph
	const k = easeInOut(lin(c.t, freezeT, freezeT + 0.55));
	const border = easeOut(lin(c.t, freezeT + 0.6, freezeT + 1.2));
	if (border <= 0) {
		const cam = lerpCam({...TUESDAY_CAM, frameH: 1.7}, FINAL_CAM, k);
		return {cam, m: 1 - k, world: <PhotoWorld s={{...s, frozen: true, friend: k > 0.9 ? 0 : 1}} />, fx: {warm: 0.25 * (1 - k)}};
	}
	return {cam: lerpCam(voidCam(PHOTO.h * 0.985), voidCam(PHOTO.h * 1.45), border), m: 0, world: <CardInVoid />, photo: photoStateAt(c.t), fx: {warm: 0.1}};
};

// ---------------- right on time ----------------
const E9_ontime: ShotFn = (c) => ({
	cam: {target: [PINNED.p.x - 0.02, PINNED.p.y, PINNED.p.z], yaw: -1.05, pitch: 0.04, frameH: lerp(0.95, 0.6, easeInOut(c.p)), fov3d: 34},
	m: 1,
	world: (
		<>
			<Hallway t={c.t} book="closed" />
			<PinnedPhoto glow={0.25} />
		</>
	),
	photo: photoStateAt(c.t),
	shake: handheld(c.t, 0.25),
});

export const ESCAPE: Record<string, ShotFn> = {
	E1_pin,
	E2_dont,
	E3_arrange,
	E4_work,
	E5_days,
	E6_count,
	E7_tuesday,
	E8_laugh,
	E9_ontime,
};
export {text, bx, by, KETTLE};
