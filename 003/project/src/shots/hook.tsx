import React from 'react';
import * as THREE from 'three';
import {at, shotEnd, shotStart} from '../events';
import {Hallway, HALL, BOOK_POS} from '../world/Hallway';
import {CARD_H, CARD_W, IMG_OFFSET_Y, PHOTO, PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Arm} from '../world/Arm';
import {Ink} from '../world/Ink';
import {Board, bg, C, hexA, mono, noticeCard, text} from '../world/Board';
import {CamSpec, lerpCam} from '../world/mode';
import {cloneRig, idle, laugh} from '../world/rig';
import {lookAtPhoto, photoCorners} from '../world/props';
import {Bar, Fig, Figure, Label, Photographer, qWorld, toFig, toWorld} from './common';
import {photoStateAt} from './story';
import {BOARD_CAM, Ctx, easeIn, easeInOut, easeOut, handheld, lerp, lin, Out, seg, ShotFn, sm, v3} from './types';
import {Kinetic} from '../overlay/Kinetic';
import {roundRect} from '../world/textures';

const PI = Math.PI;
const flatDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0));
const COVER_Y = HALL.boardTop + 0.048 + 0.0016;
const INSIDE_Y = HALL.boardTop + 0.024;
const BOARD_Y = HALL.boardTop + 0.0016;
const imgCentreOf = (p: THREE.Vector3, q: THREE.Quaternion) => p.clone().add(new THREE.Vector3(0, IMG_OFFSET_Y, 0).applyQuaternion(q));

// where he stands at the sideboard, facing the back wall
export const FX = -0.05;
export const AT_BOARD: Fig = {pos: v3(FX, 0, -0.93), yaw: PI};
export const FACING_ROOM: Fig = {pos: v3(FX, 0, -0.84), yaw: 0};

export const Card: React.FC<{p: THREE.Vector3; q: THREE.Quaternion; glow?: number; back?: boolean}> = ({p, q, glow, back}) => {
	const tex = usePhotoTex();
	return <PhotoCard map={tex} position={p} quaternion={q} glow={glow} back={back} />;
};

// ---------------- H01: the arm slides the photograph out of the book ----------------
const H01: ShotFn = (c) => {
	const lt = c.lt;
	const inside = v3(BOOK_POS.x + 0.07, INSIDE_Y, BOOK_POS.z);
	const out = v3(BOOK_POS.x + 0.4, BOARD_Y, BOOK_POS.z + 0.01);
	const onCover = v3(BOOK_POS.x, COVER_Y, BOOK_POS.z);
	let p = inside.clone();
	let rot = 0;
	const slide = easeInOut(lin(lt, 0.8, 2.0));
	p.lerpVectors(inside, out, slide);
	p.y = lerp(INSIDE_Y, BOARD_Y, seg(lt, 1.7, 2.0));
	rot = -0.06 * slide;
	const place = easeInOut(lin(lt, 2.1, 2.7));
	if (lt > 2.1) {
		p = out.clone().lerp(onCover, place);
		p.y = lerp(BOARD_Y, COVER_Y, place) + 0.06 * Math.sin(PI * place);
		rot = -0.06 * (1 - place);
	}
	const q = flatDown.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), rot));
	// pinch point: right edge middle of the card
	const pinch = p.clone().add(v3(CARD_W / 2 - 0.012, 0.012, 0).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), rot)));
	const root = v3(0.98, 1.0, -1.18);
	const away = v3(0.78, 0.95, -1.12);
	const reach = easeOut(lin(lt, 0.2, 0.75));
	const leave = easeInOut(lin(lt, 2.8, 3.3));
	const target = away.clone().lerp(pinch, reach).lerp(away.clone().add(v3(0.1, 0, 0)), leave);
	const grip = reach > 0.95 && leave < 0.1 ? 'pinch' : 'open';
	// camera: top down, flat; then push in until the image fills the frame
	const img = imgCentreOf(onCover, flatDown);
	const wide: CamSpec = {target: [BOOK_POS.x + 0.13, BOARD_Y, BOOK_POS.z + 0.02], yaw: 0, pitch: PI / 2, flatPitch: PI / 2, frameH: 0.6, clip: 0.62};
	const fill: CamSpec = {target: [img.x, img.y, img.z], yaw: 0, pitch: PI / 2, flatPitch: PI / 2, frameH: PHOTO.h * 0.985, clip: 0.62};
	const push = easeInOut(lin(lt, 2.75, 3.7));
	const cam = lerpCam(wide, fill, push);
	cam.frameH *= 1 - 0.02 * lin(lt, 3.7, c.dur);
	cam.flatPitch = PI / 2;
	return {
		cam,
		m: 0,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Card p={p} q={q} />
				<Arm root={root} target={target} pole={v3(0.9, 1.4, -0.7)} grip={grip} />
			</>
		),
		photo: photoStateAt(c.t),
		fx: {vignette: 0.32},
	};
};

export const povSpec = (eye: THREE.Vector3, target: THREE.Vector3, fov: number, yawOff = 0, pitchOff = 0): CamSpec => {
	const d = target.clone().sub(eye);
	const len = d.length();
	const yaw = Math.atan2(-d.x, -d.z) + yawOff;
	const pitch = Math.asin(-d.y / len) + pitchOff;
	return {target: [target.x, target.y, target.z], yaw, pitch, frameH: 2 * len * Math.tan(((fov / 2) * PI) / 180), fov3d: fov, clip: 1e5};
};

