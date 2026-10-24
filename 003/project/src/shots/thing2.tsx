import React, {useMemo} from 'react';
import * as THREE from 'three';
import {at} from '../events';
import {Board, bg, C, mono, text} from '../world/Board';
import {CamSpec, lerpCam} from '../world/mode';
import {PHOTO_CAM, PhotoWorld, SUBJECT_X} from '../world/PhotoWorld';
import {CARD_H, CARD_W, IMG_OFFSET_Y, PHOTO, PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Hallway, HALL, BOOK_POS} from '../world/Hallway';
import {Street, SHOP_X} from '../world/Street';
import {CallRoom, CALL_X, CALL_FRAME} from '../world/Rooms';
import {Ink} from '../world/Ink';
import {canvasTexture, redraw, roundRect, rand} from '../world/textures';
import {cloneRig, idle, sit, walk} from '../world/rig';
import {lookAtPhoto, Phone, PHONE, phoneUse, photoCorners, Thumb} from '../world/props';
import {TitleCard, Kinetic} from '../overlay/Kinetic';
import {Fig, Figure, qWorld, toFig, toWorld} from './common';
import {AT_BOARD, Card, FX} from './hook';
import {CardInVoid, IMG_FILL, voidCam} from './thing1';
import {photoCamAt, photoStateAt} from './story';
import {BOARD_CAM, bx, by, easeInOut, easeOut, handheld, lerp, lin, pop, seg, ShotFn, sm, v3} from './types';

const PI = Math.PI;
const flatDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0));
const COVER_Y = HALL.boardTop + 0.048 + 0.0016;

// ---------------- title ----------------
const T2_title: ShotFn = (c) => ({
	cam: voidCam(PHOTO.h * 1.9),
	m: 0,
	world: <CardInVoid />,
	photo: photoStateAt(c.t),
	fx: {exposure: 0.6},
	overlay: <TitleCard t={c.t} t0={c.start} t1={c.end} n={2} title="IT WILL NOT STAY THE SAME" frame={c.frame} />,
});

