import React, {useMemo} from 'react';
import * as THREE from 'three';
import {at, TL} from '../events';
import {Board, bg, C, mono, stamp, text, hexA} from '../world/Board';
import {CamSpec, lerpCam} from '../world/mode';
import {PhotoWorld, SUBJECT_X} from '../world/PhotoWorld';
import {PHOTO, PhotoCard} from '../world/Photo';
import {usePhotoTex} from '../world/photoTex';
import {Hallway, HALL} from '../world/Hallway';
import {Kitchen, KITCHEN_X, HOOK_POS} from '../world/Rooms';
import {Ink, Glow} from '../world/Ink';
import {Arm} from '../world/Arm';
import {canvasTexture, glowTexture, rand, roundRect} from '../world/textures';
import {idle} from '../world/rig';
import {SevenSeg} from '../overlay/HUD';
import {Kinetic} from '../overlay/Kinetic';
import {Figure} from './common';
import {CardInVoid, voidCam} from './thing1';
import {FINAL_CAM, photoCamAt, photoStateAt} from './story';
import {BOARD_CAM, bx, by, clamp01, easeInOut, easeOut, handheld, lerp, lin, pop, seg, ShotFn, v3} from './types';

const PI = Math.PI;

// ---------------- near silence: only the red number in the dark ----------------
const R1_dark: ShotFn = (c) => ({
	cam: voidCam(PHOTO.h * 2.4),
	m: 0,
	world: <CardInVoid />,
	photo: photoStateAt(c.t),
	fx: {exposure: lerp(0.4, 0.12, easeInOut(c.p)), vignette: 0.6},
});

// ---------------- check the corner: the meter comes to the middle and flips ----------------
const BigMeter: React.FC<{t: number; t0: number; flipT: number; t1: number}> = ({t, t0, flipT, t1}) => {
	const come = easeInOut(lin(t, t0, t0 + 0.6));
	const back = easeInOut(lin(t, t1 - 0.6, t1));
	const k = come * (1 - back);
	const flipped = t >= flipT;
	const sinceFlip = t - flipT;
	const roll = flipped ? easeOut(clamp01(sinceFlip / 0.35)) : 0;
	const label = flipped ? 'TAKEN IN' : 'PHOTOGRAPHER';
	const value = flipped ? '+' + String(Math.round(412 * roll)).padStart(3, '0') : ' 0.3';
	const unit = flipped ? 'DAYS' : 'm';
	const color = '#FF2B2B';
	const scale = lerp(1, 2.6, k);
	const x = lerp(1254 - 120, 640, k);
	const y = lerp(18 + 45, 330, k);
	const shake = flipped && sinceFlip < 0.25 ? (Math.sin(sinceFlip * 90) * 8 * (1 - sinceFlip / 0.25)) : 0;
	const ring = flipped && sinceFlip < 1.0 ? sinceFlip : -1;
	return (
		<div style={{position: 'absolute', left: x + shake, top: y, transform: `translate(-50%, -50%) scale(${scale})`}}>
			<div style={{padding: '8px 14px 10px 14px', borderRadius: 8, border: `1.5px solid ${color}88`, background: 'rgba(6,8,11,0.85)', boxShadow: `0 0 ${20 + 40 * (flipped ? Math.max(0, 1 - sinceFlip) : 0)}px ${color}66`, minWidth: 214, position: 'relative'}}>
				<div style={{fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 11, letterSpacing: 2.2, color: flipped ? '#ffb3b3' : '#9aa6b4', marginBottom: 5}}>{label}</div>
				<div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 8}}>
					<SevenSeg text={value} color={color} />
					<div style={{fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: flipped ? 15 : 22, color, minWidth: flipped ? 40 : 16}}>{unit}</div>
				</div>
				<div style={{marginTop: 7, height: 3, background: '#ffffff14'}}>
					<div style={{width: `${flipped ? 100 : 3}%`, height: 3, background: color}} />
				</div>
				{ring >= 0 ? <div style={{position: 'absolute', inset: -8 - ring * 50, borderRadius: 14 + ring * 30, border: `2px solid ${color}`, opacity: 1 - ring}} /> : null}
			</div>
		</div>
	);
};
const R2_flip: ShotFn = (c) => {
	const flipT = TL.camera_icon;
	return {
		cam: voidCam(PHOTO.h * 2.4),
		m: 0,
		world: <CardInVoid />,
		photo: photoStateAt(c.t),
		fx: {exposure: 0.12, vignette: 0.6},
		overlay: <BigMeter t={c.t} t0={c.start} flipT={flipT} t1={c.end} />,
		hud: {hideMeter: true},
	};
};

