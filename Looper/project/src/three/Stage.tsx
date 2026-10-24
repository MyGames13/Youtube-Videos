// A 3D stage: one ThreeCanvas per shot, deterministic camera rig, fog and tone.
import React from 'react';
import * as THREE from 'three';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useVideoConfig} from 'remotion';
import {V3, handheld} from '../lib/anim';

export type Cam = {pos: V3; look: V3; fov: number; roll?: number; shake?: number; t?: number};

export const CamRig: React.FC<{cam: Cam}> = ({cam}) => {
  const {camera, size} = useThree();
  const c = camera as THREE.PerspectiveCamera;
  const [hx, hy] = handheld(cam.t ?? 0, cam.shake ?? 0.004, 3);
  c.position.set(cam.pos[0] + hx, cam.pos[1] + hy, cam.pos[2]);
  c.up.set(0, 1, 0);
  c.lookAt(cam.look[0] + hx * 0.5, cam.look[1] + hy * 0.5, cam.look[2]);
  if (cam.roll) c.rotateZ(cam.roll);
  c.fov = cam.fov;
  c.near = 0.02;
  c.far = 200;
  c.aspect = size.width / size.height;
  c.updateProjectionMatrix();
  return null;
};

const SceneBg: React.FC<{color: string; fog?: [number, number]}> = ({color, fog}) => {
  const {scene} = useThree();
  scene.background = new THREE.Color(color);
  scene.fog = fog ? new THREE.Fog(color, fog[0], fog[1]) : null;
  return null;
};

export const Stage: React.FC<{cam: Cam; bg: string; fog?: [number, number]; children: React.ReactNode}> = ({cam, bg, fog, children}) => {
  // the picture is always authored at 1280x720 (shorts recompose it), so do not take the size from the composition
  const width = 1280;
  const height = 720;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      flat
      gl={{antialias: true, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true, powerPreference: 'high-performance'}}
      camera={{fov: cam.fov, position: cam.pos, near: 0.02, far: 200}}
      style={{position: 'absolute', inset: 0}}
    >
      <SceneBg color={bg} fog={fog} />
      <CamRig cam={cam} />
      {children}
    </ThreeCanvas>
  );
};

// first person camera from a character's head (local head joint) in world space
export function fpCam(headWorld: V3, yaw: number, pitch: number, t: number, fov = 72, bob = 1): Cam {
  const b = Math.sin(t * Math.PI * 2 * 0.28) * 0.006 * bob;
  const eye: V3 = [headWorld[0] + Math.sin(yaw) * 0.06, headWorld[1] + 0.02 + b, headWorld[2] + Math.cos(yaw) * 0.06];
  const dir: V3 = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  return {pos: eye, look: [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], fov, shake: 0.0025, t};
}

export function orbit(target: V3, radius: number, angle: number, height: number, fov: number, t: number, shake = 0.004): Cam {
  return {
    pos: [target[0] + Math.sin(angle) * radius, target[1] + height, target[2] + Math.cos(angle) * radius],
    look: target,
    fov,
    shake,
    t,
  };
}

export function mixCam(a: Cam, b: Cam, w: number): Cam {
  const m = (x: V3, y: V3): V3 => [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w, x[2] + (y[2] - x[2]) * w];
  return {pos: m(a.pos, b.pos), look: m(a.look, b.look), fov: a.fov + (b.fov - a.fov) * w, roll: (a.roll ?? 0) * (1 - w) + (b.roll ?? 0) * w, shake: (a.shake ?? 0) * (1 - w) + (b.shake ?? 0) * w, t: b.t};
}