// ---------------- H02a: do not throw it away ----------------
// Hidden cut on the full frame photo: it is now pinched over an open pedal bin.
// The camera lifts off the flat photo into the 3D hallway; on "away" he pulls it back.
export const BIN = {x: 0.19, z: -0.61, r: 0.12, h: 0.4};
const BIN_FIG: Fig = {pos: v3(0.55, 0, -0.75), yaw: 0};
export const PedalBin: React.FC<{open: number}> = ({open}) => (
	<group position={[BIN.x, 0, BIN.z]}>
		<Ink shape={['cyl', BIN.r, BIN.r * 0.9, BIN.h, 32]} color="#77818e" position={[0, BIN.h / 2, 0]} outline cast receive />
		<Ink shape={['cyl', BIN.r * 0.93, BIN.r * 0.93, 0.004, 32]} color="#07090c" position={[0, BIN.h - 0.012, 0]} />
		{[
			[0.03, 0.02, 0.028],
			[-0.04, -0.03, 0.024],
			[0.0, -0.05, 0.022],
		].map(([x, z, r], i) => (
			<Ink key={i} shape={['sphere', r]} color={i === 1 ? '#c9c1ae' : '#d9dde2'} position={[x, BIN.h - 0.03, z]} outline />
		))}
		<Ink shape={['rbox', 0.08, 0.014, 0.05, 0.004]} color="#2b323c" position={[BIN.r + 0.025, 0.035 - 0.012 * open, 0]} outline />
		{/* lid hinged on the far side, lifted by the pedal */}
		<group position={[-BIN.r, BIN.h, 0]} rotation={[0, 0, 1.75 * open]}>
			<Ink shape={['cyl', BIN.r * 1.02, BIN.r * 1.02, 0.018, 32]} color="#8b97a5" position={[BIN.r, 0.009, 0]} outline cast />
		</group>
	</group>
);

const H02_bin: ShotFn = (c) => {
	const lt = c.lt;
	const f = BIN_FIG;
	// the hand freezes on "throw" and pulls the photo back after "away"
	const tW = at('L002.w2') - c.start;
	const tA = at('L002.w4') - c.start;
	const lower = easeInOut(lin(lt, 0.25, tW + 0.05));
	const back = easeInOut(lin(lt, tA + 0.05, tA + 0.45));
	const tremble = 0.003 * Math.sin(lt * 31) * seg(lt, tW, tA) * (1 - back);
	const hold = v3(-0.36, 0.9, 0.14);
	const low = v3(-0.36, 0.66, 0.14);
	const chest = v3(-0.06, 1.12, 0.27);
	const cp = hold.clone().lerp(low, lower).lerp(chest, back);
	cp.y += tremble;
	// the far edge droops as if about to be let go, then tips up toward his face
	const droop = lerp(lerp(0.04, 0.34, lower), -0.55, back);
	const cqL = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), droop).multiply(flatDown);
	const card = {p: cp, q: cqL};
	const pin = photoCorners(card).rm;
	const r = idle(c.t);
	r.handR.copy(pin);
	r.gripR = 'pinch';
	r.elbowR.set(-0.55, 0.95, -0.2);
	r.headPitch = lerp(0.55, 0.42, back);
	r.headYaw = lerp(-0.55, -0.2, back);
	r.lean = 0.08 * (1 - back) + 0.02;
	// right foot on the pedal until he pulls the photo back
	const off = seg(lt, tA + 0.2, tA + 0.32);
	const pedal = toFig(f, v3(BIN.x + BIN.r + 0.03, 0.03, BIN.z));
	r.footR.copy(pedal.clone().add(v3(-0.05 * off, -0.03 * off, -0.06 * off)));
	r.footR.y = 0.03 * (1 - off);
	r.kneeR.set(-0.2, 0.5, 1.0);
	const open = 1 - easeIn(off);
	const cardW = toWorld(f, cp);
	const qW = qWorld(f, cqL);
	const img = imgCentreOf(cardW, qW);
	const top: CamSpec = {target: [img.x, img.y, img.z], yaw: 0, pitch: PI / 2, flatPitch: PI / 2, flatYaw: 0, frameH: PHOTO.h * 0.985 * 0.98, clip: 1e5};
	const wide: CamSpec = {target: [0.21, 0.56, -0.62], yaw: -0.1, pitch: 1.15, frameH: 0.88, fov3d: 36, clip: 1e5};
	const k = easeInOut(lin(lt, 0.0, 0.9));
	const cam = lerpCam(top, wide, k);
	cam.flatPitch = PI / 2;
	cam.flatYaw = 0;
	cam.frameH *= 1 - 0.08 * lin(lt, 0.9, c.dur);
	return {
		cam,
		m: k,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<PedalBin open={open} />
				<pointLight position={[0.0, 1.5, 0.1]} intensity={0.9} distance={3} decay={1.5} color="#ffd9b0" />
				<Figure f={f} rig={r} />
				<Card p={cardW} q={qW} back={false} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: k > 0.9 ? handheld(c.t, 0.3) : undefined,
	};
};

