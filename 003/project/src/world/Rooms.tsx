import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Glow, Ink} from './Ink';
import {COLORS} from './materials';
import {useMode} from './mode';
import {PhotoCard, Spot} from './Photo';
import {usePhotoTex} from './photoTex';
import {canvasTexture, glowTexture, gradientTexture, rand} from './textures';

// ---------------- the neighbour's room, seen through a video call ----------------
export const CALL_X = 500;
export const CALL_FRAME = new THREE.Vector3(CALL_X + 0.62, 1.39, -1.1);

const wallpaper = (base: string, stripe: string) =>
	canvasTexture(256, 256, (ctx, w, h) => {
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = stripe;
		for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 3, h);
	});

const Books: React.FC<{x: number; y: number; z: number; n: number; seed: number}> = ({x, y, z, n, seed}) => {
	const cols = ['#4a3b33', '#2f3b4a', '#5a4a2a', '#2b4048', '#4b2f35', '#39424e'];
	let cx = x;
	return (
		<>
			{Array.from({length: n}).map((_, i) => {
				const w = 0.03 + rand(i, seed) * 0.03;
				const h = 0.18 + rand(i, seed + 1) * 0.08;
				const px = cx + w / 2;
				cx += w + 0.004;
				return <Ink key={i} shape={['box', w, h, 0.16]} color={cols[Math.floor(rand(i, seed + 2) * cols.length)]} position={[px, y + h / 2, z]} rotation={[0, 0, rand(i, seed + 3) > 0.85 ? 0.12 : 0]} outline />;
			})}
		</>
	);
};

export const CallRoom: React.FC<{t: number}> = ({t}) => {
	const mode = useMode();
	const tex = useMemo(() => ({wall: wallpaper('#4a4740', '#524f47'), glow: glowTexture()}), []);
	const photo = usePhotoTex();
	return (
		<group>
			<Ink shape={['plane', 6, 3.2]} map={tex.wall} color="#ffffff" position={[CALL_X, 1.6, -1.35]} receive />
			<Ink shape={['plane', 6, 4]} color="#2a2724" rotation={[-Math.PI / 2, 0, 0]} position={[CALL_X, 0, 0.4]} receive />
			{/* bookshelf */}
			<group position={[CALL_X + 0.55, 0, -1.2]}>
				<Ink shape={['box', 1.1, 0.04, 0.3]} color="#6b5a46" position={[0, 0.9, 0]} outline cast receive />
				<Ink shape={['box', 1.1, 0.04, 0.3]} color="#6b5a46" position={[0, 1.3, 0]} outline cast receive />
				<Ink shape={['box', 1.1, 0.04, 0.3]} color="#6b5a46" position={[0, 1.7, 0]} outline cast receive />
				<Ink shape={['box', 0.04, 1.3, 0.3]} color="#5c4d3c" position={[-0.55, 1.2, 0]} outline cast />
				<Ink shape={['box', 0.04, 1.3, 0.3]} color="#5c4d3c" position={[0.55, 1.2, 0]} outline cast />
				<Books x={-0.5} y={0.92} z={0} n={11} seed={1} />
				<Books x={-0.48} y={1.72} z={0} n={13} seed={7} />
				<Books x={-0.5} y={1.32} z={0} n={4} seed={4} />
			</group>
			{/* the photograph, framed, on the middle shelf */}
			<group position={CALL_FRAME} rotation={[0.08, -0.12, 0]}>
				<Ink shape={['rbox', 0.31, 0.22, 0.02, 0.006]} color="#20262e" position={[0, 0.02, -0.012]} outline cast />
				<PhotoCard map={photo} back={false} scale={1.0} position={[0, 0, 0]} cast={false} />
			</group>
			{/* plant and lamp */}
			<group position={[CALL_X - 0.75, 0, -1.0]}>
				<Ink shape={['cyl', 0.12, 0.09, 0.22, 20]} color="#7a5a44" position={[0, 0.82, 0]} outline cast />
				{[0, 1, 2, 3, 4].map((i) => (
					<Ink key={i} shape={['sphere', 0.11]} color={i % 2 ? '#3c6a4a' : '#2f5a40'} position={[Math.sin(i * 1.3) * 0.08, 1.02 + i * 0.06, Math.cos(i * 1.3) * 0.06]} outline cast />
				))}
				<Ink shape={['box', 0.5, 0.71, 0.4]} color="#3b3530" position={[0.0, 0.355, 0]} outline cast receive />
			</group>
			<group position={[CALL_X - 0.4, 0.75, -0.85]}>
				<Ink shape={['cyl', 0.13, 0.17, 0.2, 24]} color="#ffd9a6" position={[0, 0.5, 0]} flat={1} glow={0.25} outline />
				<Ink shape={['cyl', 0.01, 0.01, 0.4, 8]} color="#3a3430" position={[0, 0.2, 0]} />
				<Glow position={[0, 0.5, 0.05]} size={1.2} color={COLORS.amber} intensity={0.3} tex={tex.glow} />
			</group>
			<Spot position={[CALL_X - 0.3, 1.5, -0.6]} target={[CALL_X + 0.3, 0.9, -1.2]} intensity={5 * mode.light} angle={1.2} penumbra={0.9} decay={1.4} color="#ffd6a3" />
			<pointLight position={[CALL_X, 1.3, 0.8]} intensity={1.6 * mode.light} distance={4} decay={1.5} color="#bfe8ff" />
			<ambientLight intensity={0.8 * mode.light} color="#a39a8e" />
		</group>
	);
};

