import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Glow, Ink} from './Ink';
import {COLORS} from './materials';
import {useMode} from './mode';
import {Spot} from './Photo';
import {canvasTexture, glowTexture, rand} from './textures';

// The hallway, evening. Dollhouse construction: walls are single sided and face
// inward, so a camera outside a wall sees through it.
// Layout: back wall z = -1.6 with a sideboard; door on the right wall (x = 1.2);
// window on the left wall (x = -1.2); the hallway runs toward +z.

export const HALL = {w: 2.4, back: -1.6, front: 4.5, h: 2.6, boardTop: 0.86, boardZ: -1.38};
export const BOOK_POS = new THREE.Vector3(-0.05, HALL.boardTop + 0.026, -1.36);
export const PIN_SPOT = new THREE.Vector3(1.19, 1.45, 0.55); // where the photograph ends up on the right wall

const floorTex = () =>
	canvasTexture(512, 1024, (ctx, w, h) => {
		ctx.fillStyle = '#20262e';
		ctx.fillRect(0, 0, w, h);
		const pw = w / 5;
		for (let i = 0; i < 5; i++) {
			let y = -rand(i, 2) * 300;
			while (y < h) {
				const len = 240 + rand(i * 9 + y, 3) * 260;
				ctx.fillStyle = `rgb(${40 + rand(i, y) * 8},${46 + rand(i, y + 1) * 8},${56 + rand(i, y + 2) * 8})`;
				ctx.fillRect(i * pw + 1, y + 1, pw - 2, len - 2);
				y += len;
			}
		}
	});

const wallTex = () =>
	canvasTexture(256, 256, (ctx, w, h) => {
		ctx.fillStyle = '#34404e';
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 400; i++) {
			ctx.fillStyle = `rgba(255,255,255,${rand(i, 5) * 0.018})`;
			ctx.fillRect(rand(i, 1) * w, rand(i, 2) * h, 2, 2);
		}
	});

export const DRAWER_HANDLE = new THREE.Vector3(0.36, 0.745, HALL.boardZ + 0.205);