// ---------------- H02b: do not show it to anyone ----------------
// He turns it round and holds it out to us. On "anyone" it goes behind his back.
const H02_show: ShotFn = (c) => {
	const lt = c.lt;
	const f: Fig = {pos: v3(0.32, 0, -0.72), yaw: -0.22};
	const tAny = at('L002.w10') - c.start;
	const out = easeInOut(lin(lt, 0.0, 0.62));
	const hide = easeInOut(lin(lt, tAny - 0.05, tAny + 0.38));
	// one hand, pinching the bottom edge; the wrist turns the card about that point
	const chest = v3(-0.02, 1.06, 0.3);
	const held = v3(-0.06, 1.2, 0.5);
	const side = v3(-0.42, 1.0, 0.18);
	const behind = v3(-0.13, 0.98, -0.2);
	let hp = chest.clone().lerp(held, out);
	if (hide > 0) {
		const a = held.clone().lerp(side, hide);
		const b = side.clone().lerp(behind, hide);
		hp = a.lerp(b, hide);
	}
	const yawC = lerp(PI, 0, out) + lerp(0, -PI * 0.9, hide);
	const tilt = lerp(0.95, 0.06, out) * (1 - hide);
	const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, yawC, 0.04 * out * (1 - hide), 'YXZ'));
	const cp = hp.clone().add(v3(0, CARD_H / 2 - 0.006, 0).applyQuaternion(q));
	const r = idle(c.t);
	r.handR.copy(hp);
	r.gripR = 'pinch';
	r.elbowR.set(-0.6, 0.9, hide > 0.3 ? -0.4 : 0.1);
	// the other hand lets go as he turns it
	const two = 1 - seg(lt, 0.0, 0.35);
	r.handL.lerp(photoCorners({p: cp, q}).br, two);
	r.gripL = two > 0.5 ? 'pinch' : 'open';
	r.headPitch = lerp(0.5, 0.0, out) + 0.12 * hide;
	r.headYaw = 0.35 * hide;
	r.shrug = 0.03 * seg(lt, tAny, tAny + 0.2) * (1 - seg(lt, tAny + 0.5, tAny + 0.9));
	r.lean = 0.02 - 0.05 * hide;
	r.expr = lt > tAny - 0.05 && lt < tAny + 0.45 ? 'o' : 'blank';
	r.mouth = 0.4;
	const cam: CamSpec = {target: [0.27, 1.36, -0.45], yaw: -0.12, pitch: 0.03, frameH: lerp(1.16, 1.0, easeInOut(lin(lt, 0.1, 0.9))), fov3d: 32};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<pointLight position={[0.4, 1.8, 0.6]} intensity={1.4} distance={4} decay={1.5} color="#ffd9b0" />
				<Figure f={f} rig={r} />
				<Card p={toWorld(f, cp)} q={qWorld(f, q)} back={false} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.3),
	};
};

