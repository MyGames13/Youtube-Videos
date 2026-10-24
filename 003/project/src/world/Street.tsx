import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Glow, Ink} from './Ink';
import {COLORS} from './materials';
import {useMode} from './mode';
import {PhotoCard, Spot} from './Photo';
import {Stickman} from './Stickman';
import {walk} from './rig';
import {canvasTexture, glowTexture, rand} from './textures';
import {usePhotoTex} from './photoTex';

// Night street: sidewalk along x, facades at z = -2.2, road toward +z.
// Shop window at x = 4 with the photograph taped inside (Thing 2).
export const SHOP_X = 4.0;

const facadeTex = (seed: number) =>
	canvasTexture(512, 512, (ctx, w, h) => {
		ctx.fillStyle = seed % 2 ? '#1a212b' : '#161c25';
		ctx.fillRect(0, 0, w, h);
		for (let y = 40; y < h - 60; y += 90) {
			for (let x = 30; x < w - 40; x += 95) {
				const r = rand(x * 3.3 + y, seed);
				ctx.fillStyle = r > 0.72 ? (r > 0.93 ? 'rgba(92,242,230,0.55)' : 'rgba(255,170,80,0.7)') : '#0e131a';
				ctx.fillRect(x, y, 52, 62);
				ctx.strokeStyle = '#2a333f';
				ctx.lineWidth = 4;
				ctx.strokeRect(x, y, 52, 62);
			}
		}
	});

const shopTex = () =>
	canvasTexture(512, 320, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, '#0f3a40');
		g.addColorStop(1, '#0a1f25');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		// shelves with vague objects
		for (let i = 0; i < 3; i++) {
			ctx.fillStyle = '#123038';
			ctx.fillRect(20, 80 + i * 90, w - 40, 8);
			for (let k = 0; k < 7; k++) {
				ctx.fillStyle = `rgba(92,242,230,${0.12 + rand(k, i) * 0.2})`;
				const bw = 26 + rand(k, i + 3) * 30;
				ctx.fillRect(30 + k * 66, 80 + i * 90 - 40, bw, 40);
			}
		}
	});

export type Passer = {x0: number; speed: number; z: number; dir: 1 | -1; color: string; phase: number};
export const PASSERS: Passer[] = [
	{x0: -6, speed: 0.9, z: 0.35, dir: 1, color: '#8b97a5', phase: 0.1},
	{x0: 7, speed: 0.8, z: 0.75, dir: -1, color: '#9aa6b4', phase: 0.4},
	{x0: -11, speed: 1.0, z: 0.55, dir: 1, color: '#7d8896', phase: 0.7},
	{x0: 12, speed: 0.85, z: 0.25, dir: -1, color: '#a3adb9', phase: 0.2},
	{x0: 2, speed: 0.7, z: 0.95, dir: -1, color: '#8b97a5', phase: 0.55},
];

