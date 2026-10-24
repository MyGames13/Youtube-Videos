import React, {useMemo} from 'react';
import * as THREE from 'three';
import {at} from '../events';
import {Board, bg, C, mono, ring, stamp, text} from '../world/Board';
import {CamSpec, lerpCam} from '../world/mode';
import {PHOTO_CAM, PhotoWorld, SUBJECT_X} from '../world/PhotoWorld';
import {IMG_OFFSET_Y, PHOTO, PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Hallway} from '../world/Hallway';
import {Ink} from '../world/Ink';
import {Stickman} from '../world/Stickman';
import {canvasTexture, rand, roundRect} from '../world/textures';
import {cloneRig, idle, laugh} from '../world/rig';
import {lookAtPhoto, turnOver} from '../world/props';
import {Kinetic, TitleCard} from '../overlay/Kinetic';
import {Figure, Label, Photographer, qWorld, toWorld} from './common';
import {AT_BOARD, FX} from './hook';
import {CardInVoid, voidCam} from './thing1';
import {FINAL_CAM, photoCamAt, photoStateAt} from './story';
import {BOARD_CAM, easeInOut, easeOut, handheld, lerp, lin, pop, seg, ShotFn, v3} from './types';

const PI = Math.PI;
const VOID_X = 400;

// ---------------- title ----------------
const T3_title: ShotFn = (c) => ({
	cam: voidCam(PHOTO.h * 1.9),
	m: 0,
	world: <CardInVoid />,
	photo: photoStateAt(c.t),
	fx: {exposure: 0.6},
	overlay: <TitleCard t={c.t} t0={c.start} t1={c.end} n={3} title="YOU ARE NOT ALONE IN IT" frame={c.frame} />,
});

// ---------------- a hand on your shoulder pops out of the photograph ----------------
const T3_hand: ShotFn = (c) => {
	const lt = c.lt;
	const handT = at('L044.w5') - c.start;
	const pan = easeInOut(lin(lt, 0.0, handT + 0.4));
	const base = photoCamAt(c.t);
	// stay inside the photograph's crop: the right edge never passes x = 0.92, the friend stays cropped out
	const shoulder: CamSpec = {...base, target: [0.2, 1.42, 0], frameH: 0.8};
	const pop = easeInOut(lin(lt, handT + 0.5, handT + 1.6));
	return {
		cam: lerpCam(base, shoulder, pan),
		// lights on (m = 1) but the photograph itself stays flat; only the hand gains volume
		m: 1,
		world: <PhotoWorld s={photoStateAt(c.t)} flatAll={1} friendFlat={1 - pop} />,
		fx: {bloom: 0.9 + 0.4 * pop},
	};
};

// ---------------- someone standing beside you, cropped out ----------------
const T3_cropped: ShotFn = (c) => {
	const lt = c.lt;
	const pan = easeInOut(lin(lt, 0.0, 2.2));
	// beyond the photo's right border, in the dark, the rest of someone (same scale as the photo)
	const s = PHOTO.h / FINAL_CAM.frameH;
	const r = idle(c.t);
	r.handR.set(-0.6, 1.45, -0.05);
	r.elbowR.set(-0.5, 1.0, 0.5);
	r.headYaw = -0.6;
	return {
		cam: {target: [VOID_X + lerp(0.02, 0.15, pan), lerp(0.012, -0.01, pan), 0], yaw: 0, pitch: 0, frameH: lerp(0.3, 0.26, pan)},
		m: 0,
		world: (
			<>
				<CardInVoid />
				<group position={[VOID_X + 0.15, IMG_OFFSET_Y - FINAL_CAM.target[1] * s, -0.01]} scale={s}>
					<Stickman rig={r} color="#232b35" outline={0} />
				</group>
			</>
		),
		photo: photoStateAt(c.t),
		fx: {vignette: 0.45},
	};
};