// ---------------- H02c: do not try to remember when it happened ----------------
// Eyes shut, hand to the temple; a flat calendar riffles backwards over his head,
// faster and faster, and the room flattens with the effort. On "happened" it jams.
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// page n counts backwards from a Tuesday, 14 October
const pageDate = (n: number) => {
	let d = 14 - n;
	let mo = 9;
	while (d < 1) {
		mo = (mo + 11) % 12;
		d += MDAYS[mo];
	}
	return {d, mo, wd: (((2 - n) % 7) + 7) % 7};
};
const drawPage = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, squash = 1, shade = 0) => {
	const {d, mo, wd} = pageDate(n);
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(1, squash);
	ctx.fillStyle = '#ece6d8';
	roundRect(ctx, 0, 0, w, h, 10);
	ctx.fill();
	ctx.fillStyle = '#c43a1a';
	ctx.fillRect(0, 0, w, h * 0.2);
	text(ctx, MONTHS[mo], w / 2, h * 0.1, {size: h * 0.12, color: '#ece6d8', weight: 700, font: '"JetBrains Mono"'});
	text(ctx, String(d), w / 2, h * 0.56, {size: h * 0.45, color: '#2b2f36', weight: 800});
	text(ctx, DAYS[wd], w / 2, h * 0.86, {size: h * 0.1, color: '#6b6f76', weight: 500, font: '"JetBrains Mono"', ls: 5});
	if (shade > 0) {
		ctx.fillStyle = `rgba(0,0,0,${shade})`;
		ctx.fillRect(0, 0, w, h);
	}
	ctx.restore();
};
// pages flipped by time lt: the rate climbs from 3 to 16 pages a second
const riffle = (lt: number, t0: number, t1: number) => {
	const x = Math.max(0, lt - t0);
	const span = t1 - t0;
	const k = Math.min(x, span);
	const n = 3 * k + (13 * k * k) / (2 * span) + (x > span ? 16 * (x - span) : 0);
	return n;
};
const H02_remember: ShotFn = (c) => {
	const lt = c.lt;
	const f: Fig = {pos: v3(FX + 0.05, 0, -0.84), yaw: 0.18};
	const tTry = at('L003.w3') - c.start;
	const tJam = at('L003.w8') - c.start;
	const think = seg(lt, 0.0, 0.45) * (1 - seg(lt, tJam + 0.25, tJam + 0.6));
	const r = idle(c.t);
	// photo low in the left hand, right fingertips to the temple
	const cardQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, PI - 0.25, 0, 'YXZ'));
	const cardP = v3(0.2, 0.93, 0.2);
	r.handL.copy(cardP.clone().add(v3(0.02, -CARD_H / 2 + 0.006, 0).applyQuaternion(cardQ)));
	r.gripL = 'pinch';
	r.elbowL.set(0.5, 0.9, -0.3);
	const temple = v3(-0.15, 1.69, 0.06);
	r.handR.lerp(temple, think);
	r.elbowR.set(-0.6, 1.2, 0.3);
	r.gripR = think > 0.5 ? 'pinch' : 'open';
	r.headPitch = lerp(0.04, -0.22, think);
	r.headYaw = 0.25 * think;
	r.headRoll = -0.06 * think;
	r.expr = think > 0.4 && lt < tJam + 0.1 ? 'closed' : 'blank';
	r.blink = r.expr === 'closed' ? 1 : r.blink;
	// after the jam: a small shake of the head
	const shake = seg(lt, tJam + 0.15, tJam + 0.3) * (1 - seg(lt, tJam + 0.5, tJam + 0.7));
	r.headYaw += 0.12 * Math.sin((lt - tJam) * 22) * shake;
	// the room flattens while he strains, snaps back on the jam
	const m = 1 - 0.6 * seg(lt, tTry - 0.3, tJam) * (1 - seg(lt, tJam + 0.05, tJam + 0.3));
	const n = riffle(lt, 0.2, tJam);
	const jam = lt >= tJam;
	const nShow = jam ? riffle(tJam, 0.2, tJam) : n;
	const page = Math.floor(nShow);
	const frac = jam ? 0.5 + 0.04 * Math.sin(lt * 60) * (1 - seg(lt, tJam, tJam + 0.3)) : nShow - page;
	const boardIn = easeOut(lin(lt, 0.05, 0.4));
	const boardOut = easeIn(lin(lt, tJam + 0.3, tJam + 0.5));
	const bs = boardIn * (1 - boardOut);
	const head = toWorld(f, v3(0.0, 1.66, 0.0));
	const bp = head.clone().add(v3(0.34, 0.33, 0.02));
	const cam: CamSpec = {target: [FX + 0.22, 1.74, -0.8], yaw: 0.02, pitch: -0.06, frameH: lerp(1.3, 1.16, easeInOut(c.p)), fov3d: 34};
	return {
		cam,
		m,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<pointLight position={[0.4, 1.8, 0.6]} intensity={1.4} distance={4} decay={1.5} color="#ffd9b0" />
				<Figure f={f} rig={r} />
				<Card p={toWorld(f, cardP)} q={qWorld(f, cardQ)} back={false} />
				{bs > 0.001 ? (
					<group position={bp} scale={bs}>
						{[0.07, 0.13].map((s, i) => (
							<Ink key={i} shape={['sphere', 0.012 + 0.008 * i]} color="#e8ecf0" position={[-0.3 + 0.09 * i, -0.24 + 0.08 * i, 0]} flat={1} glow={0.2} />
						))}
						<Board
							w={0.5}
							h={0.4}
							px={[500, 400]}
							transparent
							glow={0.18}
							draw={(ctx, w, h) => {
								ctx.fillStyle = 'rgba(232,236,240,0.94)';
								roundRect(ctx, 6, 6, w - 12, h - 12, 60);
								ctx.fill();
								const pw = 230;
								const ph = 260;
								const px = (w - pw) / 2;
								const py = 70;
								// the page beneath, then the one flipping up off it
								drawPage(ctx, px, py, pw, ph, page + 1);
								if (frac > 0.02) {
									const sq = Math.cos(Math.PI * Math.min(frac, 0.98));
									drawPage(ctx, px, py, pw, ph, page, Math.max(0.02, Math.abs(sq)), frac > 0.5 ? 0.35 : 0);
								} else drawPage(ctx, px, py, pw, ph, page);
								// rings
								for (let i = 0; i < 5; i++) {
									ctx.fillStyle = '#3a4452';
									roundRect(ctx, px + 30 + i * 40, py - 12, 10, 24, 5);
									ctx.fill();
								}
								if (jam) {
									ctx.globalAlpha = seg(lt, tJam, tJam + 0.12);
									text(ctx, '?', w - 70, 62, {size: 70, color: C.amber, glow: 14});
									ctx.globalAlpha = 1;
								}
							}}
						/>
					</group>
				) : null}
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.3),
		fx: jam ? {glitch: 0.5 * (1 - seg(lt, tJam, tJam + 0.2)), rgb: 0.5 * (1 - seg(lt, tJam, tJam + 0.2))} : undefined,
	};
};

// ---------------- H02d: point of view. You already looked at it twice ----------------
const H02_twice: ShotFn = (c) => {
	const lt = c.lt;
	const f = AT_BOARD;
	const held = lookAtPhoto(c.t, {dist: 0.32, tilt: 1.05});
	const p = toWorld(f, held.card.p);
	const q = qWorld(f, held.card.q);
	// the gaze goes to the window and back, twice
	const l = at('L004.ss') - c.start;
	const glance = Math.max(seg(lt, l - 0.15, l + 0.1) * (1 - seg(lt, l + 0.3, l + 0.5)), seg(lt, l + 0.6, l + 0.82) * (1 - seg(lt, l + 1.0, l + 1.22)));
	const eye = toWorld(f, v3(0, 1.64, 0.1));
	const cam = povSpec(eye, imgCentreOf(p, q), 52, -0.75 * glance, -0.32 * glance);
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Figure f={f} rig={held.rig} hideHead />
				<Card p={p} q={q} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.45),
	};
};

