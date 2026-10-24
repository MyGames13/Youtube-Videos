import React from 'react';
import * as THREE from 'three';
import {at} from '../events';
import {Board, bg, C, noticeCard} from '../world/Board';
import {applyCam, camFor, CamSpec, lerpCam} from '../world/mode';
import {cupFromRig, PHOTO_CAM, PhotoWorld, subjectRig, SUBJECT_X, TakeawayCup} from '../world/PhotoWorld';
import {IMG_OFFSET_Y, PHOTO, PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Hallway, DRAWER_HANDLE} from '../world/Hallway';
import {Ink} from '../world/Ink';
import {Stickman} from '../world/Stickman';
import {cloneRig} from '../world/rig';
import {lookAtPhoto, pullDrawer} from '../world/props';
import {TitleCard} from '../overlay/Kinetic';
import {Figure, qWorld, toFig, toWorld} from './common';
import {AT_BOARD, FX} from './hook';
import {CardInVoid, voidCam} from './thing1';
import {photoCamAt, photoStateAt} from './story';
import {BOARD_CAM, easeInOut, easeOut, handheld, lerp, lin, seg, ShotFn, v3} from './types';

const PI = Math.PI;
const VOID_X = 400;

const T4_title: ShotFn = (c) => ({
	cam: voidCam(PHOTO.h * 1.9),
	m: 0,
	world: <CardInVoid />,
	photo: photoStateAt(c.t),
	fx: {exposure: 0.6},
	overlay: <TitleCard t={c.t} t0={c.start} t1={c.end} n={4} title="IT WILL BE WARM" frame={c.frame} />,
});

const LiveCard: React.FC<{p: THREE.Vector3; q: THREE.Quaternion; glow?: number; develop?: number}> = ({p, q, glow, develop}) => {
	const tex = usePhotoTex();
	return <PhotoCard map={tex} position={p} quaternion={q} glow={glow} develop={develop} />;
};

// ---------------- warm: glows in his hands, develops like a fresh print ----------------
const T4_warm: ShotFn = (c) => {
	const f = AT_BOARD;
	const a = lookAtPhoto(c.t, {});
	const p = toWorld(f, a.card.p);
	const q = qWorld(f, a.card.q);
	const develop = 0.12 + 0.88 * easeInOut(lin(c.t, at('L060.ss') + 0.1, at('L060.w8')));
	const orbit = easeInOut(c.p);
	const cam: CamSpec = {target: [p.x, p.y + 0.02, p.z], yaw: lerp(-0.75, 0.35, orbit), pitch: lerp(0.62, 0.5, orbit), frameH: lerp(0.62, 0.44, orbit), fov3d: 36};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" lamp={0.6} />
				<Figure f={f} rig={a.rig} />
				<LiveCard p={p} q={q} glow={0.55} develop={develop} />
				<pointLight position={[p.x, p.y + 0.12, p.z + 0.1]} intensity={0.22} distance={1.0} decay={1.6} color="#ffc070" />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.3),
		fx: {warm: 0.05, bloom: 1.0},
	};
};

// ---------------- the flat figure steps out of the photograph ----------------
// project a point of the photographed scene onto the card, through the photo's own camera
const projector = (spec: CamSpec) => {
	const cam = new THREE.PerspectiveCamera();
	applyCam(cam, camFor(spec, 0, 16 / 9));
	return (p: THREE.Vector3) => {
		const v = p.clone().project(cam);
		return v3((v.x * PHOTO.w) / 2, (v.y * PHOTO.h) / 2 + IMG_OFFSET_Y, 0);
	};
};

const T4_popout: ShotFn = (c) => {
	const lt = c.lt;
	const out = easeInOut(lin(lt, 0.9, 2.8));
	const s = photoStateAt(c.t);
	const rig = subjectRig(s);
	const cup = cupFromRig(rig, s);
	const PROJ = projector(photoCamAt(c.t));
	const foot = PROJ(v3(SUBJECT_X, 0, 0));
	const SCALE_IN_PHOTO = PROJ(v3(SUBJECT_X, 1.0, 0)).y - foot.y;
	const sc = SCALE_IN_PHOTO * lerp(1, 1.3, out);
	const pos = v3(VOID_X + foot.x + 0.01 * out, foot.y - 0.004 * out, 0.0015 + 0.07 * out);
	const m = 0.75 * out;
	const cam: CamSpec = {target: [VOID_X + foot.x * 0.6, IMG_OFFSET_Y + 0.02 * out, 0.02 * out], yaw: 0.55 * out, pitch: 0.06 * out, frameH: lerp(PHOTO.h * 1.3, PHOTO.h * 1.55, out), fov3d: 30};
	const popped = lt >= 0.9;
	return {
		cam,
		m,
		world: (
			<>
				<CardInVoid />
				{popped ? (
					<group position={pos} rotation={[0, PHOTO_CAM.yaw * -1 * (1 - out), 0]} scale={sc}>
						<Stickman rig={rig} scarf={s.scarf} flat={1 - out} glow={0.15 * out} />
						<TakeawayCup position={cup.p} tilt={cup.tilt} flat={1 - out} />
					</group>
				) : null}
				<ambientLight intensity={0.9} color="#8496ad" />
				<directionalLight position={[VOID_X + 0.4, 0.5, 0.6]} intensity={1.6} color="#ffd9a8" castShadow shadow-camera-left={-0.4} shadow-camera-right={0.4} shadow-camera-top={0.4} shadow-camera-bottom={-0.4} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
			</>
		),
		photo: s,
		photoOpts: {hideSubject: popped},
		fx: {bloom: 1.1},
		overlay: <Developing t={c.t} />,
	};
};