// ---------------- you are laughing at something they said ----------------
const T3_laughs: ShotFn = (c) => {
	const base = photoCamAt(c.t);
	const face: CamSpec = {...base, target: [0.07, 1.5, 0], frameH: 0.95};
	return {cam: lerpCam(base, face, easeInOut(c.p)), m: 0, world: <PhotoWorld s={photoStateAt(c.t)} />};
};

// ---------------- extreme close up of the laugh ----------------
const T3_ecu: ShotFn = (c) => {
	const face: CamSpec = {...photoCamAt(c.t), target: [SUBJECT_X + 0.02, 1.64, 0], frameH: lerp(0.5, 0.36, easeInOut(c.p))};
	return {cam: face, m: 0, world: <PhotoWorld s={photoStateAt(c.t)} />, fx: {vignette: 0.35}};
};

// ---------------- the one that escapes before you can manage it ----------------
// Flat. The laugh gets out of his mouth and across the frame; the hand arrives late.
const ESC_X = 1450;
const VoidBack: React.FC<{x: number; glow?: string}> = ({x, glow = '#1d2a36'}) => (
	<Board
		w={6.4}
		h={3.6}
		position={[x, 1.05, -0.6]}
		draw={(ctx, W, H) => {
			bg(ctx, W, H, C.bg, {x: W / 2, y: H * 0.45, r: 620, color: glow, a: 0.9});
			ctx.fillStyle = '#ffffff10';
			ctx.fillRect(0, H * 0.792, W, 3);
		}}
	/>
);
const Ha: React.FC<{lt: number; t0: number; from: THREE.Vector3; h: number; dx: number; dy: number}> = ({lt, t0, from, h, dx, dy}) => {
	const k = lin(lt, t0, t0 + 1.05);
	if (lt < t0 || k >= 1) return null;
	const e = easeOut(k);
	const p: [number, number, number] = [from.x + dx * e, from.y + dy * Math.sin(PI * e * 0.85), 0.05];
	return <Label text="HA" position={p} h={h * (0.6 + 0.4 * seg(lt, t0, t0 + 0.12))} color={C.amber} glow={0.5} opacity={1 - seg(k, 0.75, 1)} />;
};
const T3_escape: ShotFn = (c) => {
	const lt = c.lt;
	const tEsc = at('L048.w3') - c.start;
	const tMan = at('L048.w7') - c.start;
	const f = {pos: v3(ESC_X - 0.45, 0, 0), yaw: 0.28};
	const burst = seg(lt, tEsc - 0.12, tEsc + 0.12);
	const r = burst > 0.02 ? laugh(c.t, burst) : idle(c.t);
	if (burst <= 0.3) {
		// holding it in: a smile he is trying to flatten
		r.expr = 'smile';
		r.mouth = 0.15 + 0.35 * seg(lt, 0.2, tEsc - 0.1) + 0.04 * Math.sin(lt * 23) * seg(lt, 0.4, tEsc);
		r.headPitch = 0.08 * seg(lt, 0.2, tEsc - 0.1);
	}
	// the hand comes up to manage it, too late
	const cover = easeOut(lin(lt, tMan - 0.18, tMan + 0.1));
	r.handR.lerp(v3(-0.015, 1.575, 0.17), cover);
	r.elbowR.set(-0.45, 1.15, 0.35);
	r.blink = cover > 0.5 ? 0 : r.blink;
	r.headPitch = lerp(r.headPitch, 0.02, cover);
	const mouth = toWorld(f, v3(0.0, 1.575, 0.15));
	const cam: CamSpec = {target: [ESC_X + 0.3, 1.3, 0], yaw: 0, pitch: 0, frameH: lerp(1.85, 1.7, easeInOut(c.p)), fov3d: 30};
	return {
		cam,
		m: 0,
		world: (
			<>
				<VoidBack x={ESC_X} />
				<Figure f={f} rig={r} />
				<Ha lt={lt} t0={tEsc} from={mouth} h={0.3} dx={2.0} dy={0.05} />
				<Ha lt={lt} t0={tEsc + 0.22} from={mouth} h={0.25} dx={1.75} dy={0.13} />
				<Ha lt={lt} t0={tEsc + 0.42} from={mouth} h={0.21} dx={1.9} dy={-0.2} />
				{/* one small one still gets past the hand */}
				<Ha lt={lt} t0={tMan + 0.35} from={mouth.clone().add(v3(0.08, 0, 0))} h={0.12} dx={0.9} dy={0.14} />
				<ambientLight intensity={0.9} color="#8496ad" />
			</>
		),
		shake: handheld(c.t, 0.15),
	};
};