// ---------------- H03: he holds it beside his face ----------------
const compareRig = (t: number, look: number) => {
	const r = idle(t);
	const cardP = v3(-0.27, 1.6, 0.13);
	const cardQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, 0.22, 0.03));
	const bottom = cardP.clone().add(v3(0.02, -CARD_H / 2 + 0.004, 0.0).applyQuaternion(cardQ));
	r.handR.copy(bottom.add(v3(0, -0.012, 0)));
	r.gripR = 'pinch';
	r.elbowR.set(-0.55, 1.0, 0.1);
	r.headYaw = -0.32 * look;
	r.headPitch = 0.02;
	return {rig: r, cardP, cardQ};
};

const H03: ShotFn = (c) => {
	const f = FACING_ROOM;
	const l006 = at('L006.ss') - c.start;
	const look = seg(c.lt, 0.15, 0.7) * (1 - seg(c.lt, l006 - 0.2, l006 + 0.2));
	const {rig, cardP, cardQ} = compareRig(c.t, look);
	const cam: CamSpec = {target: [FX - 0.16, 1.56, -0.8], yaw: 0.04, pitch: 0.02, frameH: lerp(0.98, 0.86, easeOut(c.p)), fov3d: 32};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<pointLight position={[0.4, 1.8, 0.6]} intensity={1.6} distance={4} decay={1.5} color="#ffd9b0" />
				<Figure f={f} rig={rig} />
				<Card p={toWorld(f, cardP)} q={qWorld(f, cardQ)} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.3),
	};
};

// ---------------- H04: you have your own ears ----------------
const H04: ShotFn = (c) => {
	const f = FACING_ROOM;
	const {rig, cardP, cardQ} = compareRig(c.t, 0);
	// the photo comes down; a hand rises to where an ear would be
	const down = easeInOut(lin(c.lt, 0.0, 0.5));
	const cp = cardP.clone().lerp(v3(-0.2, 1.05, 0.2), down);
	const cq = cardQ.clone().slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0.1, 0)), down);
	const bottom = cp.clone().add(v3(0.02, -CARD_H / 2 + 0.004, 0).applyQuaternion(cq));
	rig.handR.copy(bottom.add(v3(0, -0.012, 0)));
	const up = easeInOut(lin(c.lt, 0.25, 0.95));
	const ear = v3(0.12 + 0.045, 1.62, 0.0);
	rig.handL.lerp(ear, up);
	rig.elbowL.set(0.6, 1.1, 0.2);
	rig.gripL = 'pinch';
	rig.headYaw = 0.0;
	rig.headRoll = -0.05 * up;
	const cam: CamSpec = {target: [FX, 1.6, -0.8], yaw: 0.02, pitch: 0.02, frameH: lerp(0.6, 0.55, c.p), fov3d: 30};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<pointLight position={[0.4, 1.8, 0.6]} intensity={1.6} distance={4} decay={1.5} color="#ffd9b0" />
				<Figure f={f} rig={rig} />
				<Card p={toWorld(f, cp)} q={qWorld(f, cq)} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.25),
	};
};

// ---------------- H05: flatten into the diagram, the photographer slides in ----------------
const H05: ShotFn = (c) => {
	const f = FACING_ROOM;
	const lt = c.lt;
	const m = 1 - easeInOut(lin(lt, 0.0, 0.85));
	const r = idle(c.t);
	r.headYaw = 0.4 * seg(lt, 1.2, 1.6);
	const close: CamSpec = {target: [FX, 1.6, -0.8], yaw: 0.02, pitch: 0.02, frameH: 0.55, fov3d: 30};
	const wide: CamSpec = {target: [FX - 1.0, 1.05, -0.82], yaw: 0, pitch: 0, frameH: 2.5, fov3d: 30};
	const cam = lerpCam(close, wide, easeInOut(lin(lt, 0.0, 0.9)));
	const boardA = seg(lt, 0.25, 0.85);
	const slide = easeOut(lin(lt, 0.55, 1.15));
	const ph: Fig = {pos: v3(FX + lerp(-4.2, -2.1, slide), 0, -0.84), yaw: PI / 2};
	const sight = seg(lt, 1.15, 1.75);
	const camPt: [number, number, number] = [ph.pos.x + 0.2, 1.62, -0.82];
	const youPt: [number, number, number] = [f.pos.x - 0.16, 1.58, -0.82];
	const end: [number, number, number] = [lerp(camPt[0], youPt[0], sight), lerp(camPt[1], youPt[1], sight), -0.82];
	return {
		cam,
		m,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Board
					position={[FX - 1.0, 1.15, -0.95]}
					w={9}
					h={5.06}
					opacity={boardA}
					draw={(ctx, w, h) => {
						bg(ctx, w, h, C.bg, {x: w * 0.62, y: h * 0.45, r: w * 0.5, color: '#1c2a3a', a: 0.5});
					}}
				/>
				{boardA > 0.98 ? null : null}
				<Bar a={[FX - 3.6, 0.0, -0.83]} b={[FX + 1.6, 0.0, -0.83]} w={0.012} color="#3a4452" />
				<Figure f={f} rig={r} />
				<Photographer f={ph} t={c.t} />
				{sight > 0 ? <Bar a={camPt} b={end} w={0.018} color={C.amber} dashed={0.09} glow={0.6} /> : null}
				<Label text="PHOTOGRAPHER" position={[ph.pos.x, -0.16, -0.8]} h={0.09} font='"JetBrains Mono"' weight={500} color="#8f9aa7" opacity={seg(lt, 1.0, 1.3)} ls={6} />
				<Label text="YOU" position={[f.pos.x, -0.16, -0.8]} h={0.09} font='"JetBrains Mono"' weight={500} color="#8f9aa7" opacity={seg(lt, 1.3, 1.6)} ls={6} />
			</>
		),
		photo: null,
	};
};

