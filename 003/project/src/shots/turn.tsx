import React, {useMemo} from 'react';
import * as THREE from 'three';
import {at, TL, DURATION, shotEnd, shotStart} from '../events';
import {HOOK} from './hook';
import {Board, bg, C, noticeCard, stamp} from '../world/Board';
import {CamSpec, lerpCam} from '../world/mode';
import {BusStopSet, PhotoWorld} from '../world/PhotoWorld';
import {CARD_H, CARD_W, PHOTO, PhotoCard, RenderToTexture, Spot, useRenderTarget} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Hallway, HALL, BOOK_POS, PIN_SPOT} from '../world/Hallway';
import {Kitchen, KTABLE, KITCHEN_X} from '../world/Rooms';
import {Ink, Glow} from '../world/Ink';
import {Arm} from '../world/Arm';
import {glowTexture} from '../world/textures';
import {cloneRig, idle, sit} from '../world/rig';
import {drawHandwriting, Pen, Pin, PhotoBackOnly, useHandwritingTex, writeAt} from '../world/props';
import {Stickman} from '../world/Stickman';
import {Figure, toWorld} from './common';
import {CardInVoid, voidCam, LONG_LENS} from './thing1';
import {PINNED} from './escape';
import {FINAL_CAM, photoStateAt} from './story';
import {BOARD_CAM, clamp01, easeInOut, easeOut, handheld, lerp, lin, seg, ShotFn, v3} from './types';

const PI = Math.PI;

// ---------------- one more thing: management has reviewed that advice ----------------
const ADVICE: [string, string][] = [
	['1', 'DO NOT THROW IT AWAY'],
	['2', 'DO NOT SHOW IT TO ANYONE'],
	['3', 'DO NOT TRY TO REMEMBER'],
];
const RevisionBoard: React.FC<{hl: number; strike?: number; stampK: number}> = ({hl, strike, stampK}) => (
	<Board
		draw={(ctx, W, H) => {
			bg(ctx, W, H, C.bg, {x: W / 2, y: H / 2, r: 600, color: '#2a1d10', a: 0.45});
			noticeCard(ctx, W / 2, H / 2 - 20, 720, 420, {header: 'REVISION TO BUILDING NOTICE 003', title: 'ADVICE, REVIEWED', lines: ADVICE, hl: 1, highlight: hl, strike});
			if (stampK > 0) stamp(ctx, 'REVIEWED', W / 2 + 170, H / 2 + 100, 48, C.amber, -0.14, stampK, 1 + 0.6 * (1 - stampK));
		}}
	/>
);
const O1_revision: ShotFn = (c) => ({
	cam: {...BOARD_CAM, frameH: 9 * (1 - 0.05 * c.p)},
	m: 0,
	world: <RevisionBoard hl={0} stampK={0} />,
});

// "Earlier, Management told you not to show it to anyone": the hook plays back,
// slow and drained, until the photograph goes behind his back on "anyone".
const O1_earlier: ShotFn = (c) => {
	const lt = c.lt;
	const h0 = shotStart('H02_show');
	const hDur = shotEnd('H02_show') - h0;
	const hAny = at('L002.w10') - h0;
	const a = at('L096.w9') - c.start;
	const hl = lt < a ? (lt / a) * hAny : hAny + (lt - a);
	const ht = Math.min(hl, hDur - 0.01);
	const out = HOOK.H02_show({t: h0 + ht, lt: ht, dur: hDur, p: ht / hDur, frame: c.frame, start: h0, end: h0 + hDur});
	const inflate = easeInOut(lin(lt, 0, 0.7));
	const blink = Math.floor(lt * 2) % 2 === 0;
	return {
		...out,
		m: inflate,
		fx: {desat: 0.75, warm: -0.1, grain: 0.07, vignette: 0.45, exposure: 0.92},
		overlay: (
			<div style={{position: 'absolute', left: 28, top: 52, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 18, letterSpacing: 3, color: C.amber, display: 'flex', gap: 12, alignItems: 'center'}}>
				<span style={{opacity: blink ? 1 : 0.35}}>{'<<'}</span>
				<span>PLAYBACK</span>
				<span style={{color: '#9aa6b4', fontWeight: 500}}>00:0{Math.min(9, 5 + Math.floor(ht))}</span>
			</div>
		),
	};
};