// ---------------- wrong unit ----------------
const R3_wrong: ShotFn = (c) => ({
	cam: BOARD_CAM,
	m: 0,
	world: <Board draw={(ctx, W, H) => bg(ctx, W, H, C.bg, {x: W / 2, y: H / 2, r: 420, color: '#3a0d0d', a: 0.45})} />,
	overlay: (
		<Kinetic
			t={c.t}
			frame={c.frame}
			items={[
				{text: 'HOW CLOSE?', t0: c.start, t1: at('L070.w4') - 0.05, size: 70, y: 320, color: '#9aa6b4'},
				{text: 'WRONG UNIT.', t0: at('L070.w4') - 0.05, t1: c.end, size: 110, y: 320, glitch: true, sub: 'METRES  TO  DAYS', subColor: '#FF2B2B'},
			]}
		/>
	),
});

// ---------------- a ruler in metres becomes a timeline in days, tipping into depth ----------------
const rulerTex = () => canvasTexture(4096, 256, () => undefined);
const Ruler: React.FC<{days: number; glow: number}> = ({days, glow}) => {
	const tex = useMemo(rulerTex, []);
	const ctx = (tex.image as HTMLCanvasElement).getContext('2d')!;
	const W = 4096;
	const Hh = 256;
	ctx.fillStyle = '#e9e1cf';
	ctx.fillRect(0, 0, W, Hh);
	for (let i = 0; i <= 412; i++) {
		const x = 40 + (i / 412) * (W - 80);
		const major = i % 10 === 0;
		ctx.fillStyle = '#2b2f36';
		ctx.fillRect(x, 0, major ? 4 : 2, major ? 90 : 46);
		if (major) {
			ctx.font = '700 44px "JetBrains Mono"';
			ctx.textAlign = 'center';
			const metres = Math.round((i / 412) * 40);
			const lbl = days > 0.5 ? String(i) : `${metres}`;
			ctx.globalAlpha = days > 0.5 ? (days - 0.5) * 2 : 1 - days * 2;
			ctx.fillText(lbl, x, 150);
			ctx.globalAlpha = 1;
		}
	}
	ctx.font = '700 40px "JetBrains Mono"';
	ctx.fillStyle = days > 0.5 ? '#c43a1a' : '#6b6f76';
	ctx.textAlign = 'left';
	ctx.fillText(days > 0.5 ? 'DAYS' : 'METRES', 50, 225);
	tex.needsUpdate = true;
	return <Ink shape={['plane', 16, 1]} map={tex} color="#ffffff" glow={glow} flat={1} />;
};
const R4_ruler: ShotFn = (c) => {
	const lt = c.lt;
	const days = easeInOut(lin(c.t, at('L071.w7'), at('L071.w7') + 0.6));
	const tip = easeInOut(lin(lt, 1.6, c.dur));
	// the tape lies down and runs away from you: space becomes time
	const flatCam: CamSpec = {target: [0, 0, 0], yaw: 0, pitch: 0, frameH: 4.5, fov3d: 40};
	const deep: CamSpec = {target: [3.5, 0, -1.2], yaw: -1.25, pitch: 0.32, frameH: 2.2, fov3d: 40};
	return {
		cam: lerpCam(flatCam, deep, tip),
		m: tip,
		world: (
			<>
				<group rotation={[-PI / 2 * tip, 0, 0]}>
					<Ruler days={days} glow={0.05} />
				</group>
				<ambientLight intensity={1.2} />
			</>
		),
		fx: {warm: -0.4},
	};
};