// ---------------- put it down, look away, look back ----------------
const T2_putdown: ShotFn = (c) => {
	const lt = c.lt;
	const f = AT_BOARD;
	const w = (i: number) => at(`L032.w${i}`) - c.start;
	const held = lookAtPhoto(c.t, {dist: 0.32, tilt: 1.05});
	const onCover = v3(BOOK_POS.x, COVER_Y, BOOK_POS.z);
	const down = easeInOut(lin(lt, w(0) - 0.3, w(2) + 0.3));
	const heldP = toWorld(f, held.card.p);
	const heldQ = qWorld(f, held.card.q);
	const p = heldP.clone().lerp(onCover, down);
	p.y += 0.04 * Math.sin(PI * down);
	const q = heldQ.clone().slerp(flatDown, down);
	const rig = cloneRig(held.rig);
	const let_go = easeInOut(lin(lt, w(2) + 0.3, w(3)));
	const rest = idle(c.t);
	const cw = photoCorners({p, q});
	rig.handL.copy(toFig(f, cw.bl)).lerp(rest.handL, let_go);
	rig.handR.copy(toFig(f, cw.br)).lerp(rest.handR, let_go);
	rig.lean = 0.02 + 0.12 * down * (1 - let_go);
	// look away (to the window), look back (at the photograph)
	const away = seg(lt, w(3), w(4) + 0.2) * (1 - seg(lt, w(5), w(6)));
	rig.headYaw = 1.05 * away;
	rig.headPitch = lerp(lerp(0.45, 0.55, down), 0.05, away);
	const side: CamSpec = {target: [FX - 0.05, 1.02, -1.18], yaw: 0.42, pitch: 0.58, frameH: 1.15, fov3d: 36};
	const img = onCover.clone().add(new THREE.Vector3(0, IMG_OFFSET_Y, 0).applyQuaternion(flatDown));
	const snap = easeInOut(lin(lt, w(6) + 0.15, w(6) + 0.6));
	const top: CamSpec = {target: [img.x, img.y, img.z], yaw: 0, pitch: PI / 2, flatPitch: PI / 2, frameH: IMG_FILL, clip: 0.6};
	const cam = lerpCam(side, top, snap);
	cam.flatPitch = PI / 2;
	return {
		cam,
		m: 1 - snap,
		world: (
			<>
				<Hallway t={c.t} book="closed" />
				<Figure f={f} rig={rig} />
				<Card p={p} q={q} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: snap < 0.5 ? handheld(c.t, 0.4) : undefined,
	};
};

// ---------------- the scarf draws itself on ----------------
const T2_scarf: ShotFn = (c) => {
	const lt = c.lt;
	const l034 = at('L034.ss') - c.start;
	const push = easeInOut(lin(lt, l034 - 0.8, c.dur));
	const base = photoCamAt(c.t);
	const neck: CamSpec = {...base, target: [SUBJECT_X + 0.03, 1.45, 0], frameH: 0.95};
	return {
		cam: lerpCam(base, neck, push),
		m: 0,
		world: <PhotoWorld s={photoStateAt(c.t)} />,
		fx: {vignette: 0.35 + 0.15 * push},
	};
};

// ---------------- other places ----------------
const PLACE_POS: [number, number][] = [
	[330, 250],
	[950, 250],
	[330, 470],
	[950, 470],
];
const PlacesIcons: React.FC<{lt: number}> = ({lt}) => {
	const tex = usePhotoTex();
	return (
		<>
			{PLACE_POS.map(([x, y], i) => {
				const since = lt - 0.25 - i * 0.35;
				if (since < 0) return null;
				const s = pop(since) * 5.4;
				return <PhotoCard key={i} map={tex} position={[bx(x), by(y) + 0.06, 0.2]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.05]} scale={s} flat={1} cast={false} back={false} />;
			})}
		</>
	);
};
const T2_places: ShotFn = (c) => {
	const lt = c.lt;
	const labels = ['YOUR PHONE', 'A VIDEO CALL', 'A PHOTO BOOTH', 'A SHOP WINDOW'];
	return {
		cam: {...BOARD_CAM, frameH: 9 * (1 - 0.04 * c.p)},
		m: 0,
		world: (
			<>
				<Board
					draw={(ctx, W, H) => {
						bg(ctx, W, H);
						PLACE_POS.forEach(([x, y], i) => {
							if (lt < 0.25 + i * 0.35) return;
							mono(ctx, labels[i], x, y + 92, 15, C.grey, 'center', 5);
						});
					}}
				/>
				<PlacesIcons lt={lt} />
			</>
		),
		photo: photoStateAt(c.t),
	};
};