const O1_reviewed: ShotFn = (c) => {
	const lt = c.lt;
	const rev = at('L097.w3') - c.start;
	return {
		cam: {...BOARD_CAM, frameH: 9 * (0.97 - 0.04 * c.p)},
		m: 0,
		world: <RevisionBoard hl={seg(lt, 0.0, 0.45)} strike={lt > rev + 0.4 ? 1 : undefined} stampK={clamp01((lt - rev) / 0.35)} />,
	};
};

// ---------------- frame it ----------------
const FRAME = {w: 0.36, h: 0.27};
const FramedPhoto: React.FC<{p: THREE.Vector3; q: THREE.Quaternion; glow?: number}> = ({p, q, glow = 0}) => {
	const tex = usePhotoTex();
	return (
		<group position={p} quaternion={q}>
			<Ink shape={['rbox', FRAME.w, FRAME.h, 0.025, 0.006]} color="#3a2a20" position={[0, 0, -0.012]} outline cast />
			<Ink shape={['plane', FRAME.w - 0.04, FRAME.h - 0.04]} color="#efe9dc" position={[0, 0, 0.002]} />
			<PhotoCard map={tex} back={false} cast={false} position={[0, -0.012, 0.004]} glow={glow} />
		</group>
	);
};
// the frame hangs where the pinned photograph was, by the door
const FRAME_Q = PINNED.q;
const FRAME_P = PINNED.p.clone().add(v3(-0.012, 0.02, 0));

const O2_frame: ShotFn = (c) => {
	const lt = c.lt;
	const hang = easeInOut(lin(lt, 0.3, 1.8));
	const f = {pos: v3(HALL.w / 2 - 0.46, 0, PIN_SPOT.z), yaw: PI / 2};
	// frame travels from his chest to the wall; both hands hold its sides
	const startP = toWorld(f, v3(0, 1.2, 0.3));
	const p = startP.clone().lerp(FRAME_P, hang);
	const q = new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), -PI / 2).slerp(FRAME_Q, hang);
	const r = idle(c.t);
	const side = (s: number) => p.clone().add(v3(s * (FRAME.w / 2 + 0.01), -0.02, 0).applyQuaternion(q));
	const release = seg(lt, 2.0, 2.5);
	const toF = (v: THREE.Vector3) => v.clone().sub(f.pos).applyAxisAngle(v3(0, 1, 0), -f.yaw);
	r.handL.copy(toF(side(-1))).lerp(idle(c.t).handL, release);
	r.handR.copy(toF(side(1))).lerp(idle(c.t).handR, release);
	r.gripL = r.gripR = release > 0.5 ? 'open' : 'hold';
	r.elbowL.set(0.6, 1.0, -0.2);
	r.elbowR.set(-0.6, 1.0, -0.2);
	r.headPitch = 0.0;
	return {
		cam: {target: [0.95, 1.38, 0.55], yaw: -0.8, pitch: 0.1, frameH: lerp(1.35, 1.15, c.p), fov3d: 36},
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Figure f={f} rig={r} />
				<FramedPhoto p={p} q={q} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.25),
		fx: {warm: 0.5},
	};
};

// ---------------- nobody was following you: the photographer's spot is empty ----------------
const AcrossTheRoad: React.FC<{t: number}> = ({t}) => {
	const tex = useMemo(() => glowTexture(), []);
	return (
		<group position={[0, 0, 44]}>
			<Ink shape={['box', 40, 0.12, 4]} color="#232b36" position={[0, -0.06, 0]} receive />
			<Ink shape={['box', 40, 6, 0.3]} color="#161c25" position={[0, 3, 2.2]} />
			<Ink shape={['cyl', 0.05, 0.06, 4.2, 12]} color="#39424e" position={[0.6, 2.1, 0.8]} outline cast />
			<Ink shape={['sphere', 0.17]} color="#ffe2b0" position={[0.6, 4.25, 0.8]} flat={1} glow={0.5} />
			<Glow position={[0.6, 4.25, 0.78]} size={2.4} color={C.amber} intensity={0.45} tex={tex} />
			<Spot position={[0.6, 4.1, 0.6]} target={[0.4, 0, 0]} intensity={24} angle={0.85} penumbra={0.8} decay={1.6} distance={12} color="#ffd6a8" />
			<pointLight position={[0.6, 3.2, -1.2]} intensity={2.5} distance={9} decay={1.5} color="#ffcf99" />
			{/* a puddle catching the light where someone would stand */}
			<Ink shape={['circle', 0.55]} color="#ffd6a8" rotation={[-PI / 2, 0, 0]} position={[0.3, 0.005, -0.4]} opacity={0.18} flat={1} glow={0.3} />
		</group>
	);
};
const O3_nobody: ShotFn = (c) => {
	const lt = c.lt;
	const turn = easeInOut(lin(c.t, at('L100.ss') - 0.2, at('L100.ss') + 1.6));
	const s = photoStateAt(c.t);
	const fromStop: CamSpec = {target: [0.6, 1.5, 6], yaw: PI, pitch: 0.04, frameH: 4.5, fov3d: 30};
	const cam = turn < 0.01 ? {...LONG_LENS, frameH: LONG_LENS.frameH * (1 - 0.05 * lt)} : lerpCam({...LONG_LENS}, fromStop, turn);
	return {
		cam,
		m: 1,
		world: (
			<>
				<PhotoWorld s={{...s, frozen: false, hand: 0}} hideSubject />
				<AcrossTheRoad t={c.t} />
			</>
		),
		shake: handheld(c.t, 0.3 * (1 - turn)),
		fx: {warm: 0.35},
		hud: {opacity: 1 - 0.4 * turn},
	};
};

