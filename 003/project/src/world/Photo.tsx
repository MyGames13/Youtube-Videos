import React, {useMemo, useRef, useState} from 'react';
import {createPortal, useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {PERF} from '../perf';
import {Glow, Ink} from './Ink';
import {COLORS, makeInk, makeOutline, setFlat} from './materials';
import {applyCam, camFor, CamSpec, ModeContext, modeState, useMode} from './mode';
import {canvasTexture, glowTexture, rand} from './textures';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Photo card: 16:9 image so a full frame push matches the screen exactly.
export const PHOTO = {w: 0.24, h: 0.135, border: 0.011};
export const CARD_W = PHOTO.w + PHOTO.border * 2;
export const CARD_H = PHOTO.h + PHOTO.border * 2.9; // a slightly deeper bottom margin, like a print

export const RT_W = 1280;
export const RT_H = 720;

// Render a scene into a texture with its own camera, forced flat.
export const useRenderTarget = () =>
	useMemo(() => {
		const rt = new THREE.WebGLRenderTarget(RT_W, RT_H, {samples: PERF.msaa, type: PERF.half ? THREE.HalfFloatType : THREE.UnsignedByteType});
		return rt;
	}, []);

export const RenderToTexture: React.FC<{
	rt: THREE.WebGLRenderTarget;
	cam: CamSpec;
	m?: number;
	active?: boolean;
	children: React.ReactNode;
	clear?: string;
	cacheKey?: string; // when given, the target is only re-rendered when the key changes
}> = ({rt, cam, m = 0, active = true, children, clear = '#0b0f15', cacheKey}) => {
	const {gl} = useThree();
	const [scene] = useState(() => new THREE.Scene());
	const [camera] = useState(() => new THREE.PerspectiveCamera(30, RT_W / RT_H, 0.05, 200));
	const last = useRef<string | null>(null);
	applyCam(camera, camFor(cam, m, RT_W / RT_H));
	const draw = () => {
		if (!active) return;
		if (cacheKey !== undefined) {
			const key = cacheKey + JSON.stringify(cam) + m;
			if (last.current === key) return;
			last.current = key;
		}
		const prev = gl.getRenderTarget();
		gl.setRenderTarget(rt);
		gl.setClearColor(clear, 1);
		gl.clear(true, true, true);
		gl.render(scene, camera);
		gl.setRenderTarget(prev);
	};
	useFrame(draw, 1);
	const ms = useMemo(() => modeState(m, new THREE.Vector2(RT_W, RT_H)), [m]);
	return <>{createPortal(<ModeContext.Provider value={ms}>{children}</ModeContext.Provider>, scene)}</>;
};

const handwriting = () =>
	canvasTexture(1024, 600, (ctx, w, h) => {
		ctx.fillStyle = '#efe9dc';
		ctx.fillRect(0, 0, w, h);
		// faint paper fibres
		for (let i = 0; i < 500; i++) {
			ctx.fillStyle = `rgba(120,110,95,${0.03 + rand(i, 9) * 0.04})`;
			ctx.fillRect(rand(i, 1) * w, rand(i, 2) * h, 1 + rand(i, 3) * 3, 1);
		}
		ctx.save();
		ctx.translate(w * 0.5, h * 0.52);
		ctx.rotate(-0.06);
		ctx.fillStyle = '#d9820f';
		ctx.font = '700 190px Caveat';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('Keep it.', 0, 0);
		ctx.restore();
	});

const dateStamp = () =>
	canvasTexture(256, 64, (ctx, w, h) => {
		ctx.clearRect(0, 0, w, h);
		ctx.font = '700 44px "JetBrains Mono"';
		ctx.fillStyle = 'rgba(255,140,40,0.95)';
		ctx.shadowColor = 'rgba(255,120,20,0.9)';
		ctx.shadowBlur = 10;
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText('TUE', w - 10, h / 2);
	});

let cardGeo: THREE.BufferGeometry | null = null;
const getCardGeo = () => (cardGeo ??= new RoundedBoxGeometry(CARD_W, CARD_H, 0.0026, 2, 0.0012));

export type CardProps = {
	map?: THREE.Texture | null;
	position?: THREE.Vector3 | [number, number, number];
	quaternion?: THREE.Quaternion;
	rotation?: [number, number, number];
	scale?: number;
	develop?: number; // 1 = fully developed, 0 = milky fresh print
	glow?: number; // amber warmth
	stamp?: number;
	flat?: number;
	back?: boolean; // show handwriting on the back
	cast?: boolean;
	outline?: number;
};

// image area centre offset inside the card (deeper bottom margin)
export const IMG_OFFSET_Y = (CARD_H - PHOTO.h) / 2 - PHOTO.border;

export const PhotoCard: React.FC<CardProps> = ({
	map,
	position,
	quaternion,
	rotation,
	scale = 1,
	develop = 1,
	glow = 0,
	stamp = 0,
	flat,
	back = true,
	cast = true,
	outline,
}) => {
	const mode = useMode();
	const f = flat ?? mode.flat;
	const tex = useMemo(() => ({hand: handwriting(), stamp: dateStamp(), glow: glowTexture()}), []);
	const mats = useMemo(
		() => ({
			paper: makeInk('#f1ece2', {rim: 0.2}),
			line: makeOutline(2.2),
		}),
		[],
	);
	setFlat(mats.paper, f, glow * 0.25);
	(mats.line.uniforms.uWidth as {value: number}).value = (outline ?? mode.outline) * (mode.res.y / 720);
	(mats.line.uniforms.uRes as {value: THREE.Vector2}).value.copy(mode.res);
	const imgY = IMG_OFFSET_Y;
	return (
		<group position={position as never} quaternion={quaternion} rotation={rotation} scale={scale}>
			<mesh geometry={getCardGeo()} material={mats.paper} castShadow={cast} receiveShadow />
			<mesh geometry={getCardGeo()} material={mats.line} />
			{map ? (
				<Ink shape={['plane', PHOTO.w, PHOTO.h]} map={map} color="#ffffff" position={[0, imgY, 0.0014]} flat={1} glow={glow * 0.35} />
			) : (
				<Ink shape={['plane', PHOTO.w, PHOTO.h]} color="#1a2230" position={[0, imgY, 0.0014]} />
			)}
			{develop < 1 ? (
				<Ink shape={['plane', PHOTO.w, PHOTO.h]} color="#d9d3c4" position={[0, imgY, 0.0016]} opacity={1 - develop} flat={1} />
			) : null}
			{stamp > 0 ? (
				<Ink
					shape={['plane', 0.05, 0.0125]}
					map={tex.stamp}
					color="#ffffff"
					position={[PHOTO.w / 2 - 0.03, imgY - PHOTO.h / 2 + 0.011, 0.0017]}
					opacity={stamp}
					flat={1}
					glow={1.2 * stamp}
				/>
			) : null}
			{back ? (
				<Ink shape={['plane', CARD_W - 0.002, CARD_H - 0.002]} map={tex.hand} color="#ffffff" position={[0, 0, -0.0014]} rotation={[0, Math.PI, 0]} flat={f} />
			) : null}
			{glow > 0 ? <Glow position={[0, imgY, 0.02]} size={0.75} color={COLORS.amber} intensity={0.55 * glow} tex={tex.glow} /> : null}
		</group>
	);
};

// SpotLight whose target lives in the scene graph so its aim updates.
export const Spot: React.FC<{
	position: [number, number, number];
	target: [number, number, number];
	color?: string;
	intensity: number;
	angle?: number;
	penumbra?: number;
	distance?: number;
	decay?: number;
	shadow?: boolean;
	mapSize?: number;
}> = ({position, target, color = '#ffffff', intensity, angle = 0.7, penumbra = 0.6, distance = 0, decay = 1.6, shadow = true, mapSize = 1024}) => {
	const light = useMemo(() => {
		const l = new THREE.SpotLight();
		l.shadow.mapSize.set(mapSize, mapSize);
		l.shadow.bias = -0.0004;
		l.shadow.normalBias = 0.01;
		return l;
	}, [mapSize]);
	const mode = useMode();
	light.position.set(...position);
	light.target.position.set(...target);
	light.color.set(color);
	light.intensity = intensity;
	light.angle = angle;
	light.penumbra = penumbra;
	light.distance = distance;
	light.decay = decay;
	light.castShadow = shadow && mode.light > 0.02;
	return (
		<>
			<primitive object={light} />
			<primitive object={light.target} />
		</>
	);
};
