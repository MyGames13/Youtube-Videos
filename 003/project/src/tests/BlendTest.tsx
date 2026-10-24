import React from 'react';
import * as THREE from 'three';
import {interpolate, Easing, useCurrentFrame} from 'remotion';
import {Stage} from '../world/Stage';
import {defaultFx} from '../post/PostFX';
import {CamSpec, lerpCam} from '../world/mode';
import {Hallway, BOOK_POS} from '../world/Hallway';
import {IMG_OFFSET_Y, PhotoCard, RenderToTexture, useRenderTarget} from '../world/Photo';
import {PHOTO_CAM, PhotoWorld} from '../world/PhotoWorld';
import {Stickman} from '../world/Stickman';
import {idle} from '../world/rig';

// Proof of the blend: a flat photograph on the open book lifts into the lit 3D
// hallway with the stickman, outline, shadow, bloom and the mode ramp.
export const BlendTest: React.FC = () => {
	const frame = useCurrentFrame();
	const t = frame / 30;
	const rt = useRenderTarget();
	const m = interpolate(frame, [24, 104], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
	const cardPos = new THREE.Vector3(BOOK_POS.x, BOOK_POS.y + 0.016, BOOK_POS.z);
	const imgCentre: [number, number, number] = [cardPos.x, cardPos.y, cardPos.z - IMG_OFFSET_Y];
	const flatCam: CamSpec = {target: imgCentre, yaw: 0, pitch: Math.PI / 2, flatPitch: Math.PI / 2, frameH: 0.135 * (1 - 0.02 * Math.min(1, t)), clip: 0.5};
	const ots: CamSpec = {target: [0.0, 1.2, -1.12], yaw: 0.42, pitch: 0.38, flatPitch: Math.PI / 2, frameH: 1.65, fov3d: 40, clip: 1e5};
	const cam = lerpCam(flatCam, ots, m);
	cam.flatPitch = Math.PI / 2;
	const r = idle(t);
	r.headPitch = 0.55;
	r.lean = 0.08;
	r.handL.set(0.17, 0.885, 0.21);
	r.handR.set(-0.19, 0.885, 0.2);
	r.elbowL.set(0.6, 1.0, -0.4);
	r.elbowR.set(-0.6, 1.0, -0.4);
	const fx = defaultFx(frame);
	return (
		<div style={{width: '100%', height: '100%', background: '#06080B'}}>
			<Stage cam={cam} m={m} fx={fx}>
				<RenderToTexture rt={rt} cam={PHOTO_CAM} m={0}>
					<PhotoWorld s={{expr: 'blank', laugh: 0, scarf: 0, hand: 0, friend: 0, t, frozen: true}} />
				</RenderToTexture>
				<Hallway t={t} />
				<group position={[0.0, 0, -0.93]} rotation={[0, Math.PI, 0]}>
					<Stickman rig={r} />
				</group>
				<PhotoCard map={rt.texture} position={cardPos} rotation={[-Math.PI / 2, 0, 0]} />
			</Stage>
		</div>
	);
};