// ---------------- the kitchen: a Tuesday that has not arrived ----------------
export const KITCHEN_X = 600;
export const KETTLE = new THREE.Vector3(KITCHEN_X + 0.55, 0.92, -1.05);
export const HOOK_POS = new THREE.Vector3(KITCHEN_X - 1.38, 1.65, -0.3);
export const KTABLE = new THREE.Vector3(KITCHEN_X - 0.3, 0.76, 0.35);

const skyMorning = () =>
	gradientTexture([
		[0, '#3a5f86'],
		[0.6, '#9cb4c8'],
		[1, '#f2c48a'],
	]);

export const Kitchen: React.FC<{t: number; morning?: number; scarf?: boolean; steam?: number; kettleOn?: number; rain?: number}> = ({t, morning = 1, scarf = true, steam = 0, kettleOn = 0, rain = 0}) => {
	const mode = useMode();
	const tex = useMemo(() => ({sky: skyMorning(), wall: wallpaper('#3b4650', '#414c57'), glow: glowTexture()}), []);
	return (
		<group>
			<Ink shape={['plane', 4, 2.8]} map={tex.wall} color="#ffffff" position={[KITCHEN_X, 1.4, -1.32]} receive />
			<Ink shape={['plane', 4, 2.8]} map={tex.wall} color="#ffffff" position={[KITCHEN_X - 1.45, 1.4, 0]} rotation={[0, Math.PI / 2, 0]} receive />
			<Ink shape={['plane', 4, 4]} color="#2c3239" rotation={[-Math.PI / 2, 0, 0]} position={[KITCHEN_X, 0, 0.4]} receive />
			{/* window over the counter */}
			<group position={[KITCHEN_X - 0.1, 1.6, -1.31]}>
				<Ink shape={['plane', 1.0, 0.8]} map={tex.sky} color="#ffffff" flat={1} glow={0.2 * morning} />
				<Ink shape={['box', 1.06, 0.05, 0.05]} color="#d9dde2" position={[0, 0.41, 0.02]} outline />
				<Ink shape={['box', 1.06, 0.05, 0.05]} color="#d9dde2" position={[0, -0.41, 0.02]} outline />
				<Ink shape={['box', 0.05, 0.82, 0.05]} color="#d9dde2" position={[-0.51, 0, 0.02]} outline />
				<Ink shape={['box', 0.05, 0.82, 0.05]} color="#d9dde2" position={[0.51, 0, 0.02]} outline />
				<Ink shape={['box', 0.04, 0.82, 0.04]} color="#d9dde2" position={[0, 0, 0.02]} outline />
				{rain > 0
					? Array.from({length: 40}).map((_, i) => (
							<Ink key={i} shape={['box', 0.004, 0.08, 0.002]} color="#cfe0ee" position={[(rand(i, 3) - 0.5) * 0.95, 0.4 - ((t * (0.6 + rand(i, 4)) + rand(i, 5)) % 1) * 0.8, 0.01]} opacity={0.5 * rain} flat={1} />
						))
					: null}
			</group>
			{/* counter and cabinets */}
			<Ink shape={['box', 2.6, 0.06, 0.62]} color="#c9ccd1" position={[KITCHEN_X, 0.89, -1.0]} outline cast receive />
			<Ink shape={['box', 2.56, 0.86, 0.58]} color="#33404d" position={[KITCHEN_X, 0.43, -1.02]} outline cast receive />
			{[-1.0, -0.33, 0.34, 1.0].map((x, i) => (
				<Ink key={i} shape={['box', 0.1, 0.02, 0.02]} color="#a7b2bf" position={[KITCHEN_X + x, 0.75, -0.72]} outline />
			))}
			<Ink shape={['box', 2.6, 0.7, 0.36]} color="#33404d" position={[KITCHEN_X + 0.0, 2.25, -1.13]} outline cast />
			{/* kettle: body, handle, spout, switch light */}
			<group position={KETTLE}>
				<Ink shape={['cyl', 0.085, 0.1, 0.2, 24]} color="#e7e9ec" position={[0, 0.1, 0]} outline cast />
				<Ink shape={['cyl', 0.06, 0.085, 0.03, 24]} color="#d9dde2" position={[0, 0.215, 0]} outline />
				<Ink shape={['torus', 0.07, 0.014, Math.PI]} color="#2a313b" position={[-0.1, 0.14, 0]} rotation={[0, 0, Math.PI / 2]} outline />
				<Ink shape={['cyl', 0.014, 0.022, 0.09, 12]} color="#e7e9ec" position={[0.11, 0.16, 0]} rotation={[0, 0, -0.9]} outline />
				<Ink shape={['sphere', 0.008]} color={kettleOn > 0.5 ? COLORS.amber : '#555'} position={[-0.06, 0.02, 0.09]} flat={1} glow={kettleOn > 0.5 ? 1.5 : 0} />
				{steam > 0
					? [0, 1, 2, 3, 4, 5].map((i) => {
							const ph = (t * 0.6 + i / 6) % 1;
							return <Ink key={i} shape={['sphere', 0.03 + ph * 0.05]} color="#e9eef3" position={[0.16 + ph * 0.05 + Math.sin(t * 3 + i) * 0.02, 0.22 + ph * 0.45, 0]} opacity={steam * 0.35 * (1 - ph)} flat={1} />;
						})
					: null}
			</group>
			<Ink shape={['cyl', 0.04, 0.038, 0.095, 20]} color={COLORS.amber} position={[KITCHEN_X + 0.2, 0.97, -1.0]} outline cast />
			<Ink shape={['rbox', 0.26, 0.18, 0.16, 0.03]} color="#8b97a5" position={[KITCHEN_X - 0.75, 1.01, -1.05]} outline cast />
			{/* coat hook with the scarf */}
			<group position={HOOK_POS}>
				<Ink shape={['rbox', 0.03, 0.2, 0.4, 0.01]} color="#2f3945" rotation={[0, 0, 0]} outline />
				<Ink shape={['capsule', 0.012, 0.05]} color="#a7b2bf" position={[0.04, -0.02, 0]} rotation={[0, 0, 1.2]} outline />
				{scarf ? (
					<group position={[0.06, -0.05, 0]}>
						<Ink shape={['box', 0.03, 0.55, 0.12]} color={COLORS.amber} position={[0.0, -0.27, -0.06]} rotation={[0, 0, 0.04]} outline cast />
						<Ink shape={['box', 0.03, 0.48, 0.12]} color="#e08a12" position={[0.01, -0.24, 0.07]} rotation={[0, 0, -0.05]} outline cast />
						<Ink shape={['box', 0.035, 0.02, 0.13]} color="#c96a0e" position={[0.0, -0.45, -0.06]} />
						<Ink shape={['box', 0.035, 0.02, 0.13]} color="#c96a0e" position={[0.01, -0.4, 0.07]} />
					</group>
				) : null}
			</group>
			{/* small table */}
			<group position={KTABLE}>
				<Ink shape={['cyl', 0.42, 0.42, 0.04, 36]} color="#7a6a58" position={[0, 0, 0]} outline cast receive />
				<Ink shape={['cyl', 0.04, 0.06, 0.74, 12]} color="#4a4038" position={[0, -0.39, 0]} outline cast />
			</group>
			<directionalLight position={[KITCHEN_X - 0.1, 2.6, -3]} intensity={1.4 * mode.light * morning} color="#ffe2bd" castShadow={mode.light > 0.02} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} />
			<ambientLight intensity={(0.55 + 0.4 * morning) * mode.light} color="#9aa8b8" />
			<hemisphereLight args={['#b8c8d8', '#2a2f36', 0.6 * mode.light]} />
		</group>
	);
};