// ---------------- H06: flash, the far end of the hallway, he turns ----------------
const H06: ShotFn = (c) => {
	const f = AT_BOARD;
	const turnA = at('L009.w9') - c.start;
	const turn = easeInOut(lin(c.lt, turnA, turnA + 1.3));
	const held = lookAtPhoto(c.t, {});
	const r = held.rig;
	r.twist = -0.35 * turn;
	r.headYaw = -1.15 * turn;
	r.headPitch = lerp(r.headPitch, 0.05, turn);
	const cam: CamSpec = {target: [FX + 0.02, 1.25, -0.9], yaw: 0.05, pitch: 0.03, frameH: lerp(2.3, 1.55, easeInOut(c.p)), fov3d: 26};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Figure f={f} rig={r} />
				<Card p={toWorld(f, held.card.p)} q={qWorld(f, held.card.q)} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.55),
		fx: {vignette: 0.38},
	};
};

// ---------------- H07: a notice slides under the door and flips over ----------------
const NOTICE_W = 0.21;
const NOTICE_H = 0.297;
// top-down camera with yaw -PI/2: screen up is world +X, screen right is world +Z.
// Paper basis: text right -> +Z, text up -> +X, face -> +Y.
const PAPER_UP = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(0, 0, 1), v3(1, 0, 0), v3(0, 1, 0)));
const NOTICE_LINES: [string, string][] = [
	['SUBJECT', 'A PHOTOGRAPH OF YOU'],
	['FOUND', 'BETWEEN TWO PAGES'],
	['TAKEN BY', 'NOT YOU'],
	['DURATION', 'AS LONG AS YOU HOLD IT'],
];
const H07: ShotFn = (c) => {
	const lt = c.lt;
	const l011 = at('L011.ss') - c.start;
	const slide = easeOut(lin(lt, 0.15, 1.2));
	const px = lerp(HALL.w / 2 + 0.2, HALL.w / 2 - 0.42, slide);
	const flip = easeInOut(lin(lt, 1.55, 2.3));
	// face down while it slides in, then a page flip about the screen vertical axis
	const q = new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), PI * (1 - flip)).multiply(PAPER_UP);
	const paperP = v3(px, 0.0015 + 0.1 * Math.sin(PI * flip), 2.3);
	const low: CamSpec = {target: [HALL.w / 2 - 0.3, 0.05, 2.3], yaw: -PI / 2 + 0.25, pitch: 0.28, frameH: 0.55, fov3d: 36};
	const top: CamSpec = {target: [px, 0.0, 2.3], yaw: -PI / 2, pitch: PI / 2, flatYaw: -PI / 2, flatPitch: PI / 2, frameH: NOTICE_W * 1.08, fov3d: 36, clip: 0.4};
	const k = easeInOut(lin(lt, 1.3, 2.35));
	const cam = lerpCam(low, top, k);
	cam.flatPitch = PI / 2;
	cam.flatYaw = -PI / 2;
	const m = 1 - easeInOut(lin(lt, 1.8, 2.55));
	const hl = seg(lt, l011 + 1.1, l011 + 1.6);
	return {
		cam: {...cam, frameH: cam.frameH * (1 - 0.04 * lin(lt, 2.5, c.dur))},
		m,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<group position={paperP} quaternion={q}>
					<Board
						w={NOTICE_H}
						h={NOTICE_W}
						px={[1240, 877]}
						position={[0, 0, 0.0006]}
						draw={(ctx, w, hh) => {
							ctx.fillStyle = C.paper;
							ctx.fillRect(0, 0, w, hh);
							noticeCard(ctx, w / 2, hh / 2, w - 4, hh - 4, {header: 'BUILDING NOTICE 003', title: 'SHORT BRIEFING', rot: 0, lines: NOTICE_LINES, hl: 3, highlight: hl, s: 1.85});
						}}
					/>
					<group rotation={[0, PI, 0]}>
						<Board
							w={NOTICE_H}
							h={NOTICE_W}
							px={[1024, 724]}
							position={[0, 0, 0.0006]}
							draw={(ctx, w, hh) => {
								ctx.fillStyle = '#e4ddcc';
								ctx.fillRect(0, 0, w, hh);
								text(ctx, 'MANAGEMENT', w / 2, hh / 2, {size: 92, color: '#8a8f97', font: '"JetBrains Mono"', weight: 700, ls: 14});
							}}
						/>
					</group>
				</group>
			</>
		),
		photo: null,
		shake: m > 0.5 ? handheld(c.t, 0.3) : undefined,
	};
};

