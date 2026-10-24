import React from 'react';
import {AbsoluteFill} from 'remotion';
import {defaultFx} from './post/PostFX';
import {Stage} from './world/Stage';
import {Ink} from './world/Ink';
import {Stickman} from './world/Stickman';
import {laugh} from './world/rig';
import {CamSpec} from './world/mode';

// The channel formula: one short line on top (white word, red word), one big flat hero,
// one small orange tag. The hero is the photograph, and he is laughing in it.
const CARD = {w: 1.06, h: 0.98, y: 1.42, z: -0.22, border: 0.045};

export const Thumbnail: React.FC = () => {
	const r = laugh(0.3, 1);
	r.headPitch = -0.12;
	r.mouth = 1;
	r.blink = 0.9;
	r.handL.set(0.17, 1.08, 0.12);
	r.handR.set(-0.22, 0.95, 0.1);
	const cam: CamSpec = {target: [0, 1.65, 0], yaw: 0, pitch: 0, frameH: 0.98, fov3d: 24};
	const fx = {...defaultFx(0), bloom: 0.55, vignette: 0.35, grain: 0, scan: 0, warm: 0.05, exposure: 1.0};
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 34% 48% at 50% 62%, rgba(255,162,26,0.16), rgba(0,0,0,0) 70%)'}} />
			<Stage cam={cam} m={1} fx={fx}>
				{/* the photograph: thick white border, dark glossy print */}
				<Ink shape={['rbox', CARD.w, CARD.h, 0.03, 0.05]} color="#f3f1ec" position={[0, CARD.y, CARD.z]} flat={1} outline />
				<Ink shape={['rbox', CARD.w - 2 * CARD.border, CARD.h - 2 * CARD.border, 0.03, 0.03]} color="#0c1218" position={[0, CARD.y, CARD.z + 0.004]} flat={1} />
				<Ink shape={['plane', 0.12, 0.62]} color="#ffffff" position={[-0.3, CARD.y + 0.14, CARD.z + 0.021]} rotation={[0, 0, -0.42]} flat={1} opacity={0.05} opts={{transparent: true, depthWrite: false}} />
				<Stickman rig={r} scarf={1} />
				<ambientLight intensity={1.1} color="#c9d4e0" />
				<directionalLight position={[0.6, 2.4, 2.2]} intensity={1.6} color="#fff3e2" />
				<pointLight position={[-0.6, 1.9, 0.8]} intensity={0.6} distance={3} decay={1.5} color="#ffb04a" />
			</Stage>
			<div style={{position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', fontFamily: 'Montserrat', fontWeight: 800, fontSize: 138, letterSpacing: -2, lineHeight: 1}}>
				<span style={{color: '#F4F6F8'}}>KEEP </span>
				<span style={{color: '#FF3B30'}}>IT</span>
			</div>
			<div
				style={{
					position: 'absolute',
					left: 820,
					top: 238,
					padding: '6px 22px 8px',
					background: '#FFA21A',
					borderRadius: 12,
					border: '4px solid #000',
					transform: 'rotate(-6deg)',
					fontFamily: 'Montserrat',
					fontWeight: 800,
					fontSize: 46,
					color: '#0b0e12',
					boxShadow: '0 0 0 3px #FFA21A55, 0 6px 18px rgba(0,0,0,0.6)',
				}}
			>
				40 m
			</div>
		</AbsoluteFill>
	);
};