export const Street: React.FC<{t: number; passers?: boolean; shopPhoto?: boolean; rain?: number}> = ({t, passers = true, shopPhoto = false, rain = 0}) => {
	const mode = useMode();
	const tex = useMemo(() => ({f: [0, 1, 2, 3].map(facadeTex), shop: shopTex(), glow: glowTexture()}), []);
	const photo = usePhotoTex();
	const lamps = [-6, 0, 6, 12];
	return (
		<group>
			<Ink shape={['box', 60, 0.14, 2.6]} color="#232b36" position={[0, -0.07, -0.9]} receive />
			<Ink shape={['box', 60, 0.16, 0.16]} color="#303a46" position={[0, -0.06, 0.42]} receive />
			<Ink shape={['box', 60, 0.1, 10]} color="#10161e" position={[0, -0.12, 5.4]} receive />
			{[...Array(10)].map((_, i) => (
				<Ink key={i} shape={['box', 1.6, 0.005, 0.12]} color="#4d535c" position={[-27 + i * 6, -0.065, 4.2]} />
			))}
			{/* facades */}
			{[-12, -4, 4, 12].map((x, i) => (
				<group key={i}>
					<Ink shape={['plane', 7.8, 9]} map={tex.f[i % 4]} color="#ffffff" position={[x, 4.5, -2.2]} receive />
					<Ink shape={['box', 7.8, 0.25, 0.2]} color="#2a333f" position={[x, 3.1, -2.1]} outline />
				</group>
			))}
			{/* shop window: cyan, the one you only ever walk past */}
			<group position={[SHOP_X, 0, -2.18]}>
				<Ink shape={['plane', 3.0, 1.9]} map={tex.shop} color="#ffffff" position={[0, 1.45, 0]} glow={0.25} />
				<Ink shape={['box', 3.2, 0.12, 0.14]} color="#2a333f" position={[0, 2.46, 0.05]} outline cast />
				<Ink shape={['box', 3.2, 0.5, 0.18]} color="#222a34" position={[0, 0.25, 0.05]} outline cast receive />
				<Ink shape={['box', 0.1, 2.0, 0.12]} color="#2a333f" position={[-1.55, 1.45, 0.05]} outline />
				<Ink shape={['box', 0.1, 2.0, 0.12]} color="#2a333f" position={[1.55, 1.45, 0.05]} outline />
				<Ink shape={['plane', 3.0, 1.9]} color="#9fe9e4" position={[0, 1.45, 0.08]} opacity={0.07} />
				{shopPhoto ? (
					<group position={[0.55, 1.35, 0.03]} rotation={[0, 0, 0.05]} scale={1.6}>
						<PhotoCard map={photo} back={false} cast={false} />
						<Ink shape={['box', 0.07, 0.02, 0.002]} color="#d8d2b8" position={[0, 0.085, 0.003]} rotation={[0, 0, -0.1]} opacity={0.85} />
					</group>
				) : null}
				<pointLight position={[0, 1.4, 0.8]} intensity={0.9 * mode.light} distance={4} decay={1.5} color="#a8f3ee" />
			</group>
			{/* street lamps */}
			{lamps.map((x, i) => (
				<group key={i} position={[x, 0, 0.3]}>
					<Ink shape={['cyl', 0.05, 0.06, 4.2, 12]} color="#39424e" position={[0, 2.1, 0]} outline cast />
					<Ink shape={['sphere', 0.17]} color="#ffe2b0" position={[0, 4.25, 0]} flat={1} glow={0.5} />
					<Glow position={[0, 4.25, 0.02]} size={2.2} color={COLORS.amber} intensity={0.4} tex={tex.glow} />
				</group>
			))}
			<Spot position={[0, 4.1, 0.3]} target={[0, 0, -0.4]} angle={0.9} penumbra={0.8} intensity={7 * mode.light} distance={12} decay={1.6} color="#ffd6a8" />
			<Spot position={[6, 4.1, 0.3]} target={[6, 0, -0.4]} angle={0.9} penumbra={0.8} intensity={7 * mode.light} distance={12} decay={1.6} color="#ffd6a8" shadow={false} />
			<ambientLight intensity={0.7 * mode.light} color="#6f86a6" />
			<hemisphereLight args={['#4a6488', '#121820', 0.7 * mode.light]} />
			{passers
				? PASSERS.map((p, i) => {
						const x = p.x0 + p.dir * p.speed * t;
						return (
							<group key={i} position={[x, 0, p.z]} rotation={[0, (p.dir * Math.PI) / 2, 0]}>
								<Stickman rig={walk(t + p.phase * 3, p.speed)} color={p.color} />
							</group>
						);
					})
				: null}
			{rain > 0
				? Array.from({length: 160}).map((_, i) => {
						const x = (rand(i, 31) - 0.5) * 16;
						const z = (rand(i, 32) - 0.2) * 5;
						const sp = 4 + rand(i, 33) * 2;
						const y = 5 - (((t * sp + rand(i, 34) * 5) % 5) + 5) % 5;
						return <Ink key={i} shape={['box', 0.006, 0.24, 0.006]} color="#9fb6cc" position={[x, y, z]} rotation={[0, 0, 0.1]} opacity={0.32 * rain} flat={1} />;
					})
				: null}
		</group>
	);
};