// ---------------- the calendar tunnel to a Tuesday that has not arrived ----------------
const pageTex = (i: number) =>
	canvasTexture(256, 320, (ctx, w, h) => {
		ctx.fillStyle = '#ece6d8';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = '#c43a1a';
		ctx.fillRect(0, 0, w, 56);
		const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
		ctx.font = '700 30px "JetBrains Mono"';
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.fillText(days[i % 7], w / 2, 40);
		ctx.font = '800 130px Montserrat';
		ctx.fillStyle = '#2b2f36';
		ctx.fillText(String(1 + (i % 28)), w / 2, 210);
		ctx.font = '500 22px "JetBrains Mono"';
		ctx.fillStyle = '#6b6f76';
		ctx.fillText(`+${412 - i}`, w / 2, 285);
	});
const TUNNEL_X = 1200;
const Tunnel: React.FC<{lt: number}> = ({lt}) => {
	const texs = useMemo(() => Array.from({length: 14}, (_, i) => pageTex(i * 3 + 1)), []);
	const n = 120;
	return (
		<group position={[TUNNEL_X, 0, 0]}>
			{Array.from({length: n}).map((_, i) => {
				const z = -i * 0.9;
				const a = i * 0.83 + rand(i, 3) * 0.6;
				const r = 1.25 + rand(i, 5) * 0.35;
				const flip = Math.sin(lt * 3 + i) * 0.3;
				return (
					<group key={i} position={[Math.cos(a) * r, Math.sin(a) * r, z]} rotation={[flip, 0, a + PI / 2]}>
						<Ink shape={['plane', 0.42, 0.52]} map={texs[i % texs.length]} color="#ffffff" flat={1} opts={{side: THREE.DoubleSide}} />
					</group>
				);
			})}
		</group>
	);
};
const tuesdayTex = () => canvasTexture(512, 640, (ctx, w, h) => {
	ctx.fillStyle = '#ece6d8';
	ctx.fillRect(0, 0, w, h);
	ctx.fillStyle = '#c43a1a';
	ctx.fillRect(0, 0, w, 110);
	ctx.font = '800 64px Montserrat';
	ctx.fillStyle = '#ffffff';
	ctx.textAlign = 'center';
	ctx.fillText('TUESDAY', w / 2, 80);
	ctx.font = '800 260px Montserrat';
	ctx.fillStyle = '#2b2f36';
	ctx.fillText('?', w / 2, 430);
	ctx.font = '500 36px "JetBrains Mono"';
	ctx.fillStyle = '#6b6f76';
	ctx.fillText('IN 412 DAYS', w / 2, 560);
});
const TuesdayPage: React.FC<{z: number; opacity: number}> = ({z, opacity}) => {
	const tex = useMemo(tuesdayTex, []);
	return <Ink shape={['plane', 0.52, 0.65]} map={tex} color="#ffffff" position={[TUNNEL_X, 0, z]} flat={1} opacity={opacity} glow={0.1} />;
};
const R5_tunnel: ShotFn = (c) => {
	const lt = c.lt;
	const tue = at('L073.ss') - c.start;
	if (lt < tue + 0.9) {
		// fly through 412 pages
		const z = -lt * 9.5;
		const m = easeInOut(lin(lt, 0, 0.8));
		const page = seg(lt, tue - 0.3, tue + 0.4);
		const camZ = Math.min(z, -(tue - 0.3) * 9.5);
		return {
			cam: {target: [TUNNEL_X, 0, camZ - 2], yaw: 0, pitch: 0, roll: 0.25 * Math.sin(lt * 0.8), frameH: lerp(2.2, 0.62, page), fov3d: 62, flatFov: 20},
			m,
			world: (
				<>
					<Ink shape={['plane', 80, 80]} color="#06080B" position={[TUNNEL_X, 0, -120]} flat={1} />
					<Tunnel lt={lt} />
					<TuesdayPage z={camZ - 2} opacity={page} />
				</>
			),
			fx: {warm: -0.45},
		};
	}
	// through the page: the bus stop, empty, rain, nobody there yet
	const k = lt - (tue + 0.9);
	const s = photoStateAt(c.t);
	return {
		cam: {...FINAL_CAM, frameH: 2.6, target: [0.1, 1.3, 0], fov3d: 16, yaw: -0.18 + 0.03 * k},
		m: 1,
		world: (
			<group>
				<PhotoWorld s={{...s, frozen: false, hand: 0}} hideSubject />
			</group>
		),
		shake: handheld(c.t, 0.4),
		fx: {warm: -0.3},
	};
};