// ---------------- the phone gallery ----------------
const THUMBS = ['#d9a066', '#4d6a8a', '#e3c27a', '#7a8b5c', '#c9ccd1', '#8a5a6a', '#3e5f73', '#b0745a', '#5a6a7a', '#d0b48a', '#6b8f71', '#9a7aa0', '#c98a5a', '#4a5868', '#e0d6c0'];
const PhotoGalleryScreen: React.FC<{phone: {p: THREE.Vector3; q: THREE.Quaternion}; scroll: number}> = ({phone, scroll}) => {
	const tex = useMemo(() => canvasTexture(360, 760, () => undefined), []);
	const photo = usePhotoTex();
	redraw(tex, (ctx, w, h) => {
		ctx.fillStyle = '#0b0f14';
		ctx.fillRect(0, 0, w, h);
		ctx.font = '700 30px Montserrat';
		ctx.fillStyle = '#F4F6F8';
		ctx.textAlign = 'left';
		ctx.fillText('Photos', 20, 58);
		const cell = 112;
		const off = -scroll * 120;
		for (let i = 0; i < 18; i++) {
			const col = i % 3;
			const row = Math.floor(i / 3);
			const x = 6 + col * (cell + 4);
			const y = 90 + row * (cell + 4) + off;
			if (y < 74 || y > h) continue;
			if (i === 4) {
				ctx.fillStyle = '#06080B';
				ctx.fillRect(x, y, cell, cell);
				continue;
			}
			ctx.fillStyle = THUMBS[i % THUMBS.length];
			ctx.fillRect(x, y, cell, cell);
			// tiny motifs so they read as remembered pictures: a cat, noodles, a sunset
			ctx.fillStyle = 'rgba(0,0,0,0.25)';
			if (i % 3 === 0) {
				ctx.beginPath();
				ctx.arc(x + cell / 2, y + cell * 0.62, cell * 0.24, 0, PI * 2);
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo(x + cell * 0.32, y + cell * 0.46);
				ctx.lineTo(x + cell * 0.38, y + cell * 0.3);
				ctx.lineTo(x + cell * 0.45, y + cell * 0.44);
				ctx.moveTo(x + cell * 0.55, y + cell * 0.44);
				ctx.lineTo(x + cell * 0.62, y + cell * 0.3);
				ctx.lineTo(x + cell * 0.68, y + cell * 0.46);
				ctx.fill();
			} else if (i % 3 === 1) {
				ctx.fillStyle = 'rgba(255,220,150,0.6)';
				ctx.beginPath();
				ctx.arc(x + cell / 2, y + cell * 0.7, cell * 0.22, PI, 0);
				ctx.fill();
			} else {
				ctx.fillStyle = 'rgba(255,255,255,0.35)';
				ctx.fillRect(x + cell * 0.2, y + cell * 0.3, cell * 0.6, cell * 0.08);
				ctx.fillRect(x + cell * 0.2, y + cell * 0.5, cell * 0.45, cell * 0.08);
			}
		}
	});
	// cell 4 (row 1, col 1) holds the photograph
	const cellW = (112 / 360) * (PHONE.w - 0.006);
	const cx = -(PHONE.w - 0.006) / 2 + ((6 + 1 * 116 + 56) / 360) * (PHONE.w - 0.006);
	const cy = (PHONE.h - 0.01) / 2 - ((90 + 1 * 116 + 56 - scroll * 120) / 760) * (PHONE.h - 0.01);
	return (
		<group position={phone.p} quaternion={phone.q}>
			<Ink shape={['rbox', PHONE.w, PHONE.h, PHONE.d, 0.008]} color="#1d232b" outline cast />
			<Ink shape={['plane', PHONE.w - 0.006, PHONE.h - 0.01]} map={tex} color="#ffffff" position={[0, 0, PHONE.d / 2 + 0.0006]} flat={1} glow={0.25} />
			{cy < (PHONE.h - 0.01) / 2 - 0.012 && cy > -(PHONE.h - 0.01) / 2 + 0.01 ? (
				<Ink shape={['plane', cellW, cellW * (9 / 16)]} map={photo} color="#ffffff" position={[cx, cy, PHONE.d / 2 + 0.0009]} flat={1} glow={0.2} />
			) : null}
		</group>
	);
};

