import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Glow, Ink} from './Ink';
import {COLORS} from './materials';
import {basePose, blinkAt, cloneRig, DIM, idle, Rig} from './rig';
import {Stickman} from './Stickman';
import {canvasTexture, glowTexture, gradientTexture, rand} from './textures';
import {ModeContext, useMode} from './mode';
import {CamSpec} from './mode';
import {Spot} from './Photo';

// The photograph: dusk at a bus stop. The same set renders flat (inside the
// photo) and in full 3D (when the camera dives into it).

export type PhotoState = {
	expr: 'blank' | 'laugh' | 'smile';
	laugh: number; // 0..1 how far into the laugh
	scarf: number;
	hand: number; // friend's hand on the shoulder 0..1
	friend: number; // friend body visible (escape scene) 0..1
	t: number; // seconds, for breath and rain in 3D
	frozen: boolean; // a photograph does not breathe
	sipping?: number; // 0..1 cup to lips (thing one 3D shot)
	look?: number; // head yaw
};

export const SUBJECT_X = 0.42;
export const CUP = {r: 0.042, rb: 0.033, h: 0.13};

// the photographer's flat camera: the photo framing
export const PHOTO_CAM: CamSpec = {
	target: [0.12, 1.32, 0],
	yaw: -0.16,
	pitch: 0.03,
	roll: 0.035,
	frameH: 2.75,
	fov3d: 14,
	flatFov: 14,
	flatYaw: -0.16,
	flatPitch: 0.03,
};

export const subjectRig = (s: PhotoState): Rig => {
	const t = s.frozen ? 0.8 : s.t;
	const r = idle(t, s.frozen ? 0 : 1);
	if (s.frozen) r.blink = 0;
	const cupY = 1.2;
	const cupZ = 0.2;
	const l = s.laugh;
	if (l < 0.02) {
		// both hands around the cup, warming them
		r.handL.set(CUP.r + 0.018, cupY - 0.01, cupZ);
		r.handR.set(-CUP.r - 0.018, cupY - 0.01, cupZ);
		r.elbowL.set(0.6, 0.9, -0.3);
		r.elbowR.set(-0.6, 0.9, -0.3);
		r.gripL = 'hold';
		r.gripR = 'hold';
		r.headYaw = s.look ?? 0.42;
		r.headPitch = 0.08;
		r.expr = 'blank';
	} else {
		// laugh: right hand keeps the cup, head back, shoulders up
		r.handR.set(-CUP.r - 0.018 - 0.02 * l, cupY - 0.04 * l, cupZ + 0.02);
		r.elbowR.set(-0.6, 0.9, -0.3);
		r.gripR = 'hold';
		r.handL.set(0.17 + 0.03 * l, 1.02 + 0.12 * l, 0.12 + 0.05 * l);
		r.elbowL.set(0.7, 0.8, -0.2);
		r.headYaw = 0.42 * (1 - l) + 0.28 * l;
		r.headPitch = 0.08 - 0.42 * l;
		r.lean = 0.02 - 0.06 * l;
		r.shrug = 0.03 * l;
		r.expr = 'laugh';
		r.mouth = Math.min(1, 0.25 + l * 0.9);
		r.blink = 0.4 + 0.5 * l;
	}
	if (s.sipping && s.sipping > 0) {
		const k = s.sipping;
		// cup to the lips: right hand around the cup, rim at the mouth, head tips back a little
		r.handR.set(-0.05, 1.2 + 0.36 * k, 0.2 - 0.03 * k);
		r.handL.set(0.2, 0.86, 0.04);
		r.elbowL.set(0.5, 1.2, -0.6);
		r.headPitch = 0.08 - 0.22 * k;
		r.headYaw = 0.42 * (1 - k);
		r.gripL = 'open';
	}
	if (!s.frozen) r.blink = Math.max(r.blink, blinkAt(s.t));
	return r;
};