// ---------------- nobody gets that face on request ----------------
const REQ_X = 1500;
const T3_request: ShotFn = (c) => {
	const lt = c.lt;
	const tAsk = at('L049.w1') - c.start;
	const tReq = at('L049.w5') - c.start;
	const ph = {pos: v3(REQ_X - 0.85, 0, 0), yaw: 0.95};
	const f = {pos: v3(REQ_X + 0.55, 0, 0), yaw: -0.3};
	// asked to laugh: he goes stiff and produces a face
	const stiff = seg(lt, tAsk + 0.1, tAsk + 0.45);
	const r = idle(c.t, 1 - stiff);
	r.handL.lerp(v3(0.13, 0.9, 0.0), stiff);
	r.handR.lerp(v3(-0.13, 0.9, 0.0), stiff);
	r.elbowL.set(0.3, 1.2, -0.4);
	r.elbowR.set(-0.3, 1.2, -0.4);
	r.lean = 0.02 - 0.05 * stiff;
	r.shrug = 0.035 * stiff + 0.004 * Math.sin(lt * 40) * stiff;
	r.headPitch = -0.06 * stiff;
	r.expr = stiff > 0.5 ? 'smile' : 'blank';
	r.mouth = 0.32;
	r.blink = stiff > 0.5 ? 0 : r.blink;
	const bubble = easeOut(lin(lt, tAsk - 0.05, tAsk + 0.2));
	const flash = lt > tReq + 0.1 && lt < tReq + 0.25 ? 1 - (lt - tReq - 0.1) / 0.15 : 0;
	const cam: CamSpec = {target: [REQ_X - 0.1, 1.2, 0], yaw: 0, pitch: 0, frameH: lerp(2.0, 1.85, easeInOut(c.p)), fov3d: 30};
	return {
		cam,
		m: 0,
		world: (
			<>
				<VoidBack x={REQ_X} glow="#2a2316" />
				<Photographer f={ph} t={c.t} lens={0.4} />
				<Figure f={f} rig={r} />
				{bubble > 0.01 ? (
					<group position={[REQ_X - 0.18, 1.83, 0.05]} scale={(0.6 + 0.4 * bubble) * 0.85}>
						<Board
							w={1.25}
							h={0.42}
							px={[750, 252]}
							transparent
							opacity={bubble}
							draw={(ctx, W, H) => {
								ctx.fillStyle = '#e8ecf0';
								roundRect(ctx, 6, 6, W - 12, H - 60, 40);
								ctx.fill();
								ctx.beginPath();
								ctx.moveTo(120, H - 56);
								ctx.lineTo(90, H - 6);
								ctx.lineTo(190, H - 56);
								ctx.fill();
								text(ctx, 'NOW LAUGH. NATURALLY.', W / 2, (H - 54) / 2 + 4, {size: 52, color: '#0b0e12', weight: 800});
							}}
						/>
					</group>
				) : null}
				<ambientLight intensity={0.9} color="#8496ad" />
			</>
		),
		fx: {flash},
		shake: handheld(c.t, 0.15),
	};
};