const T2_phone: ShotFn = (c) => {
	const lt = c.lt;
	const f: Fig = {pos: v3(FX - 0.2, 0, -0.3), yaw: PI * 0.85};
	const scroll = Math.min(1, lt / 0.9) * 0.45 - 0.45 + 0.45 * (1 - easeInOut(lin(lt, 0.0, 1.2)));
	const a = phoneUse(c.t, 1);
	const phoneW = {p: toWorld(f, a.phone.p), q: qWorld(f, a.phone.q)};
	const n = v3(0, 0, 1).applyQuaternion(phoneW.q);
	// the flat view: straight at the screen
	const yaw0 = Math.atan2(n.x, n.z);
	const pitch0 = Math.asin(n.y);
	const flatSpec: CamSpec = {target: [phoneW.p.x, phoneW.p.y, phoneW.p.z], yaw: yaw0, pitch: pitch0, flatYaw: yaw0, flatPitch: pitch0, frameH: PHONE.h * 1.08, clip: 0.25};
	const ots: CamSpec = {target: [phoneW.p.x + 0.05, phoneW.p.y + 0.12, phoneW.p.z], yaw: yaw0 - 0.55, pitch: 0.35, flatYaw: yaw0, flatPitch: pitch0, frameH: 1.0, fov3d: 36, clip: 1e5};
	const k = easeInOut(lin(lt, 1.0, 2.6));
	const cam = lerpCam(flatSpec, ots, k);
	cam.flatYaw = yaw0;
	cam.flatPitch = pitch0;
	return {
		cam,
		m: k,
		world: (
			<>
				<Hallway t={c.t} book="closed" lamp={0.55} />
				<Figure f={f} rig={a.rig} />
				<PhotoGalleryScreen phone={phoneW} scroll={-scroll} />
				<Thumb a={toWorld(f, a.thumb[0])} b={toWorld(f, a.thumb[1])} />
				<pointLight position={toWorld(f, v3(0, 1.5, 0.35)).toArray()} intensity={0.35} distance={1.2} decay={1.5} color="#d8f1ff" />
			</>
		),
		photo: photoStateAt(c.t),
		shake: k > 0.5 ? handheld(c.t, 0.4) : undefined,
	};
};

// ---------------- the video call ----------------
const CallUI: React.FC<{a: number; scale: number; t: number}> = ({a, scale, t}) => (
	<div style={{position: 'absolute', inset: 0, opacity: a, transform: `scale(${scale})`, transformOrigin: '53% 44%'}}>
		<svg width={1280} height={720} style={{position: 'absolute', inset: 0}}>
			<defs>
				<mask id="tile">
					<rect width={1280} height={720} fill="white" />
					<rect x={150} y={70} width={980} height={552} rx={22} fill="black" />
				</mask>
			</defs>
			<rect width={1280} height={720} fill="#0b0e12" mask="url(#tile)" />
			<rect x={150} y={70} width={980} height={552} rx={22} fill="none" stroke="#5CF2E6" strokeWidth={3} />
			<rect x={950} y={470} width={160} height={110} rx={12} fill="#1a2028" stroke="#3a4452" strokeWidth={2} />
			<circle cx={1030} cy={512} r={18} fill="#F4F6F8" />
			<line x1={1030} y1={530} x2={1030} y2={575} stroke="#F4F6F8" strokeWidth={5} />
			<rect x={170} y={582} width={86} height={26} rx={8} fill="rgba(6,8,11,0.7)" />
			<text x={213} y={600} fill="#F4F6F8" fontFamily="JetBrains Mono" fontSize={13} textAnchor="middle" letterSpacing={2}>
				FLAT 4B
			</text>
			{[0, 1, 2].map((i) => (
				<circle key={i} cx={560 + i * 80} cy={668} r={22} fill={i === 2 ? '#5a6573' : '#2a313b'} />
			))}
			<circle cx={180} cy={92} r={6} fill="#5CF2E6" opacity={Math.floor(t * 2) % 2 ? 1 : 0.3} />
		</svg>
	</div>
);