export const Hallway: React.FC<{
	lamp?: number;
	window?: number;
	t?: number;
	lightsOff?: number;
	doorAjar?: number;
	book?: 'open' | 'closed' | 'none';
	drawer?: number;
	windowLight?: [number, number, number];
	children?: React.ReactNode;
}> = ({lamp = 1, window = 1, t = 0, lightsOff = 0, doorAjar = 0, book = 'open', drawer = 0, windowLight = [-0.7, 1.6, 0.6], children}) => {
	const mode = useMode();
	const tex = useMemo(() => {
		const f = floorTex();
		f.wrapS = f.wrapT = THREE.RepeatWrapping;
		f.repeat.set(1, 3);
		const wl = wallTex();
		wl.wrapS = wl.wrapT = THREE.RepeatWrapping;
		wl.repeat.set(3, 2);
		return {floor: f, wall: wl, glow: glowTexture()};
	}, []);
	const L = (1 - lightsOff) * lamp;
	const len = HALL.front - HALL.back;
	const midZ = (HALL.front + HALL.back) / 2;
	const flick = 1 - 0.04 * Math.max(0, Math.sin(t * 13.1) * Math.sin(t * 5.3));
	return (
		<group>
			{/* floor and ceiling */}
			<Ink shape={['plane', HALL.w, len]} map={tex.floor} color="#ffffff" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receive />
			<Ink shape={['plane', HALL.w, len]} color="#11161c" rotation={[Math.PI / 2, 0, 0]} position={[0, HALL.h, midZ]} />
			{/* walls (inward facing) */}
			<Ink shape={['plane', HALL.w, HALL.h]} map={tex.wall} color="#ffffff" position={[0, HALL.h / 2, HALL.back]} receive />
			<Ink shape={['plane', len, HALL.h]} map={tex.wall} color="#ffffff" rotation={[0, Math.PI / 2, 0]} position={[-HALL.w / 2, HALL.h / 2, midZ]} receive />
			<Ink shape={['plane', len, HALL.h]} map={tex.wall} color="#ffffff" rotation={[0, -Math.PI / 2, 0]} position={[HALL.w / 2, HALL.h / 2, midZ]} receive />
			{/* skirting */}
			<Ink shape={['box', HALL.w, 0.09, 0.02]} color="#2a323d" position={[0, 0.045, HALL.back + 0.01]} />
			<Ink shape={['box', 0.02, 0.09, len]} color="#2a323d" position={[-HALL.w / 2 + 0.01, 0.045, midZ]} />
			<Ink shape={['box', 0.02, 0.09, len]} color="#2a323d" position={[HALL.w / 2 - 0.01, 0.045, midZ]} />
			{/* sideboard against the back wall */}
			<group position={[0, 0, HALL.boardZ]}>
				<Ink shape={['rbox', 1.5, 0.05, 0.42, 0.012]} color="#2b3440" position={[0, HALL.boardTop - 0.025, 0]} outline cast receive />
				<Ink shape={['rbox', 1.44, 0.62, 0.38, 0.01]} color="#222a34" position={[0, HALL.boardTop - 0.36, -0.01]} outline cast receive />
				<Ink shape={['box', 0.006, 0.42, 0.005]} color="#11161c" position={[0, HALL.boardTop - 0.44, 0.181]} />
				<Ink shape={['box', 1.4, 0.006, 0.005]} color="#11161c" position={[0, HALL.boardTop - 0.2, 0.181]} />
				{[-0.36, 0.36].map((x, i) => (
					<Ink key={i} shape={['sphere', 0.018]} color="#8b97a5" position={[x * 0.25 + (i ? 0.06 : -0.06), HALL.boardTop - 0.4, 0.19]} outline />
				))}
				{/* top drawers: the left one is fixed, the right one opens */}
				<Ink shape={['rbox', 0.08, 0.02, 0.025, 0.008]} color="#a7b2bf" position={[-0.36, 0.745 - 0.0, 0.2]} outline />
				<group position={[0.36, 0, drawer]}>
					<Ink shape={['rbox', 0.62, 0.13, 0.02, 0.006]} color="#26303b" position={[0, 0.745, 0.188]} outline cast receive />
					<Ink shape={['rbox', 0.08, 0.02, 0.025, 0.008]} color="#a7b2bf" position={[0, 0.745, 0.205]} outline />
					{drawer > 0.01 ? (
						<group>
							<Ink shape={['box', 0.58, 0.11, 0.008]} color="#1a2029" position={[0, 0.745, 0.17 - 0.33]} />
							<Ink shape={['box', 0.008, 0.11, 0.34]} color="#1d242d" position={[-0.29, 0.745, 0.01]} />
							<Ink shape={['box', 0.008, 0.11, 0.34]} color="#1d242d" position={[0.29, 0.745, 0.01]} />
							<Ink shape={['box', 0.58, 0.008, 0.34]} color="#151a21" position={[0, 0.69, 0.01]} receive />
							{/* things you are afraid of: unopened letters, an old key */}
							<Ink shape={['box', 0.2, 0.004, 0.13]} color="#c9c1ae" position={[-0.1, 0.697, 0.0]} rotation={[0, 0.2, 0]} />
							<Ink shape={['box', 0.2, 0.004, 0.13]} color="#b9b19e" position={[-0.06, 0.701, 0.03]} rotation={[0, -0.15, 0]} />
							<Ink shape={['box', 0.05, 0.004, 0.012]} color="#8b7a4a" position={[0.14, 0.697, -0.02]} rotation={[0, 0.6, 0]} />
						</group>
					) : null}
				</group>
				{[-0.68, 0.68].map((x, i) => (
					<Ink key={i} shape={['box', 0.04, 0.16, 0.04]} color="#1a2029" position={[x, 0.08, 0.13]} />
				))}
			</group>
			{/* table lamp: warm, the only real light */}
			<group position={[-0.56, HALL.boardTop, -1.42]}>
				<Ink shape={['cyl', 0.07, 0.09, 0.025, 24]} color="#3a434f" position={[0, 0.012, 0]} outline cast />
				<Ink shape={['cyl', 0.012, 0.012, 0.32, 10]} color="#3a434f" position={[0, 0.17, 0]} outline cast />
				<Ink shape={['cyl', 0.1, 0.15, 0.2, 28]} color="#ffcf8a" position={[0, 0.39, 0]} flat={1} glow={0.12 * L * flick} outline />
				<Glow position={[0, 0.39, 0.05]} size={1.3} color={COLORS.amber} intensity={0.32 * L * flick} tex={tex.glow} />
				<Glow position={[0, 0.36, 0.05]} size={0.42} color="#ffe6c0" intensity={0.4 * L * flick} tex={tex.glow} />
			</group>
			<Spot position={[-0.62, HALL.boardTop + 0.95, -0.95]} target={[0.15, 0.0, 0.3]} angle={1.15} penumbra={0.9} intensity={1.6 * mode.light * L * flick} distance={9} decay={1.5} color="#ffb04a" />
			<pointLight position={[-0.45, HALL.boardTop + 0.75, -1.0]} intensity={0.5 * mode.light * L * flick} distance={6} decay={1.5} color="#ffb04a" />
			{/* book on the sideboard, a small stack beside it */}
			{book === 'open' ? (
				<group position={BOOK_POS}>
					<Ink shape={['rbox', 0.24, 0.022, 0.32, 0.004]} color="#cfc3aa" position={[-0.122, 0, 0]} rotation={[0, 0, -0.03]} cast receive outline />
					<Ink shape={['rbox', 0.24, 0.022, 0.32, 0.004]} color="#cfc3aa" position={[0.122, 0, 0]} rotation={[0, 0, 0.03]} cast receive outline />
					<Ink shape={['box', 0.5, 0.012, 0.335]} color="#3b2a2a" position={[0, -0.016, 0]} />
				</group>
			) : book === 'closed' ? (
				<group position={[BOOK_POS.x, HALL.boardTop, BOOK_POS.z]}>
					<Ink shape={['rbox', 0.25, 0.006, 0.335, 0.002]} color="#4a3030" position={[0, 0.003, 0]} cast receive outline />
					<Ink shape={['box', 0.24, 0.036, 0.325]} color="#d9cfb8" position={[0.002, 0.024, 0]} cast receive />
					<Ink shape={['rbox', 0.25, 0.006, 0.335, 0.002]} color="#4a3030" position={[0, 0.045, 0]} cast receive outline />
					<Ink shape={['box', 0.012, 0.048, 0.335]} color="#3d2727" position={[-0.125, 0.024, 0]} />
					<Ink shape={['box', 0.16, 0.002, 0.04]} color="#b8925a" position={[0, 0.0485, -0.11]} />
				</group>
			) : null}
			{[0, 1, 2].map((i) => (
				<Ink key={i} shape={['rbox', 0.26 - i * 0.02, 0.04, 0.2, 0.006]} color={['#2f3b4a', '#4a3b33', '#2b4048'][i]} position={[0.5, HALL.boardTop + 0.02 + i * 0.04, -1.42]} rotation={[0, 0.1 * i - 0.08, 0]} outline cast receive />
			))}
			{/* window on the left wall: cold night */}
			<group position={[-HALL.w / 2 + 0.01, 1.5, 0.6]} rotation={[0, Math.PI / 2, 0]}>
				<Ink shape={['plane', 0.9, 1.1]} color="#0d2230" glow={0.25 * window} />
				<Ink shape={['box', 0.96, 0.05, 0.05]} color="#2a323d" position={[0, 0.55, 0.02]} outline />
				<Ink shape={['box', 0.96, 0.05, 0.05]} color="#2a323d" position={[0, -0.55, 0.02]} outline />
				<Ink shape={['box', 0.05, 1.1, 0.05]} color="#2a323d" position={[0, 0, 0.02]} outline />
				<Ink shape={['box', 0.05, 1.1, 0.05]} color="#2a323d" position={[-0.47, 0, 0.02]} outline />
				<Ink shape={['box', 0.05, 1.1, 0.05]} color="#2a323d" position={[0.47, 0, 0.02]} outline />
			</group>
			<pointLight position={windowLight} intensity={1.1 * mode.light * window * (1 - lightsOff * 0.6)} distance={4} decay={1.5} color="#a8e8f0" />
			{/* door on the right wall, with handle and keyhole */}
			<group position={[HALL.w / 2 - 0.012, 0, 2.3]} rotation={[0, -Math.PI / 2, 0]}>
				<Ink shape={['box', 0.96, 2.12, 0.04]} color="#2d3642" position={[0, 1.06, 0]} outline />
				<group position={[0.44, 0, 0.02]} rotation={[0, -doorAjar * 1.2, 0]}>
					<Ink shape={['rbox', 0.86, 2.04, 0.05, 0.01]} color="#26303b" position={[-0.44, 1.03, 0]} outline cast receive />
					<Ink shape={['rbox', 0.11, 0.025, 0.03, 0.01]} color="#a7b2bf" position={[-0.8, 1.02, 0.05]} outline />
					<Ink shape={['cyl', 0.018, 0.018, 0.02, 16]} color="#8b97a5" position={[-0.8, 0.92, 0.035]} rotation={[Math.PI / 2, 0, 0]} outline />
					<Ink shape={['box', 0.004, 0.016, 0.01]} color="#0b0e12" position={[-0.8, 0.92, 0.046]} />
				</group>
			</group>
			{/* coat hooks and a light switch on the right wall */}
			<group position={[HALL.w / 2 - 0.02, 1.72, 1.1]} rotation={[0, -Math.PI / 2, 0]}>
				<Ink shape={['rbox', 0.6, 0.06, 0.02, 0.01]} color="#2f3945" outline />
				{[-0.2, 0, 0.2].map((x, i) => (
					<Ink key={i} shape={['capsule', 0.012, 0.05]} color="#8b97a5" position={[x, -0.02, 0.04]} rotation={[1.1, 0, 0]} outline />
				))}
			</group>
			<group position={[HALL.w / 2 - 0.012, 1.22, 1.62]} rotation={[0, -Math.PI / 2, 0]}>
				<Ink shape={['rbox', 0.08, 0.12, 0.012, 0.006]} color="#d9dde2" outline />
				<Ink shape={['rbox', 0.026, 0.045, 0.012, 0.004]} color="#eef0f2" position={[0, lightsOff > 0.5 ? -0.012 : 0.012, 0.008]} outline />
			</group>
			{children}
			<ambientLight intensity={0.75 * mode.light * (1 - 0.85 * lightsOff)} color="#8496ad" />
			<hemisphereLight args={['#6d84a3', '#1a1f27', 0.9 * mode.light * (1 - 0.85 * lightsOff)]} />
		</group>
	);
};