// ---------------- a table of cheese ----------------
const cheeseTex = (i: number) =>
	canvasTexture(400, 300, (ctx, w, h) => {
		const bgs = ['#3e5f73', '#6a4a5a', '#4a6a4a', '#7a6a4a', '#4a4a6a', '#5a6a7a', '#6a5a3a', '#3a5a5a', '#5a4a3a', '#4a5a7a'];
		ctx.fillStyle = '#efe9dc';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = bgs[i % bgs.length];
		ctx.fillRect(14, 14, w - 28, h - 70);
		const cx = w / 2 + (rand(i, 2) - 0.5) * 30;
		ctx.lineCap = 'round';
		// stiff body, arms at the sides
		ctx.strokeStyle = '#0b0e12';
		ctx.lineWidth = 11;
		const body = () => {
			ctx.beginPath();
			ctx.moveTo(cx, 120);
			ctx.lineTo(cx, 200);
			ctx.moveTo(cx, 135);
			ctx.lineTo(cx - 30, 195);
			ctx.moveTo(cx, 135);
			ctx.lineTo(cx + 30, 195);
			ctx.moveTo(cx, 200);
			ctx.lineTo(cx - 20, 232);
			ctx.moveTo(cx, 200);
			ctx.lineTo(cx + 20, 232);
			ctx.stroke();
		};
		body();
		ctx.strokeStyle = '#F4F6F8';
		ctx.lineWidth = 7;
		body();
		ctx.fillStyle = '#F4F6F8';
		ctx.strokeStyle = '#0b0e12';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(cx, 88, 34, 0, PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#0b0e12';
		ctx.beginPath();
		ctx.arc(cx - 11, 82, 3.5, 0, PI * 2);
		ctx.arc(cx + 11, 82, 3.5, 0, PI * 2);
		ctx.fill();
		// the same exact smile every time
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(cx, 92, 13, 0.15 * PI, 0.85 * PI);
		ctx.stroke();
		ctx.font = '700 26px "JetBrains Mono"';
		ctx.fillStyle = '#6b6f76';
		ctx.textAlign = 'center';
		(ctx as unknown as {letterSpacing: string}).letterSpacing = '6px';
		ctx.fillText('CHEESE', w / 2, h - 22);
	});

const CheeseRow: React.FC<{lt: number; real: number; topple: number}> = ({lt, real, topple}) => {
	const texs = useMemo(() => Array.from({length: 9}, (_, i) => cheeseTex(i)), []);
	const photo = usePhotoTex();
	return (
		<group position={[1000, 0.76, 0]}>
			<Ink shape={['box', 6.5, 0.05, 0.9]} color="#2b3440" position={[0.3, -0.03, 0]} outline cast receive />
			<Ink shape={['box', 6.4, 0.72, 0.85]} color="#1c232b" position={[0.3, -0.42, 0]} receive />
			{texs.map((tx, i) => {
				const since = lt - 0.15 - i * 0.18;
				if (since < 0) return null;
				const up = easeOut(since / 0.18);
				const fall = Math.max(0, Math.min(1, (topple - i * 0.06) / 0.25));
				return (
					<group key={i} position={[-2.2 + i * 0.5, 0, 0]} rotation={[0, 0, -fall * 1.45]}>
						<group rotation={[0, 0.0, 0]} position={[0, 0.21 * up, 0]}>
							<Ink shape={['box', 0.4, 0.3, 0.008]} map={tx} color="#ffffff" position={[0, 0.0, 0]} rotation={[-0.08, 0, 0]} outline cast />
						</group>
					</group>
				);
			})}
			{real > 0 ? (
				<group position={[lerp(4.6, 2.55, easeOut(real)), 0.17, 0.05]} rotation={[-0.06, 0, 0]} scale={1.55}>
					<PhotoCard map={photo} glow={0.6 * real} back={false} />
				</group>
			) : null}
		</group>
	);
};

const T3_cheese: ShotFn = (c) => {
	const lt = c.lt;
	const notCheese = at('L051.w4') - c.start;
	const real = easeOut(lin(lt, notCheese - 0.3, notCheese + 0.5));
	const topple = lin(lt, notCheese + 0.4, notCheese + 1.4) * 1.4;
	const dolly = easeInOut(c.p);
	const cam: CamSpec = {target: [1000 + lerp(-1.7, 2.3, dolly), 0.98, 0], yaw: lerp(-0.4, 0.3, dolly), pitch: 0.14, frameH: 0.95, fov3d: 34};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Ink shape={['plane', 30, 12]} color="#141a21" position={[1000, 3, -2]} receive />
				<Ink shape={['plane', 30, 12]} color="#11161c" rotation={[-PI / 2, 0, 0]} position={[1000, 0, 0]} receive />
				<CheeseRow lt={lt} real={real} topple={topple} />
				<ambientLight intensity={0.9} color="#8496ad" />
				<directionalLight position={[1002, 4, 3]} intensity={1.6} color="#fff1dc" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={4} shadow-camera-bottom={-4} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.4),
	};
};