// "The photograph is not finished. Neither is the moment.": a print bar that stops short
const Developing: React.FC<{t: number}> = ({t}) => {
	const t0 = at('L062.ss') - 0.1;
	const tFin = at('L062.w4');
	const tMom = at('L062.w5');
	if (t < t0) return null;
	const a = seg(t, t0, t0 + 0.25);
	const fill = Math.min(0.97, 0.97 * easeOut(lin(t, t0, tFin)));
	const stuck = t > tFin;
	const blink = Math.floor(t * 3) % 2 === 0;
	const label = t < tMom ? 'PRINTING' : 'MOMENT';
	const status = t < tFin ? `${Math.round(fill * 100)}%` : t < tMom ? '97%' : 'IN PROGRESS';
	return (
		<div style={{position: 'absolute', left: 28, top: 52, width: 300, opacity: a, fontFamily: 'JetBrains Mono'}}>
			<div style={{display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, letterSpacing: 3, color: stuck ? C.amber : '#c9d1da'}}>
				<span>{label}</span>
				<span style={{opacity: stuck && t < tMom && !blink ? 0.3 : 1}}>{status}</span>
			</div>
			<div style={{marginTop: 7, height: 6, borderRadius: 3, background: '#ffffff1a'}}>
				<div style={{width: `${(t < tMom ? fill : 0.97) * 100}%`, height: 6, borderRadius: 3, background: stuck ? C.amber : '#F4F6F8', boxShadow: `0 0 10px ${stuck ? C.amber : '#ffffff88'}`}} />
			</div>
		</div>
	);
};

// ---------------- the list ----------------
const T4_list: ShotFn = (c) => {
	const lt = c.lt;
	const hl = seg(lt, 0.7, 1.4);
	return {
		cam: {...BOARD_CAM, frameH: 9 * (1 - 0.04 * c.p)},
		m: 0,
		world: (
			<Board
				draw={(ctx, W, H) => {
					bg(ctx, W, H);
					noticeCard(ctx, W / 2, H / 2 - 20, 720, 420, {
						header: 'BUILDING NOTICE 003',
						title: 'THE LIST',
						lines: [
							['1  [x]', 'TAKEN FROM FAR AWAY'],
							['2  [x]', 'WILL NOT STAY THE SAME'],
							['3  [x]', 'NOT ALONE IN IT'],
							['4  [x]', 'IT IS WARM'],
						],
						hl: 3,
						highlight: hl,
						footer: 'MOST UNSETTLING: ITEM 4',
					});
				}}
			/>
		),
	};
};

// ---------------- do not put it in a drawer ----------------
const T4_drawer: ShotFn = (c) => {
	const lt = c.lt;
	const f = AT_BOARD;
	const afraid = at('L065.ss') - c.start;
	const keep = at('L066.ss') - c.start;
	const open = easeInOut(lin(lt, 0.2, 1.2)) * (1 - easeInOut(lin(lt, keep + 0.1, keep + 0.9)));
	const handleFig = toFig(f, DRAWER_HANDLE);
	const d = pullDrawer(c.t, open, handleFig, 0.24);
	// drawer handle moves with the drawer: pullDrawer already puts the hand there
	const r = cloneRig(d.rig);
	// the other hand holds the photograph over the open drawer, hesitates, then lifts it to look
	const hover = seg(lt, 1.0, 1.7) * (1 - seg(lt, keep + 0.4, keep + 1.2));
	const lookUp = seg(lt, keep + 0.6, keep + 1.6);
	const cardP = v3(lerp(0.18, 0.08, hover), lerp(1.05, 0.95, hover) + 0.22 * lookUp, lerp(0.28, 0.42, hover) - 0.05 * lookUp);
	const cardQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(lerp(-0.9, -1.35, hover), PI, 0.15, 'YXZ'));
	const pinch = cardP.clone().add(v3(-0.1, -0.06, 0).applyQuaternion(cardQ));
	r.handL.copy(pinch);
	r.gripL = 'pinch';
	r.elbowL.set(0.5, 0.8, -0.2);
	r.headPitch = lerp(0.5, 0.6, hover);
	if (lookUp > 0) {
		const up = lookAtPhoto(c.t, {});
		r.pelvis.lerp(up.rig.pelvis, lookUp);
		r.lean = lerp(r.lean, up.rig.lean, lookUp);
		r.kneeL.lerp(up.rig.kneeL, lookUp);
		r.kneeR.lerp(up.rig.kneeR, lookUp);
		r.handR.lerp(up.rig.handR, lookUp);
		r.gripR = lookUp > 0.5 ? 'pinch' : r.gripR;
	}
	const drawerOpen = d.open;
	const cam: CamSpec = {target: [FX + 0.2, 0.95, -1.05], yaw: 0.6, pitch: 0.42, frameH: lerp(1.35, 1.1, c.p), fov3d: 36};
	const dip = lt > afraid && lt < afraid + 2.4;
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" drawer={drawerOpen} />
				<Figure f={f} rig={r} />
				<LiveCard p={toWorld(f, cardP)} q={qWorld(f, cardQ)} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.35),
		fx: {exposure: dip ? 0.92 : 1},
	};
};

// ---------------- the only photograph still happening ----------------
const T4_happening: ShotFn = (c) => {
	const base = photoCamAt(c.t);
	const face: CamSpec = {...base, frameH: base.frameH * 0.82};
	return {
		cam: lerpCam(base, face, easeInOut(c.p)),
		m: 0,
		// a photograph does not breathe, this one does: the rain is still falling inside it
		world: <PhotoWorld s={{...photoStateAt(c.t), frozen: false}} />,
		fx: {vignette: 0.4},
	};
};

export const THING4: Record<string, ShotFn> = {
	T4_title,
	T4_warm,
	T4_popout,
	T4_list,
	T4_drawer,
	T4_happening,
};
export {Ink, easeOut, C};
