import React, {useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useVideoConfig} from 'remotion';
import {applyCam, camFor, CamSpec, ModeContext, modeState} from './mode';
import {Fx, PostFX} from '../post/PostFX';
import {useFontsReady} from './textures';
import {PERF} from '../perf';

const CamRig: React.FC<{cam: CamSpec; m: number; shake?: [number, number]}> = ({cam, m, shake}) => {
	const {camera, size} = useThree();
	const c = camFor(cam, m, size.width / size.height);
	applyCam(camera as THREE.PerspectiveCamera, c);
	if (shake) {
		// handheld micro shake in screen space (pixels at 720p)
		const px = (2 * Math.tan(((c.fov / 2) * Math.PI) / 180) * c.dist) / 720;
		camera.translateX(shake[0] * px);
		camera.translateY(shake[1] * px);
		camera.updateMatrixWorld();
	}
	return null;
};

export const Stage: React.FC<{
	cam: CamSpec;
	m: number;
	fx: Fx;
	shake?: [number, number];
	children: React.ReactNode;
}> = ({cam, m, fx, shake, children}) => {
	const {width, height} = useVideoConfig();
	const ready = useFontsReady();
	const ms = useMemo(() => modeState(m, new THREE.Vector2(width, height)), [m, width, height]);
	return (
		<ThreeCanvas
			width={width}
			height={height}
			dpr={PERF.dpr}
			shadows={PERF.shadows > 0}
			flat
			linear
			gl={{antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'}}
			camera={{fov: 30, near: 0.05, far: 200, position: [0, 1.5, 6]}}
			style={{position: 'absolute', inset: 0}}
		>
			<CamRig cam={cam} m={m} shake={shake} />
			<ModeContext.Provider value={ms}>{ready ? children : null}</ModeContext.Provider>
			<PostFX fx={fx} />
		</ThreeCanvas>
	);
};