// ---------------- do not ask whose hand. ask when ----------------
const T3_askwhen: ShotFn = (c) => ({
	cam: voidCam(PHOTO.h * 1.8),
	m: 0,
	world: <CardInVoid />,
	photo: photoStateAt(c.t),
	fx: {exposure: 0.35},
	overlay: (
		<Kinetic
			t={c.t}
			frame={c.frame}
			items={[
				{text: 'DO NOT ASK WHOSE HAND', t0: at('L052.ss'), t1: at('L052.w7') - 0.05, size: 66, y: 300, glitch: true},
				{text: 'ASK WHEN.', t0: at('L052.w7') - 0.05, t1: c.end, size: 118, y: 320, color: C.amber, glitch: true},
			]}
		/>
	),
});

// ---------------- now turn it over ----------------
const T3_turn: ShotFn = (c) => {
	const f = AT_BOARD;
	const p = easeInOut(lin(c.t, at('L053.ss') - 0.1, at('L053.se') + 0.45));
	const a = turnOver(c.t, p);
	const cardP = toWorld(f, a.card.p);
	const cardQ = qWorld(f, a.card.q);
	const ots: CamSpec = {target: [FX + 0.02, 1.16, -1.2], yaw: -0.5, pitch: 0.52, frameH: 1.0, fov3d: 38};
	const close: CamSpec = {target: [cardP.x, cardP.y, cardP.z], yaw: -0.25, pitch: 0.75, frameH: 0.32, fov3d: 38};
	return {
		cam: lerpCam(ots, close, easeInOut(lin(c.lt, 1.3, 2.4))),
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Figure f={f} rig={a.rig} />
				<PhotoCardLive p={cardP} q={cardQ} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.35),
	};
};
const PhotoCardLive: React.FC<{p: THREE.Vector3; q: THREE.Quaternion; glow?: number}> = ({p, q, glow}) => {
	const tex = usePhotoTex();
	return <PhotoCard map={tex} position={p} quaternion={q} glow={glow} />;
};