// ---------------- never surveillance, only a reminder: brackets become a frame ----------------
const O4_reminder: ShotFn = (c) => {
	const lt = c.lt;
	const close = easeInOut(lin(c.t, at('L101.w6') - 0.2, at('L101.w6') + 1.0));
	const x0 = lerp(140, 448, close);
	const x1 = lerp(1140, 832, close);
	const y0 = lerp(110, 238, close);
	const y1 = lerp(560, 452, close);
	const armX = lerp(70, (x1 - x0) / 2, close);
	const armY = lerp(46, (y1 - y0) / 2, close);
	const col = close > 0.5 ? '#FFA21A' : '#F4F6F8';
	return {
		cam: voidCam(PHOTO.h * 1.6),
		m: 0,
		world: <CardInVoid glow={0.25 * close} />,
		photo: photoStateAt(c.t),
		hud: {opacity: 1 - 0.5 * close},
		fx: {scan: 0.03 * (1 - close), vignette: 0.25 - 0.1 * close, warm: 0.45},
		overlay: (
			<svg width={1280} height={720} style={{position: 'absolute', inset: 0}}>
				{[
					[x0, y0, 1, 1],
					[x1, y0, -1, 1],
					[x0, y1, 1, -1],
					[x1, y1, -1, -1],
				].map(([x, y, sx, sy], i) => (
					<path key={i} d={`M${x},${y + armY * sy} L${x},${y} L${x + armX * sx},${y}`} stroke={col} strokeWidth={lerp(3, 7, close)} fill="none" style={{filter: close > 0.5 ? 'drop-shadow(0 0 8px #FFA21A)' : 'none'}} />
				))}
			</svg>
		),
	};
};

// ---------------- someone is going to be glad you were there ----------------
const O5_glad: ShotFn = (c) => {
	const s = {...photoStateAt(c.t), frozen: false, friend: 1, hand: 1, laugh: 0.85 + 0.15 * Math.sin(c.t * 2)};
	return {
		cam: {target: [0.5, 1.5, 0.05], yaw: 0.85, pitch: 0.03, frameH: lerp(1.25, 1.0, easeInOut(c.p)), fov3d: 26},
		m: 1,
		world: <PhotoWorld s={s} />,
		shake: handheld(c.t, 0.25),
		fx: {warm: 0.4},
	};
};

// ---------------- the handwriting was yours: future you writes it ----------------
const WriteScene: React.FC<{t: number; p: number}> = ({t, p}) => {
	const hw = useHandwritingTex();
	drawHandwriting(hw, p);
	const paper = v3(KTABLE.x, KTABLE.y + 0.026, KTABLE.z);
	const fig = {pos: v3(KTABLE.x, 0, KTABLE.z + 0.52), yaw: PI};
	// writeAt works in figure space; the paper sits in front of him
	const paperFig = paper.clone().sub(fig.pos).applyAxisAngle(v3(0, 1, 0), -fig.yaw);
	const a = writeAt(t, p, paperFig, 0.15);
	const r = cloneRig(a.rig);
	const sitR = sit(t, 0.5);
	r.pelvis.copy(sitR.pelvis);
	r.footL.copy(sitR.footL);
	r.footR.copy(sitR.footR);
	r.kneeL.copy(sitR.kneeL);
	r.kneeR.copy(sitR.kneeR);
	return (
		<>
			<Kitchen t={t} morning={1} />
			<Figure f={fig} rig={r} scarf={1} />
			<group position={fig.pos} rotation={[0, fig.yaw, 0]}>
				<PhotoBackOnly x={{p: paperFig, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, PI))}} tex={hw} />
				<Pen x={a.pen} />
			</group>
		</>
	);
};
const O6_write: ShotFn = (c) => {
	const p = easeInOut(lin(c.t, at('L103.ss') + 0.2, at('L104.se') - 0.4));
	return {
		cam: {target: [KTABLE.x + 0.03, KTABLE.y + 0.03, KTABLE.z + 0.02], yaw: 0.05, pitch: 1.4, frameH: lerp(0.44, 0.36, easeInOut(c.p)), fov3d: 16},
		m: 1,
		world: <WriteScene t={c.t} p={p} />,
		shake: handheld(c.t, 0.25),
		fx: {warm: 0.4},
	};
};