// ---------------- the scarf, the hand, the laugh ----------------
const R6_items: ShotFn = (c) => {
	const t = c.t;
	const w = (i: number) => at(`L074.w${i}`) - 0.1;
	if (t < w(2)) {
		return {
			cam: {target: [HOOK_POS.x + 0.1, HOOK_POS.y - 0.3, HOOK_POS.z], yaw: -1.2, pitch: 0.08, frameH: 0.85 - 0.05 * (t - c.start), fov3d: 34},
			m: 1,
			world: <Kitchen t={t} morning={1} />,
			fx: {warm: 0.15},
			shake: handheld(t, 0.3),
		};
	}
	if (t < w(7)) {
		const k = t - w(2);
		// a hand, reaching toward a shoulder that is not there yet
		return {
			cam: {target: [KITCHEN_X - 0.2, 1.35, 0.2], yaw: 0.3, pitch: 0.05, frameH: 0.7, fov3d: 34},
			m: 1,
			world: (
				<>
					<Kitchen t={t} morning={1} />
					<Arm root={v3(KITCHEN_X + 0.45, 1.42, 0.35)} target={v3(KITCHEN_X - 0.1 + 0.08 * Math.sin(k * 2), 1.38, 0.2)} pole={v3(KITCHEN_X + 0.2, 0.9, 0.6)} grip="open" />
				</>
			),
			fx: {warm: 0.15},
			shake: handheld(t, 0.3),
		};
	}
	if (t < at('L075.ss') - 0.1) {
		return {cam: {...photoCamAt(t), target: [0.42, 1.63, 0], frameH: 0.5}, m: 0, world: <PhotoWorld s={photoStateAt(t)} />};
	}
	// all of it is on its way: the three on a calendar page, a dashed line to +412
	return {
		cam: BOARD_CAM,
		m: 0,
		world: (
			<Board
				draw={(ctx, W, H) => {
					bg(ctx, W, H);
					const k = clamp01((t - at('L075.ss') + 0.1) / 0.8);
					ctx.save();
					ctx.strokeStyle = C.amber;
					ctx.lineWidth = 4;
					ctx.setLineDash([12, 10]);
					ctx.beginPath();
					ctx.moveTo(220, 380);
					ctx.lineTo(220 + (1000 - 220) * k, 380);
					ctx.stroke();
					ctx.restore();
					['SCARF', 'HAND', 'LAUGH'].forEach((s, i) => {
						const x = 280 + i * 180;
						ctx.fillStyle = 'rgba(244,246,248,0.08)';
						roundRect(ctx, x - 70, 300, 140, 160, 12);
						ctx.fill();
						mono(ctx, s, x, 440, 15, C.grey, 'center', 4);
					});
					// small icons
					ctx.strokeStyle = C.amber;
					ctx.lineWidth = 10;
					ctx.beginPath();
					ctx.arc(280, 360, 30, PI * 0.1, PI * 0.9);
					ctx.stroke();
					ctx.strokeStyle = C.white;
					ctx.lineWidth = 8;
					ctx.beginPath();
					ctx.moveTo(420, 390);
					ctx.lineTo(460, 345);
					ctx.stroke();
					ctx.beginPath();
					ctx.arc(462, 342, 12, 0, PI * 2);
					ctx.fillStyle = C.white;
					ctx.fill();
					ctx.beginPath();
					ctx.arc(640, 360, 34, 0, PI * 2);
					ctx.fill();
					ctx.fillStyle = C.ink;
					ctx.beginPath();
					ctx.arc(640, 368, 14, 0, PI);
					ctx.fill();
					text(ctx, '+412', 1080, 380, {size: 54, color: C.amber, glow: 14, font: '"JetBrains Mono"', weight: 700});
				}}
			/>
		),
	};
};