// cup transform in figure space, from the hands (the cup is never just placed near a hand)
export const cupFromRig = (r: Rig, s: PhotoState) => {
	if (s.sipping && s.sipping > 0) {
		const k = s.sipping;
		const p = r.handR.clone().add(new THREE.Vector3(CUP.r + 0.016, 0, 0));
		return {p, tilt: -0.9 * k};
	}
	if (s.laugh < 0.02) {
		return {p: r.handL.clone().add(r.handR).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.01, 0)), tilt: 0};
	}
	return {p: r.handR.clone().add(new THREE.Vector3(CUP.r + 0.018, 0.01, 0)), tilt: 0.05};
};

export const TakeawayCup: React.FC<{position: THREE.Vector3; tilt?: number; flat?: number}> = ({position, tilt = 0, flat}) => (
	<group position={position} rotation={[tilt, 0, 0]}>
		<Ink shape={['cyl', CUP.r, CUP.rb, CUP.h, 24]} color="#ece6da" outline cast flat={flat} />
		<Ink shape={['cyl', CUP.r * 0.985 + 0.002, CUP.r * 0.9 + 0.002, CUP.h * 0.36, 24]} color={COLORS.amber} position={[0, -0.005, 0]} flat={flat} />
		<Ink shape={['cyl', CUP.r * 1.04, CUP.r * 1.04, 0.016, 24]} color="#2b2f36" position={[0, CUP.h / 2 + 0.008, 0]} outline flat={flat} />
	</group>
);

const fogTexture = (smiles: boolean) =>
	canvasTexture(512, 384, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, 'rgba(150,175,195,0.20)');
		g.addColorStop(0.55, 'rgba(170,190,205,0.42)');
		g.addColorStop(1, 'rgba(150,170,190,0.30)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		// condensation speckle
		for (let i = 0; i < 900; i++) {
			ctx.fillStyle = `rgba(210,225,235,${0.05 + rand(i, 3) * 0.12})`;
			const r = 1 + rand(i, 4) * 2.5;
			ctx.beginPath();
			ctx.arc(rand(i, 1) * w, rand(i, 2) * h, r, 0, Math.PI * 2);
			ctx.fill();
		}
		// two small smiles drawn with a finger, wiped through the fog
		const smile = (x: number, y: number, s: number) => {
			ctx.save();
			ctx.globalCompositeOperation = 'destination-out';
			ctx.lineCap = 'round';
			ctx.lineWidth = 7 * s;
			ctx.strokeStyle = 'rgba(0,0,0,0.85)';
			ctx.beginPath();
			ctx.arc(x - 16 * s, y - 14 * s, 0.5, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x + 16 * s, y - 14 * s, 0.5, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x, y - 4 * s, 24 * s, 0.18 * Math.PI, 0.82 * Math.PI);
			ctx.stroke();
			ctx.restore();
		};
		if (smiles) {
			smile(118, 150, 0.8);
			smile(196, 158, 0.8);
		}
	});

const skyTex = () =>
	gradientTexture([
		[0, '#081120'],
		[0.4, '#12213a'],
		[0.66, '#233552'],
		[0.8, '#4a4258'],
		[0.9, '#8a5a3a'],
		[1, '#b06a2a'],
	]);

const buildingsTex = () =>
	canvasTexture(1024, 256, (ctx, w, h) => {
		ctx.clearRect(0, 0, w, h);
		let x = 0;
		let i = 0;
		while (x < w) {
			const bw = 60 + rand(i, 7) * 110;
			const bh = 40 + rand(i, 8) * 120;
			ctx.fillStyle = i % 2 ? '#0d121a' : '#111823';
			ctx.fillRect(x, h - bh, bw, bh);
			for (let wy = h - bh + 12; wy < h - 10; wy += 18) {
				for (let wx = x + 8; wx < x + bw - 10; wx += 16) {
					const r = rand(wx * 3.1 + wy, i);
					if (r > 0.82) {
						ctx.fillStyle = r > 0.95 ? 'rgba(92,242,230,0.55)' : 'rgba(255,170,70,0.75)';
						ctx.fillRect(wx, wy, 6, 8);
					}
				}
			}
			x += bw + 4;
			i++;
		}
	});