// ---------------- the desk: go to work ----------------
export const DESK_X = 700;
export const Desk: React.FC<{t: number}> = ({t}) => {
	const mode = useMode();
	return (
		<group>
			<Ink shape={['plane', 5, 3]} color="#28303a" position={[DESK_X, 1.5, -1.3]} receive />
			<Ink shape={['plane', 5, 4]} color="#1e242c" rotation={[-Math.PI / 2, 0, 0]} position={[DESK_X, 0, 0.4]} receive />
			<Ink shape={['box', 1.4, 0.04, 0.7]} color="#8a8f97" position={[DESK_X, 0.74, -0.7]} outline cast receive />
			<Ink shape={['box', 0.04, 0.72, 0.6]} color="#5a6170" position={[DESK_X - 0.65, 0.36, -0.7]} outline />
			<Ink shape={['box', 0.04, 0.72, 0.6]} color="#5a6170" position={[DESK_X + 0.65, 0.36, -0.7]} outline />
			<Ink shape={['rbox', 0.62, 0.38, 0.03, 0.01]} color="#20262e" position={[DESK_X, 1.08, -0.95]} outline cast />
			<Ink shape={['plane', 0.58, 0.34]} color="#9fd6ff" position={[DESK_X, 1.08, -0.934]} flat={1} glow={0.35} />
			<Ink shape={['box', 0.04, 0.16, 0.04]} color="#20262e" position={[DESK_X, 0.84, -0.95]} />
			<Ink shape={['rbox', 0.4, 0.02, 0.14, 0.006]} color="#c9ccd1" position={[DESK_X, 0.77, -0.6]} outline />
			<pointLight position={[DESK_X, 1.1, -0.6]} intensity={1.4 * mode.light} distance={3} decay={1.5} color="#bfe8ff" />
			<ambientLight intensity={0.8 * mode.light} color="#8496ad" />
			<directionalLight position={[DESK_X + 2, 3, 2]} intensity={0.7 * mode.light} color="#dfe6ee" />
		</group>
	);
};

export {rand};