// ---------------- bracing for next year like a weather report ----------------
const weatherIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, kind: number, a = 1) => {
	ctx.save();
	ctx.globalAlpha = a;
	ctx.fillStyle = '#8f9aa7';
	const cloud = (cx: number, cy: number, s: number) => {
		ctx.beginPath();
		ctx.arc(cx - 18 * s, cy, 16 * s, 0, PI * 2);
		ctx.arc(cx + 2 * s, cy - 10 * s, 20 * s, 0, PI * 2);
		ctx.arc(cx + 22 * s, cy, 15 * s, 0, PI * 2);
		ctx.rect(cx - 18 * s, cy - 2 * s, 40 * s, 17 * s);
		ctx.fill();
	};
	if (kind === 3) {
		ctx.fillStyle = C.amber;
		ctx.shadowColor = C.amber;
		ctx.shadowBlur = 20;
		ctx.beginPath();
		ctx.arc(x, y, 22, 0, PI * 2);
		ctx.fill();
		for (let i = 0; i < 8; i++) {
			const ang = (i / 8) * PI * 2;
			ctx.fillRect(x + Math.cos(ang) * 32 - 3, y + Math.sin(ang) * 32 - 3, 6, 6);
		}
	} else {
		cloud(x, y - 6, 1);
		ctx.strokeStyle = kind === 2 ? C.amber : '#5CF2E6';
		ctx.lineWidth = 3;
		if (kind >= 1) {
			for (let i = 0; i < 3; i++) {
				ctx.beginPath();
				ctx.moveTo(x - 14 + i * 12, y + 20);
				ctx.lineTo(x - 18 + i * 12, y + 32);
				ctx.stroke();
			}
		}
		if (kind === 2) {
			ctx.fillStyle = C.amber;
			ctx.beginPath();
			ctx.moveTo(x + 2, y + 10);
			ctx.lineTo(x - 8, y + 30);
			ctx.lineTo(x + 2, y + 28);
			ctx.lineTo(x - 4, y + 44);
			ctx.lineTo(x + 12, y + 22);
			ctx.lineTo(x + 2, y + 24);
			ctx.closePath();
			ctx.fill();
		}
	}
	ctx.restore();
};
const MONTHS = ['NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT'];
const KINDS = [1, 2, 0, 1, 2, 1, 0, 3, 1, 2, 0, 1];
const drawForecast = (ctx: CanvasRenderingContext2D, W: number, H: number, lt: number, sunGlow: number) => {
	bg(ctx, W, H);
	mono(ctx, 'NEXT YEAR, A FORECAST', W / 2, 92, 16, C.grey, 'center', 6);
	MONTHS.forEach((m, i) => {
		const x = 120 + i * 94;
		const since = lt - i * 0.06;
		const a = clamp01(since / 0.15);
		weatherIcon(ctx, x, 210, KINDS[i], a * (KINDS[i] === 3 ? 0.4 + 0.6 * sunGlow : 1));
		mono(ctx, m, x, 280, 13, '#5a6573', 'center', 3);
	});
};
const braceRig = (t: number) => {
	const r = idle(t);
	const gust = Math.sin(t * 7) * 0.03;
	r.lean = 0.34 + gust;
	r.side = 0.08;
	r.handL.set(0.25, 1.62, 0.25);
	r.handR.set(-0.25, 1.62, 0.25);
	r.elbowL.set(0.6, 1.3, 0.2);
	r.elbowR.set(-0.6, 1.3, 0.2);
	r.footL.set(0.18, 0, 0.2);
	r.footR.set(-0.14, 0, -0.25);
	r.expr = 'flinch';
	r.headPitch = 0.25;
	return r;
};
const R7_weather: ShotFn = (c) => ({
	cam: {...BOARD_CAM, frameH: 9 * (1 - 0.03 * c.p)},
	m: 0,
	world: (
		<>
			<Board draw={(ctx, W, H) => drawForecast(ctx, W, H, c.lt, 0)} />
			<Figure f={{pos: v3(bx(640), by(620), 0.2), yaw: PI / 2}} rig={braceRig(c.t)} scale={1.7} />
			{/* rain streaks pushed sideways by the wind */}
			{Array.from({length: 40}).map((_, i) => {
				const x = bx((rand(i, 2) * 1280 + c.lt * 900) % 1280);
				const y = by((rand(i, 3) * 720 + c.lt * 500) % 720);
				return <Ink key={i} shape={['box', 0.02, 0.32, 0.01]} color="#5CF2E6" position={[x, y, 0.1]} rotation={[0, 0, 0.5]} opacity={0.35} flat={1} />;
			})}
		</>
	),
});