// ---------------- tomorrow you may find another one ----------------
const AnotherInBook: React.FC<{glow: number; lift: number}> = ({glow, lift}) => {
	const tex = usePhotoTex();
	const p = v3(BOOK_POS.x + 0.08 + 0.12 * lift, HALL.boardTop + 0.024 + 0.08 * lift, BOOK_POS.z - 0.02);
	return (
		<>
			<PhotoCard map={tex} position={p} rotation={[-PI / 2 + 1.1 * lift, 0, 0.12]} glow={glow} />
			<Glow position={[BOOK_POS.x + 0.2, HALL.boardTop + 0.06, BOOK_POS.z]} size={0.5} color={C.amber} intensity={0.35 * glow} tex={glowTexture()} />
		</>
	);
};
const O7_another: ShotFn = (c) => {
	const r = idle(c.t);
	r.headPitch = 0.5;
	const smile = seg(c.t, at('L106.w4'), at('L106.w4') + 0.6);
	// on "another one" a second photograph slides a little way out of the book by itself
	const slide = easeOut(lin(c.t, at('L105.w4') - 0.1, at('L105.w4') + 1.0));
	r.expr = smile > 0.5 ? 'smile' : 'blank';
	r.mouth = 0.6;
	return {
		cam: {target: [BOOK_POS.x + 0.1, 0.98, BOOK_POS.z + 0.08], yaw: -0.5, pitch: 0.78, frameH: lerp(0.9, 0.72, easeInOut(c.p)), fov3d: 34},
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<FramedPhoto p={FRAME_P} q={FRAME_Q} />
				<Figure f={{pos: v3(0.44, 0, -0.84), yaw: PI - 0.45}} rig={r} />
				<AnotherInBook glow={0.35 + 0.45 * slide} lift={0.55 * slide} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.25),
		fx: {warm: 0.45},
	};
};

// ---------------- keep them; lights off; the second photograph ----------------
const SecondPhotoScene: React.FC<{t: number}> = ({t}) => {
	const first = usePhotoTex();
	// a little older: a slight stoop, reading glasses; holds the first photograph up and smiles wider
	const r = idle(0.8, 0);
	r.lean = 0.07;
	r.expr = 'laugh';
	r.mouth = 1;
	r.blink = 0.7;
	r.headPitch = -0.12;
	const cardP = v3(-0.26, 1.55, 0.22);
	r.handR.copy(cardP.clone().add(v3(0.0, -CARD_H * 1.5 * 0.5 + 0.01, 0)));
	r.gripR = 'pinch';
	r.elbowR.set(-0.6, 1.0, 0.1);
	return (
		<>
			<Ink shape={['plane', 6, 4]} color="#4a3c30" position={[0, 1.5, -1]} />
			<Ink shape={['plane', 6, 4]} color="#2c241e" rotation={[-PI / 2, 0, 0]} position={[0, 0, 0]} />
			<Stickman rig={r} scarf={1} />
			{/* glasses */}
			<Ink shape={['torus', 0.028, 0.0045]} color="#2a2f36" position={[-0.055, 1.66, 0.135]} />
			<Ink shape={['torus', 0.028, 0.0045]} color="#2a2f36" position={[0.055, 1.66, 0.135]} />
			<PhotoCard map={first} position={cardP} rotation={[0, 0.15, 0.04]} scale={1.5} back={false} />
		</>
	);
};
const SECOND_CAM: CamSpec = {target: [-0.05, 1.45, 0], yaw: 0.05, pitch: 0, frameH: 1.0, fov3d: 18, flatFov: 18};
const SecondPhoto: React.FC<{p: THREE.Vector3; q: THREE.Quaternion; glow: number; t: number}> = ({p, q, glow, t}) => {
	const rt2 = useRenderTarget();
	return (
		<>
			<RenderToTexture rt={rt2} cam={SECOND_CAM} m={0} clear="#3a2f26">
				<SecondPhotoScene t={t} />
			</RenderToTexture>
			<PhotoCard map={rt2.texture} position={p} quaternion={q} glow={glow} />
		</>
	);
};