const T2_call: ShotFn = (c) => {
	const lt = c.lt;
	const talk = Math.abs(Math.sin(c.t * 9)) > 0.5 ? 1 : 0;
	const r = sit(c.t, 0.5);
	r.expr = talk ? 'o' : 'blank';
	r.handR.set(-0.22 + 0.06 * Math.sin(c.t * 3), 0.85 + 0.12 * Math.abs(Math.sin(c.t * 2.2)), 0.3);
	r.handL.set(0.2, 0.55, 0.25);
	r.headYaw = 0.1 * Math.sin(c.t * 1.3);
	const webcam: CamSpec = {target: [CALL_X + 0.22, 1.2, -0.45], yaw: 0, pitch: 0.0, frameH: 1.75, fov3d: 58, flatFov: 58};
	const frame: CamSpec = {target: [CALL_FRAME.x, CALL_FRAME.y, CALL_FRAME.z], yaw: -0.12, pitch: 0.05, frameH: 0.34, fov3d: 40};
	const k = easeInOut(lin(lt, 0.9, c.dur - 0.2));
	const m = easeInOut(lin(lt, 0.7, 1.9));
	return {
		cam: lerpCam(webcam, frame, k),
		m,
		world: (
			<>
				<CallRoom t={c.t} />
				<Figure f={{pos: v3(CALL_X - 0.15, 0, -0.35), yaw: 0}} rig={r} color="#dfe3e8" />
				<Ink shape={['box', 0.55, 0.5, 0.45]} color="#3b3530" position={[CALL_X - 0.15, 0.25, -0.55]} outline />
			</>
		),
		photo: photoStateAt(c.t),
		overlay: <CallUI a={1 - seg(lt, 0.9, 1.6)} scale={1 + 0.9 * easeInOut(lin(lt, 0.8, 1.6))} t={c.t} />,
	};
};