// ---------------- H08: check the corner ----------------
const H08: ShotFn = (c) => {
	const lt = c.lt;
	const line = seg(lt, 0.25, 0.75);
	const fade = 1 - seg(lt, 1.3, 1.9);
	return {
		cam: BOARD_CAM,
		m: 0,
		world: (
			<Board
				draw={(ctx, w, h) => {
					bg(ctx, w, h);
					ctx.save();
					ctx.globalAlpha = 0.35;
					noticeCard(ctx, w / 2 - 40 - 30 * lt, h / 2 + 20 + 20 * lt, 640, 420, {header: 'BUILDING NOTICE 003', title: 'SHORT BRIEFING', lines: NOTICE_LINES});
					ctx.restore();
				}}
			/>
		),
		overlay: (
			<svg width={1280} height={720} style={{position: 'absolute', inset: 0, opacity: fade}}>
				<line x1={640} y1={360} x2={640 + (1040 - 640) * line} y2={360 + (92 - 360) * line} stroke="#5CF2E6" strokeWidth={2.5} strokeDasharray="10 8" style={{filter: 'drop-shadow(0 0 6px #5CF2E6)'}} />
				<circle cx={640} cy={360} r={6} fill="#5CF2E6" opacity={line > 0 ? 1 : 0} />
			</svg>
		),
	};
};

// ---------------- H09: a few metres, forty metres, a zoom lens ----------------
const DX = 200; // diagram space, far from every set
const H09: ShotFn = (c) => {
	const lt = c.lt;
	const l014 = at('L014.ss') - c.start;
	const l015 = at('L015.ss') - c.start;
	const you: [number, number, number] = [DX + 2.2, 0, 0];
	const back = easeInOut(lin(lt, l014 - 0.1, l014 + 0.9));
	const dist = lerp(3, 40, back);
	const phX = you[0] - dist;
	const zoom = easeInOut(lin(lt, l014 - 0.05, l014 + 0.85));
	const near: CamSpec = {target: [DX + 0.65, 1.0, 0], yaw: 0, pitch: 0, frameH: 4.2};
	const far: CamSpec = {target: [you[0] - 21, 3.2, 0], yaw: 0, pitch: 0, frameH: 27};
	const cam = lerpCam(near, far, zoom);
	// the lens: telescopes out from the photographer's camera toward your face
	const lens = Math.max(0, (dist - 0.65 * lerp(1, 3.6, zoom) - 0.5) * easeInOut(lin(lt, l015 + 0.05, l015 + 2.1)));
	const youRig = idle(c.t);
	youRig.headYaw = -0.9 * seg(lt, l015 + 1.6, l015 + 2.1);
	const ph: Fig = {pos: v3(phX, 0, 0), yaw: PI / 2};
	const icon = lerp(1, 3.6, zoom); // diagram figures are icons: they stay readable when the view widens
	const lensLocal = lens / icon;
	const lblH = lerp(0.22, 1.3, zoom);
	const mid = (phX + you[0]) / 2;
	return {
		cam,
		m: 0,
		world: (
			<>
				<Bar a={[DX - 60, 0, -0.05]} b={[DX + 20, 0, -0.05]} w={0.02 * lerp(1, 6, zoom)} color="#2a3340" />
				<Figure f={{pos: v3(...you), yaw: -PI / 2 + 0.25}} rig={youRig} scale={icon} />
				<Photographer f={ph} t={c.t} lens={lensLocal} scale={icon} />
				<Bar a={[phX, -0.35 * lerp(1, 5, zoom), 0]} b={[you[0], -0.35 * lerp(1, 5, zoom), 0]} w={0.022 * lerp(1, 6, zoom)} color={back > 0.5 ? C.amber : C.white} glow={0.4} />
				<Bar a={[phX, -0.35 * lerp(1, 5, zoom) - 0.08 * lerp(1, 6, zoom), 0]} b={[phX, -0.35 * lerp(1, 5, zoom) + 0.08 * lerp(1, 6, zoom), 0]} w={0.022 * lerp(1, 6, zoom)} color={back > 0.5 ? C.amber : C.white} />
				<Bar a={[you[0], -0.35 * lerp(1, 5, zoom) - 0.08 * lerp(1, 6, zoom), 0]} b={[you[0], -0.35 * lerp(1, 5, zoom) + 0.08 * lerp(1, 6, zoom), 0]} w={0.022 * lerp(1, 6, zoom)} color={back > 0.5 ? C.amber : C.white} />
				<Label text={`${Math.round(dist)} m`} position={[mid, -0.75 * lerp(1, 5, zoom), 0.1]} h={lblH} color={back > 0.5 ? C.amber : C.white} glow={0.3} />
				<Label text="USUAL" position={[DX - 0.8 + 0.0, 2.35, 0.1]} h={0.16} font='"JetBrains Mono"' weight={500} color="#8f9aa7" opacity={1 - seg(lt, l014 - 0.3, l014)} ls={6} />
			</>
		),
		photo: null,
	};
};