const O8_end: ShotFn = (c) => {
	const t = c.t;
	const keepT = at('L107.ss') - 0.1;
	const offT = at('L108.se') + 0.75;
	const pinT = offT + 1.4;
	const lightsOff = seg(t, offT, offT + 0.12);
	const r = idle(t);
	const take = seg(t, keepT, keepT + 0.7);
	r.handR.lerp(v3(-0.15, 1.15, 0.3), take);
	r.gripR = take > 0.5 ? 'pinch' : 'open';
	r.expr = 'smile';
	r.mouth = 0.8;
	// second photograph: a hand from the frame edge pins it beside the first
	const pinIn = easeInOut(lin(t, pinT, pinT + 1.1));
	const press = seg(t, pinT + 1.1, pinT + 1.35);
	const secondQ = FRAME_Q;
	const secondTarget = FRAME_P.clone().add(v3(0, -0.03, -0.34));
	const secondStart = secondTarget.clone().add(v3(-0.5, -0.25, -0.35));
	const secondP = secondStart.clone().lerp(secondTarget, pinIn);
	const pinPt = secondP.clone().add(v3(0, CARD_H / 2 - 0.01, 0).applyQuaternion(secondQ)).add(v3(-0.004, 0, 0));
	const armRoot = v3(0.3, 1.0, -0.6);
	const armOut = seg(t, pinT + 1.5, pinT + 2.2);
	const handT = pinPt.clone().add(v3(-0.03 * (1 - press), 0.02, 0)).lerp(armRoot.clone().add(v3(0.05, 0, 0)), armOut);
	const wide: CamSpec = {target: [0.55, 1.25, 0.1], yaw: -0.9, pitch: 0.06, frameH: 1.8, fov3d: 36};
	const pair: CamSpec = {target: [FRAME_P.x - 0.02, FRAME_P.y - 0.02, FRAME_P.z - 0.17], yaw: -1.08, pitch: 0.02, frameH: lerp(0.62, 0.52, lin(t, pinT, DURATION)), fov3d: 34};
	const k = easeInOut(lin(t, offT + 0.2, pinT));
	const sec = seg(t, pinT - 0.1, pinT + 0.4);
	return {
		cam: lerpCam(wide, pair, k),
		m: 1,
		world: (
			<>
				<Hallway t={t} book="closed" lightsOff={lightsOff} />
				<FramedPhoto p={FRAME_P} q={FRAME_Q} glow={0.15 + 0.85 * lightsOff} />
				{lightsOff < 0.5 ? <Figure f={{pos: v3(0.62, 0, 0.75), yaw: -PI / 2 - 0.4}} rig={r} /> : null}
				{t >= pinT - 0.1 ? (
					<>
						<SecondPhoto p={secondP} q={secondQ} glow={0.6 * sec} t={t} />
						{press > 0 ? <Pin p={pinPt} /> : null}
						{armOut < 1 ? <Arm root={armRoot} target={handT} pole={v3(0.6, 0.7, -0.3)} grip={press > 0 && armOut < 0.2 ? 'pinch' : 'open'} /> : null}
					</>
				) : null}
				<pointLight position={[FRAME_P.x - 0.5, FRAME_P.y, FRAME_P.z - 0.15]} intensity={0.5 * lightsOff} distance={1.5} decay={1.5} color="#ffb04a" />
			</>
		),
		photo: photoStateAt(t),
		fx: {warm: 0.45, exposure: 1 - 0.25 * lightsOff, fade: seg(t, DURATION - 2.75, DURATION - 2.5)},
		shake: handheld(t, 0.2),
		hud: {opacity: 1 - lightsOff},
	};
};

export const TURN: Record<string, ShotFn> = {
	O1_revision,
	O1_earlier,
	O1_reviewed,
	O2_frame,
	O3_nobody,
	O4_reminder,
	O5_glad,
	O6_write,
	O7_another,
	O8_end,
};
export {BusStopSet, KITCHEN_X, CARD_W, FINAL_CAM, TL};