export const BusStopSet: React.FC<{t: number; rain?: number; light?: number}> = ({t, rain = 1, light = 1}) => {
	const mode = useMode();
	const tex = useMemo(() => ({fog: fogTexture(true), fog2: fogTexture(false), sky: skyTex(), bld: buildingsTex(), glow: glowTexture()}), []);
	const drops = useMemo(() => Array.from({length: 140}, (_, i) => i), []);
	return (
		<group>
			{/* sky and city, far back */}
			<Ink shape={['plane', 80, 16]} color="#ffffff" map={tex.sky} position={[0, 4.5, -30]} flat={1} />
			<Ink shape={['plane', 46, 9]} color="#ffffff" map={tex.bld} position={[0, 4.4, -22]} opts={{transparent: true}} flat={1} />
			{/* ground: sidewalk, curb, road */}
			<Ink shape={['box', 30, 0.12, 3.2]} color="#1f2630" position={[0, -0.06, -0.4]} receive />
			<Ink shape={['box', 80, 0.1, 22]} color="#151b24" position={[0, -0.09, -13]} receive />
			<Ink shape={['box', 30, 0.14, 0.18]} color="#2c3440" position={[0, -0.05, 1.25]} receive />
			<Ink shape={['box', 30, 0.1, 14]} color="#121820" position={[0, -0.11, 8.3]} receive />
			{[...Array(6)].map((_, i) => (
				<Ink key={i} shape={['box', 1.4, 0.005, 0.12]} color="#5b5f66" position={[-7 + i * 3, -0.055, 6.5]} receive />
			))}
			{/* shelter: posts, roof, fogged glass with the two small smiles */}
			{[-1.7, -0.25, 1.2].map((x, i) => (
				<Ink key={i} shape={['box', 0.07, 2.4, 0.07]} color="#39424e" position={[x, 1.2, -0.85]} outline cast receive />
			))}
			<Ink shape={['box', 3.3, 0.08, 1.25]} color="#2a313b" position={[-0.25, 2.42, -0.3]} outline cast receive />
			<Ink shape={['plane', 1.4, 1.65]} color="#ffffff" map={tex.fog} position={[-0.97, 1.28, -0.87]} opts={{transparent: true, depthWrite: false}} />
			<Ink shape={['plane', 1.4, 1.65]} color="#ffffff" map={tex.fog2} position={[0.47, 1.28, -0.87]} opts={{transparent: true, depthWrite: false}} />
			<Ink shape={['box', 1.5, 0.05, 0.3]} color="#4a525e" position={[-0.97, 0.47, -0.68]} outline cast receive />
			{/* bus stop sign */}
			<Ink shape={['cyl', 0.028, 0.028, 2.7, 12]} color="#525a66" position={[-1.95, 1.35, 0.55]} outline cast />
			<Ink shape={['cyl', 0.24, 0.24, 0.03, 32]} color={COLORS.white} position={[-1.95, 2.45, 0.55]} rotation={[Math.PI / 2, 0, 0]} outline cast />
			<Ink shape={['rbox', 0.24, 0.13, 0.04, 0.02]} color="#1b2028" position={[-1.95, 2.46, 0.57]} />
			{/* street light: amber, the future colour */}
			<Ink shape={['cyl', 0.05, 0.06, 4.6, 12]} color="#3a434f" position={[2.6, 2.3, -1.6]} outline cast />
			<Ink shape={['rbox', 0.7, 0.1, 0.22, 0.04]} color="#3a434f" position={[2.3, 4.6, -1.6]} outline />
			<Ink shape={['box', 0.46, 0.03, 0.14]} color="#ffd9a1" position={[2.2, 4.54, -1.6]} glow={2.2} />
			<Glow position={[2.2, 4.45, -1.5]} size={2.6} color={COLORS.amber} intensity={0.55 * light} tex={tex.glow} />
			<Glow position={[2.2, 4.45, -1.5]} size={0.8} color="#ffe2b0" intensity={0.9 * light} tex={tex.glow} />
			<Spot position={[2.2, 4.4, -1.4]} target={[SUBJECT_X, 0, 0.2]} angle={0.75} penumbra={0.65} intensity={22 * mode.light * light} distance={14} decay={1.6} color="#ffd2a1" />
			<directionalLight position={[-4, 6, 8]} intensity={0.9 * mode.light} color={'#8fb0d4'} />
			<ambientLight intensity={0.35 * mode.light} color={'#8aa0bb'} />
			{/* rain: thin streaks, frozen inside the photograph */}
			{rain > 0
				? drops.map((i) => {
						const x = (rand(i, 21) - 0.5) * 9;
						const z = (rand(i, 22) - 0.3) * 6;
						const sp = 3.5 + rand(i, 23) * 1.5;
						const y = 4.8 - (((t * sp + rand(i, 24) * 5) % 5) + 5) % 5;
						return (
							<Ink
								key={i}
								shape={['box', 0.006, 0.22, 0.006]}
								color="#9fb6cc"
								position={[x, y, z]}
								rotation={[0, 0, 0.08]}
								opacity={0.35 * rain}
								flat={1}
							/>
						);
					})
				: null}
		</group>
	);
};