// ---------------- H10: four things, each one closer ----------------
const H10: ShotFn = (c) => {
	const lt = c.lt;
	const l016b = at('L016.w4') - c.start; // "each one brings..."
	const steps = [l016b + 0.0, l016b + 0.55, l016b + 1.1, l016b + 1.65];
	const lit = steps.map((s) => (lt >= s ? 1 : 0));
	const n = lit.reduce((a: number, b: number) => a + b, 0);
	const dists = [40, 18, 6, 1.5, 0.3];
	const d = dists[n];
	const you: [number, number, number] = [DX + 2.2, 0, 0];
	// photographer jumps closer with each box
	const prevD = dists[Math.max(0, n - 1)];
	const since = n > 0 ? lt - steps[n - 1] : 1;
	const dd = n > 0 ? lerp(prevD, d, easeOut(since / 0.25)) : d;
	const ph: Fig = {pos: v3(you[0] - Math.max(0.65 * 3.6, dd), 0, 0), yaw: PI / 2};
	const frameH = lerp(27, 4.2, easeInOut(lin(lt, l016b - 0.1, l016b + 2.0)));
	const icon = lerp(3.6, 1, easeInOut(lin(lt, l016b - 0.1, l016b + 2.0)));
	const cam: CamSpec = {target: [lerp(you[0] - 21, DX + 0.8, easeInOut(lin(lt, l016b - 0.1, l016b + 2.0))), lerp(3.2, 1.2, easeInOut(lin(lt, l016b - 0.1, l016b + 2.0))), 0], yaw: 0, pitch: 0, frameH};
	return {
		cam,
		m: 0,
		world: (
			<>
				<Bar a={[DX - 60, 0, -0.05]} b={[DX + 20, 0, -0.05]} w={0.02 * (frameH / 4.2)} color="#2a3340" />
				<Figure f={{pos: v3(...you), yaw: -PI / 2 + 0.25}} rig={idle(c.t)} scale={icon} />
				<Photographer f={ph} t={c.t} scale={icon} />
			</>
		),
		overlay: (
			<div style={{position: 'absolute', top: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 26}}>
				{[0, 1, 2, 3].map((i) => {
					const s = lt - steps[i];
					const p = s >= 0 ? Math.min(1, s / 0.15) : 0;
					return (
						<div
							key={i}
							style={{
								width: 74,
								height: 74,
								borderRadius: 10,
								border: '3px solid #c9d1da',
								background: lit[i] ? '#F4F6F8' : 'rgba(6,8,11,0.6)',
								color: lit[i] ? '#06080B' : '#c9d1da',
								fontFamily: 'Montserrat',
								fontWeight: 800,
								fontSize: 40,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								transform: `scale(${lt < 0.15 * (i + 1) ? 0.9 : 1 + 0.12 * (1 - p) * (s >= 0 && s < 0.3 ? 1 : 0)})`,
								opacity: lt > 0.12 * i ? 1 : 0,
								boxShadow: lit[i] ? '0 0 22px rgba(255,255,255,0.45)' : 'none',
							}}
						>
							{i + 1}
						</div>
					);
				})}
			</div>
		),
		photo: null,
	};
};

// ---------------- H11: we need to talk about when ----------------
const H11: ShotFn = (c) => {
	const lt = c.lt;
	const spin = lt < 1.7 ? lt * lt * 9 : 1.7 * 1.7 * 9 + (lt - 1.7) * 0.0;
	const ping = at('L017.w8') - c.start;
	return {
		cam: BOARD_CAM,
		m: 0,
		world: (
			<Board
				draw={(ctx, w, h) => {
					bg(ctx, w, h, C.bg, {x: w / 2, y: h / 2 - 20, r: 380, color: '#1c2a3a', a: 0.6});
					const cx = w / 2;
					const cy = h / 2 - 30;
					const R = 150;
					ctx.save();
					ctx.strokeStyle = C.white;
					ctx.lineWidth = 8;
					ctx.beginPath();
					ctx.arc(cx, cy, R, 0, PI * 2);
					ctx.stroke();
					for (let i = 0; i < 12; i++) {
						const a = (i / 12) * PI * 2;
						ctx.lineWidth = i % 3 === 0 ? 7 : 3;
						ctx.beginPath();
						ctx.moveTo(cx + Math.sin(a) * (R - 14), cy - Math.cos(a) * (R - 14));
						ctx.lineTo(cx + Math.sin(a) * (R - (i % 3 === 0 ? 38 : 26)), cy - Math.cos(a) * (R - (i % 3 === 0 ? 38 : 26)));
						ctx.stroke();
					}
					const hand = (ang: number, len: number, wd: number, col: string) => {
						ctx.strokeStyle = col;
						ctx.lineWidth = wd;
						ctx.lineCap = 'round';
						ctx.beginPath();
						ctx.moveTo(cx, cy);
						ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len);
						ctx.stroke();
					};
					hand(-spin * 0.4 + 2.1, R * 0.55, 9, C.white);
					hand(-spin * 4.8 + 0.6, R * 0.8, 6, C.amber);
					ctx.fillStyle = C.white;
					ctx.beginPath();
					ctx.arc(cx, cy, 9, 0, PI * 2);
					ctx.fill();
					ctx.restore();
					const pq = lt - ping;
					if (pq > 0 && pq < 1.2) {
						ctx.save();
						ctx.globalAlpha = 1 - pq / 1.2;
						ctx.strokeStyle = C.amber;
						ctx.lineWidth = 3;
						ctx.beginPath();
						ctx.arc(cx, cy, R + 20 + pq * 160, 0, PI * 2);
						ctx.stroke();
						ctx.restore();
					}
					mono(ctx, 'TAKEN', cx, cy + R + 50, 16, C.grey, 'center', 6);
					text(ctx, lt > ping ? 'WHEN ?' : '', cx, cy + R + 92, {size: 40, color: C.amber, glow: 16});
				}}
			/>
		),
		photo: null,
	};
};

export const HOOK: Record<string, ShotFn> = {
	H01_book: H01,
	H02_bin,
	H02_show,
	H02_remember,
	H02_twice,
	H03_compare: H03,
	H04_ears: H04,
	H05_diagram: H05,
	H06_flash: H06,
	H07_notice: H07,
	H08_corner: H08,
	H09_distance: H09,
	H10_four: H10,
	H11_when: H11,
};

export {shotStart, shotEnd, Kinetic, hexA, Ink, laugh};