// ---------------- it is in your handwriting ----------------
const drawCompare = (ctx: CanvasRenderingContext2D, W: number, H: number, lt: number, stampK = 0) => {
	bg(ctx, W, H);
	const card = (x: number, title: string, lines: string[], rot: number) => {
		ctx.save();
		ctx.translate(x, H / 2 - 10);
		ctx.rotate(rot);
		ctx.fillStyle = '#efe9dc';
		ctx.shadowColor = 'rgba(0,0,0,0.6)';
		ctx.shadowBlur = 24;
		ctx.fillRect(-230, -150, 460, 300);
		ctx.shadowColor = 'transparent';
		mono(ctx, title, -205, -122, 13, '#6b6f76', 'left', 3);
		lines.forEach((l, i) => text(ctx, l, 0, -40 + i * 74 + (lines.length === 1 ? 50 : 0), {size: lines.length === 1 ? 110 : 64, weight: 700, font: 'Caveat', color: lines.length === 1 ? '#d9820f' : '#2b2f36'}));
		ctx.restore();
	};
	card(W * 0.29, 'BACK OF THE PHOTOGRAPH', ['Keep it.'], -0.03);
	card(W * 0.71, 'YOUR SHOPPING LIST', ['milk, eggs', 'bin day', 'keep it'], 0.025);
	const k = Math.min(1, Math.max(0, (lt - 0.35) / 0.3));
	if (k > 0) {
		ring(ctx, W * 0.29 - 92, H / 2 + 38, 48 * k + 10, C.cyan, 3, k);
		ring(ctx, W * 0.71 - 40, H / 2 + 98, 30 * k + 8, C.cyan, 3, k);
	}
	if (stampK > 0) stamp(ctx, 'MATCH', W / 2, H / 2 + 170, 64, C.amber, -0.12, Math.min(1, stampK * 2), 1 + 0.5 * Math.max(0, 1 - stampK * 3));
};
const T3_compare: ShotFn = (c) => ({
	cam: {...BOARD_CAM, frameH: 9 * (1 - 0.03 * c.p)},
	m: 0,
	world: <Board draw={(ctx, W, H) => drawCompare(ctx, W, H, c.lt)} />,
});

// ---------------- do not hold it to the light ----------------
const T3_light: ShotFn = (c) => {
	const f = AT_BOARD;
	const lt = c.lt;
	const lightT = at('L056.w8') - c.start;
	const both = at('L057.ss') - c.start;
	const up = easeInOut(lin(lt, lightT - 0.3, lightT + 0.5)) * (1 - easeInOut(lin(lt, both + 0.5, both + 1.4)));
	const base = lookAtPhoto(c.t, {});
	// the photo rises toward the lamp, held up between his eyes and the light
	const lamp = v3(-0.56, 1.25, -1.42);
	const lampFig = lamp.clone().sub(f.pos).applyAxisAngle(v3(0, 1, 0), -f.yaw);
	const cardP = base.card.p.clone().lerp(new THREE.Vector3(lampFig.x * 0.45, 1.5, 0.45), up);
	const cardQ = base.card.q.clone().slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, PI + 0.5, 0, 'YXZ')), up);
	const held = lookAtPhoto(c.t, {});
	const r = cloneRig(held.rig);
	const corner = (sx: number) => cardP.clone().add(v3(sx * 0.115, -0.07, 0).applyQuaternion(cardQ));
	r.handL.copy(corner(-1));
	r.handR.copy(corner(1));
	r.headPitch = lerp(0.58, -0.1, up);
	r.headYaw = lerp(0, 0.35, up);
	const cam: CamSpec = {target: [FX - 0.15, 1.35, -1.05], yaw: -0.75, pitch: 0.18, frameH: 1.25, fov3d: 34};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Figure f={f} rig={r} />
				<PhotoCardLive p={toWorld(f, cardP)} q={qWorld(f, cardQ)} glow={0.9 * up} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.35),
	};
};

// ---------------- management has compared it ----------------
const T3_match: ShotFn = (c) => {
	const yours = at('L058.w4') - c.start;
	return {
		cam: {...BOARD_CAM, frameH: 9 * (1 - 0.04 * c.p)},
		m: 0,
		world: <Board draw={(ctx, W, H) => drawCompare(ctx, W, H, 1, Math.max(0, (c.lt - yours) / 0.5))} />,
	};
};

export const THING3: Record<string, ShotFn> = {
	T3_title,
	T3_hand,
	T3_cropped,
	T3_laughs,
	T3_ecu,
	T3_escape,
	T3_request,
	T3_cheese,
	T3_askwhen,
	T3_turn,
	T3_compare,
	T3_light,
	T3_match,
};
export {pop};