// ---------------- the one good photograph, in advance, with a note ----------------
const Envelope: React.FC<{open: number; inside: number; note: number}> = ({open, inside, note}) => {
	const photo = usePhotoTex();
	const flapTex = useMemo(
		() =>
			canvasTexture(512, 256, (ctx, w, h) => {
				ctx.fillStyle = '#d9cfb8';
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(w, 0);
				ctx.lineTo(w / 2, h);
				ctx.closePath();
				ctx.fill();
			}),
		[],
	);
	return (
		<group position={[0, -0.9, 0.3]}>
			<Ink shape={['box', 4.2, 2.6, 0.02]} color="#e6dcc6" position={[0, 0, -0.01]} />
			<group position={[0, 1.3, 0.01]} rotation={[-PI * open, 0, 0]}>
				<Ink shape={['plane', 4.2, 2.1]} map={flapTex} color="#ffffff" position={[0, -1.05, 0]} opts={{transparent: true, side: THREE.DoubleSide}} />
			</group>
			<group position={[0, lerp(2.9, 0.25, inside), lerp(0.2, -0.0, inside)]} scale={13}>
				<PhotoCard map={photo} back={false} flat={1} cast={false} />
			</group>
			<Ink shape={['box', 4.2, 1.3, 0.02]} color="#ddd2bb" position={[0, -0.65, 0.02]} />
			{note > 0 ? (
				<group position={[1.3, -0.2 + 0.3 * (1 - note), 0.05]} rotation={[0, 0, 0.12]} scale={pop(note)}>
					<Ink shape={['plane', 1.2, 0.9]} color="#f2e27a" />
					<NoteText />
				</group>
			) : null}
		</group>
	);
};
const NoteText: React.FC = () => {
	const tex = useMemo(
		() =>
			canvasTexture(400, 300, (ctx, w, h) => {
				ctx.fillStyle = '#d9820f';
				ctx.font = '700 110px Caveat';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText('Keep it.', w / 2, h / 2);
			}),
		[],
	);
	return <Ink shape={['plane', 1.2, 0.9]} map={tex} color="#ffffff" position={[0, 0, 0.01]} opts={{transparent: true}} flat={1} />;
};
const R8_envelope: ShotFn = (c) => {
	const lt = c.lt;
	const adv = at('L078.ss') - c.start;
	if (lt < adv - 0.2) {
		// the one sunny month glows and becomes the photograph
		const glow = seg(lt, 0.2, 1.0);
		const grow = easeInOut(lin(lt, 1.2, 2.4));
		return {
			cam: {...BOARD_CAM, frameH: 9},
			m: 0,
			world: (
				<>
					<Board draw={(ctx, W, H) => drawForecast(ctx, W, H, 3, glow)} />
					{grow > 0 ? (
						<group position={[lerp(bx(120 + 7 * 94), 0, grow), lerp(by(210), 0.3, grow), 0.3]} scale={lerp(0.5, 14, grow)}>
							<PhotoCardFlat />
						</group>
					) : null}
				</>
			),
			photo: photoStateAt(c.t),
		};
	}
	const k = lt - (adv - 0.2);
	return {
		cam: {target: [0, -0.6, 0], yaw: 0, pitch: 0, frameH: 4.6},
		m: 0,
		world: (
			<>
				<Board draw={(ctx, W, H) => bg(ctx, W, H)} position={[0, 0, -0.5]} scale={1.2} />
				<Envelope open={1 - easeInOut(lin(k, 0.9, 1.5))} inside={easeInOut(lin(k, 0.0, 0.8))} note={easeOut(lin(k, 0.6, 1.0))} />
			</>
		),
		photo: photoStateAt(c.t),
	};
};
const PhotoCardFlat: React.FC = () => {
	const photo = usePhotoTex();
	return <PhotoCard map={photo} back={false} flat={1} cast={false} glow={0.4} />;
};