// ---------------- the photo booth strip ----------------
const BOOTH_X = 800;
const drawBoothFace = (ctx: CanvasRenderingContext2D, cx: number, cy: number, kind: number) => {
	const R = 62;
	ctx.save();
	ctx.lineCap = 'round';
	// shoulders and neck
	ctx.strokeStyle = '#0b0e12';
	ctx.lineWidth = 15;
	ctx.beginPath();
	ctx.moveTo(cx, cy + R);
	ctx.lineTo(cx, cy + R + 70);
	ctx.moveTo(cx, cy + R + 30);
	ctx.lineTo(cx - 70, cy + R + 85);
	ctx.moveTo(cx, cy + R + 30);
	ctx.lineTo(cx + 70, cy + R + 85);
	ctx.stroke();
	ctx.strokeStyle = '#F4F6F8';
	ctx.lineWidth = 10;
	ctx.stroke();
	ctx.translate(cx, cy);
	ctx.rotate([0.25, -0.12, -0.3][kind]);
	ctx.fillStyle = '#F4F6F8';
	ctx.strokeStyle = '#0b0e12';
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.arc(0, 0, R, 0, PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#0b0e12';
	if (kind === 0) {
		// tongue out, one eye shut
		ctx.beginPath();
		ctx.arc(-20, -12, 6, 0, PI * 2);
		ctx.fill();
		ctx.fillRect(10, -13, 20, 4);
		ctx.beginPath();
		ctx.arc(0, 22, 15, 0, PI);
		ctx.fill();
		ctx.fillStyle = '#e88a8a';
		ctx.beginPath();
		ctx.ellipse(4, 36, 8, 12, 0, 0, PI * 2);
		ctx.fill();
	} else if (kind === 1) {
		// cross eyed, puffed cheeks
		ctx.beginPath();
		ctx.arc(-12, -10, 6, 0, PI * 2);
		ctx.arc(12, -10, 6, 0, PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.ellipse(0, 26, 10, 7, 0, 0, PI * 2);
		ctx.fill();
	} else {
		// huge grin, eyebrows up
		ctx.beginPath();
		ctx.arc(-22, -8, 6, 0, PI * 2);
		ctx.arc(22, -8, 6, 0, PI * 2);
		ctx.fill();
		ctx.fillRect(-30, -28, 18, 4);
		ctx.fillRect(12, -28, 18, 4);
		ctx.beginPath();
		ctx.arc(0, 12, 30, 0.1 * PI, 0.9 * PI);
		ctx.fill();
	}
	ctx.restore();
	if (kind === 2) {
		// peace sign
		ctx.strokeStyle = '#0b0e12';
		ctx.lineWidth = 14;
		ctx.beginPath();
		ctx.moveTo(cx + 70, cy + R + 85);
		ctx.lineTo(cx + 92, cy + 10);
		ctx.stroke();
		ctx.strokeStyle = '#F4F6F8';
		ctx.lineWidth = 9;
		ctx.stroke();
		ctx.fillStyle = '#F4F6F8';
		ctx.beginPath();
		ctx.arc(cx + 92, cy + 4, 13, 0, PI * 2);
		ctx.fill();
	}
};
const BoothPhoto: React.FC<{shown: boolean}> = ({shown}) => {
	const photo = usePhotoTex();
	if (!shown) return null;
	return <Ink shape={['plane', 1.62, 1.62 * (9 / 16)]} map={photo} color="#ffffff" position={[BOOTH_X, -1.92, 0.02]} flat={1} />;
};
const T2_booth: ShotFn = (c) => {
	const lt = c.lt;
	const flashes = [0.3, 0.75, 1.2, 1.65];
	const shown = flashes.map((f) => (lt >= f ? 1 : 0));
	const lastFlash = Math.max(...flashes.filter((f) => f <= lt), -9);
	const flash = lt - lastFlash < 0.12 ? 0.85 * (1 - (lt - lastFlash) / 0.12) : 0;
	const slide = easeOut(lin(lt, 0.0, 1.9));
	const tilt = easeInOut(lin(lt, 2.2, c.dur));
	const flatC: CamSpec = {target: [BOOTH_X, 0.3 - 1.6 * slide, 0], yaw: 0, pitch: 0, frameH: 4.8, fov3d: 34};
	const persp: CamSpec = {target: [BOOTH_X, -0.9, 0], yaw: -0.65, pitch: 0.28, frameH: 5.2, fov3d: 34};
	return {
		cam: lerpCam(flatC, persp, tilt),
		m: tilt,
		world: (
			<group rotation={[0, 0, 0.0]}>
				<Ink shape={['plane', 80, 60]} color="#06080B" position={[BOOTH_X, 0, -3]} flat={1} />
				<Board
					w={2.0}
					h={5.6}
					px={[400, 1120]}
					position={[BOOTH_X, 0, 0]}
					draw={(ctx, W, H) => {
						ctx.fillStyle = '#efe9dc';
						ctx.fillRect(0, 0, W, H);
						const cols = ['#4a6a8a', '#8a5a4a', '#5a7a5a', '#0b0f15'];
						for (let i = 0; i < 4; i++) {
							ctx.fillStyle = cols[i];
							ctx.fillRect(38, 32 + i * 266, W - 76, 240);
							if (i < 3 && shown[i]) {
								ctx.save();
								ctx.beginPath();
								ctx.rect(38, 32 + i * 266, W - 76, 240);
								ctx.clip();
								drawBoothFace(ctx, W / 2 - 10, 32 + i * 266 + 105, i);
								ctx.restore();
							}
						}
						mono(ctx, '4 FOR 1', W / 2, H - 20, 14, '#6b6f76', 'center', 4);
					}}
				/>
				<BoothPhoto shown={!!shown[3]} />
				<pointLight position={[BOOTH_X - 1, 1, 3]} intensity={2.5 * tilt} distance={10} color="#ffffff" />
				<ambientLight intensity={0.9 * tilt} />
			</group>
		),
		photo: photoStateAt(c.t),
		fx: {flash},
	};
};

// ---------------- the shop window you only ever walk past ----------------
const T2_shop: ShotFn = (c) => {
	const lt = c.lt;
	const l040 = at('L040.ss') - c.start;
	const walkT = lin(lt, 0, 2.2);
	const stop = SHOP_X + 0.1;
	const x = lerp(SHOP_X - 3.2, stop, easeOut(walkT));
	const moving = walkT < 0.98;
	let r = moving ? walk(c.t, 0.85) : idle(c.t);
	let yaw = PI / 2;
	const turn = easeInOut(lin(lt, 2.0, 2.6));
	yaw = lerp(PI / 2, PI, turn);
	const back = easeInOut(lin(lt, l040, l040 + 1.6));
	if (!moving) {
		r = idle(c.t);
		r.headPitch = -0.02;
		r.lean = -0.05 * back;
	}
	const pos = v3(x, 0, -0.95 + 0.6 * back);
	const cam: CamSpec = {target: [lerp(SHOP_X - 1.6, SHOP_X + 0.2, easeOut(walkT)), 1.35, -1.2], yaw: 0.22, pitch: 0.05, frameH: lerp(3.0, 2.4, c.p), fov3d: 32};
	return {
		cam,
		m: 1,
		world: (
			<>
				<Street t={c.t + 10} shopPhoto passers={false} />
				<Figure f={{pos, yaw}} rig={r} />
			</>
		),
		photo: photoStateAt(c.t),
		shake: handheld(c.t, 0.35),
	};
};

// ---------------- every one of them, tidy and unbothered ----------------
const Grid: React.FC<{k: number; collapse: number}> = ({k, collapse}) => {
	const photo = usePhotoTex();
	const cols = 8;
	const rows = 5;
	const items = [];
	for (let r = 0; r < rows; r++) {
		for (let cc = 0; cc < cols; cc++) {
			const i = r * cols + cc;
			if (i / (cols * rows) > k) continue;
			const x = (cc - (cols - 1) / 2) * 0.34;
			const y = ((rows - 1) / 2 - r) * 0.22;
			const p = v3(x * (1 - collapse), y * (1 - collapse), i * 0.0004 * collapse);
			const rot = (rand(i, 3) - 0.5) * 0.12 * (1 - collapse);
			items.push(<PhotoCard key={i} map={photo} position={p} rotation={[0, 0, rot]} flat={1} cast={false} back={false} scale={1 - 0.0 * collapse} />);
		}
	}
	return <group position={[900, 0, 0]}>{items}</group>;
};
const T2_grid: ShotFn = (c) => {
	const lt = c.lt;
	const k = easeOut(lin(lt, 0.0, 1.6));
	return {
		cam: {target: [900, 0, 0], yaw: 0, pitch: 0, frameH: lerp(0.5, 1.35, easeInOut(lin(lt, 0, 2.2)))},
		m: 0,
		world: (
			<>
				<Ink shape={['plane', 30, 20]} color="#06080B" position={[900, 0, -1]} flat={1} />
				<Grid k={k} collapse={0} />
			</>
		),
		photo: photoStateAt(c.t),
	};
};
const T2_trailer: ShotFn = (c) => {
	const lt = c.lt;
	const col = easeInOut(lin(lt, 0, 0.45));
	return {
		cam: {target: [900, lerp(0, -0.075, col), 0], yaw: 0, pitch: 0, frameH: lerp(1.35, 0.5, col)},
		m: 0,
		world: (
			<>
				<Ink shape={['plane', 30, 20]} color="#06080B" position={[900, 0, -1]} flat={1} />
				<Grid k={1} collapse={col} />
			</>
		),
		photo: photoStateAt(c.t),
		overlay: (
			<Kinetic
				t={c.t}
				frame={c.frame}
				items={[
					{text: 'COMING SOON', t0: c.start + 0.35, t1: c.end, size: 64, y: 520, color: C.amber, glitch: true, sub: 'A FEATURE PRESENTATION', subColor: '#9aa6b4', ls: 6},
				]}
			/>
		),
		captions: {lift: 0},
	};
};

export const THING2: Record<string, ShotFn> = {
	T2_title,
	T2_putdown,
	T2_scarf,
	T2_places,
	T2_phone,
	T2_call,
	T2_booth,
	T2_shop,
	T2_grid,
	T2_trailer,
};

export {CARD_W, CARD_H, sm, text};