// The friend: almost always outside the frame. Only the hand is seen in the photo.
export const friendRig = (subjectShoulderL: THREE.Vector3, t: number, talk: number): Rig => {
	const r = basePose();
	r.headYaw = -0.5;
	r.handR.copy(subjectShoulderL);
	r.elbowR.set(-0.4, 1.0, 0.6);
	r.handL.set(0.2 + 0.05 * talk, 0.95 + 0.25 * talk, 0.15);
	r.expr = talk > 0.3 ? 'o' : 'smile';
	r.mouth = 0.6;
	r.blink = blinkAt(t + 1.1);
	return r;
};

export const PhotoWorld: React.FC<{s: PhotoState; showFriend?: boolean; hideSubject?: boolean; friendFlat?: number; flatAll?: number}> = ({s, hideSubject = false, friendFlat, flatAll}) => {
	const mode = useMode();
	const rig = subjectRig(s);
	const cup = cupFromRig(rig, s);
	// subject's left shoulder in world space, for the friend's hand
	const shoulderW = new THREE.Vector3(SUBJECT_X + 0.1, DIM.torso + 0.92 - 0.04, 0.02);
	const friendPos = new THREE.Vector3(SUBJECT_X + 0.64, 0, 0.14);
	const fYaw = -0.35;
	const local = shoulderW.clone().sub(friendPos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -fYaw);
	const fr = friendRig(local, s.t, s.friend > 0.5 ? 0.5 + 0.5 * Math.sin(s.t * 6) : 0);
	const handVis = s.hand > 0.01;
	const base = flatAll === undefined ? mode : {...mode, flat: flatAll};
	const fm = friendFlat === undefined ? base : {...mode, flat: friendFlat};
	return (
		<ModeContext.Provider value={base}>
			<group>
				<BusStopSet t={s.frozen ? 0.37 : s.t} />
				{hideSubject ? null : (
					<group position={[SUBJECT_X, 0, 0]}>
						<Stickman rig={rig} scarf={s.scarf} />
						<TakeawayCup position={cup.p} tilt={cup.tilt} />
					</group>
				)}
				{handVis || s.friend > 0 ? (
					<ModeContext.Provider value={fm}>
						<group position={friendPos} rotation={[0, fYaw, 0]}>
							<Stickman rig={fr} visible={handVis || s.friend > 0} />
						</group>
					</ModeContext.Provider>
				) : null}
			</group>
		</ModeContext.Provider>
	);
};

export const rigClone = cloneRig;