// ---------------- a generous thing to send, a poor way to deliver it ----------------
const R9_post: ShotFn = (c) => {
	const lt = c.lt;
	const poor = at('L079.w8') - c.start;
	const stampK = easeOut(lin(lt, 0.3, 0.6));
	const slide = easeInOut(lin(lt, poor, poor + 1.8));
	return {
		cam: BOARD_CAM,
		m: 0,
		world: (
			<Board
				draw={(ctx, W, H) => {
					bg(ctx, W, H);
					// envelope, stamped
					ctx.save();
					ctx.translate(W / 2 + 260 * slide, H / 2 - 30);
					ctx.rotate(-0.04 + 0.1 * slide);
					ctx.fillStyle = '#e6dcc6';
					ctx.fillRect(-240, -140, 480, 280);
					ctx.strokeStyle = '#cfc4ad';
					ctx.lineWidth = 3;
					ctx.beginPath();
					ctx.moveTo(-240, -140);
					ctx.lineTo(0, 20);
					ctx.lineTo(240, -140);
					ctx.stroke();
					mono(ctx, 'TO: YOU', -200, 70, 18, '#4a4f57', 'left', 3);
					mono(ctx, 'FROM: A TUESDAY', -200, 100, 18, '#4a4f57', 'left', 3);
					ctx.restore();
					if (stampK > 0) stamp(ctx, 'POSTAGE: 412 DAYS', W / 2 + 120 + 260 * slide, H / 2 - 120, 30, C.amber, 0.12, stampK, 1 + 0.5 * (1 - stampK));
					if (slide > 0) {
						// delivered: between two pages of a book
						ctx.save();
						ctx.globalAlpha = slide;
						ctx.fillStyle = '#4a3030';
						ctx.fillRect(W - 360, H / 2 - 160, 300, 330);
						ctx.fillStyle = '#d9cfb8';
						ctx.fillRect(W - 350, H / 2 - 150, 280, 310);
						ctx.fillStyle = '#4a3030';
						ctx.fillRect(W - 360, H / 2 - 150, 300, 6);
						mono(ctx, 'DELIVERY: BETWEEN TWO PAGES', W - 210, H / 2 + 210, 13, C.grey, 'center', 3);
						ctx.restore();
					}
				}}
			/>
		),
	};
};

// ---------------- and you spent the evening checking strangers ----------------
const R10_window: ShotFn = (c) => {
	const r = idle(c.t);
	r.lean = 0.12;
	r.headPitch = 0.38;
	r.headYaw = 0.45 * Math.sin(c.t * 0.9);
	r.handL.set(0.2, 1.1, 0.35);
	r.handR.set(-0.2, 1.1, 0.35);
	return {
		cam: {target: [-HALL.w / 2 + 0.4, 1.45, 0.6], yaw: 1.2, pitch: 0.05, frameH: 1.25, fov3d: 34},
		m: easeInOut(lin(c.lt, 0, 0.8)),
		world: (
			<>
				<Hallway t={c.t} book="closed" lamp={0.7} window={0.6} windowLight={[-1.12, 1.95, 1.05]} />
				<Figure f={{pos: v3(-HALL.w / 2 + 0.5, 0, 0.6), yaw: -PI / 2}} rig={r} />
				{/* passersby lights crossing the window glass below */}
				<Glow position={[-HALL.w / 2 + 0.03, 1.2 + 0.1 * Math.sin(c.t), 0.6 + ((c.t * 0.4) % 1) - 0.5]} size={0.18} color={C.amber} intensity={0.5} tex={glowTexture()} />
			</>
		),
		shake: handheld(c.t, 0.35),
	};
};

export const REVEAL: Record<string, ShotFn> = {
	R1_dark,
	R2_flip,
	R3_wrong,
	R4_ruler,
	R5_tunnel,
	R6_items,
	R7_weather,
	R8_envelope,
	R9_post,
	R10_window,
};
export {hexA, SUBJECT_X};
