// A party for time travellers, invitations sent afterwards. Nobody came. Or somebody did.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {C, V3, lerp, inv, smooth, easeOut, easeInOut, clamp, hash} from '../lib/anim';
import {solve, sit, stand, mixPose} from '../lib/rig';
import {Stickman3D} from '../three/Stickman3D';
import {Stage, Cam} from '../three/Stage';
import {Box, Cyl, Chair, Table, Pic, Room} from '../three/sets';
import {Glow, WallClock, Dust} from '../three/props';
import {toon, basic} from '../three/mat';
import {signTexture} from '../three/textures';
import {Slam} from '../two/Panel';
import type {ShotProps} from './index';

const Balloon: React.FC<{p: V3; color: string; t: number; i: number}> = ({p, color, t, i}) => {
  const sway = Math.sin(t * 0.9 + i) * 0.04;
  return (
    <group position={[p[0] + sway, p[1] + Math.sin(t * 0.7 + i * 2) * 0.03, p[2]]}>
      <mesh material={toon({color, rim: '#ffffff', rimStrength: 0.6, emissive: color, emissiveIntensity: 0.15})} scale={[0.16, 0.2, 0.16]}>
        <sphereGeometry args={[1, 20, 16]} />
      </mesh>
      <mesh material={basic('#e8e8f8', 0.6)} position={[0, -0.55, 0]} scale={[0.004, 0.7, 0.004]}>
        <cylinderGeometry args={[1, 1, 1, 4]} />
      </mesh>
    </group>
  );
};

const Glass: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <mesh material={toon({color: '#d8f6ff', rim: '#ffffff', rimStrength: 0.8, opacity: 0.6})} position={[0, 0.1, 0]} scale={[0.03, 0.07, 0.03]}>
      <cylinderGeometry args={[1, 0.6, 1, 12]} />
    </mesh>
    <mesh material={toon({color: C.gold, emissive: C.gold, emissiveIntensity: 0.3})} position={[0, 0.095, 0]} scale={[0.026, 0.045, 0.026]}>
      <cylinderGeometry args={[1, 0.6, 1, 12]} />
    </mesh>
    <mesh material={toon({color: '#d8f6ff', opacity: 0.6})} position={[0, 0.03, 0]} scale={[0.004, 0.06, 0.004]}>
      <cylinderGeometry args={[1, 1, 1, 6]} />
    </mesh>
  </group>
);

// an invitation card fluttering down from the frame edge
const Invite: React.FC<{t: number; i: number; start: number}> = ({t, i, start}) => {
  const k = t - start - i * 0.18;
  if (k < 0) return null;
  const fall = Math.min(k / 1.5, 1);
  const x = lerp(-1.6 + i * 0.7, -1.2 + i * 0.55, fall) + Math.sin(k * 3 + i) * 0.15 * (1 - fall);
  const y = lerp(3.2, 0.81, easeOut(fall));
  const z = lerp(0.6, 0.0 + (i % 2) * 0.2, fall);
  const tex = signTexture('invite', [
    {text: 'YOU ARE INVITED', color: '#3b2a1a', size: 30, y: 60},
    {text: 'A PARTY FOR', color: '#3b2a1a', size: 22, y: 120},
    {text: 'TIME TRAVELERS', color: '#7a2a3a', size: 34, y: 160},
    {text: 'HOST: S. HAWKING, 2009', color: '#3b2a1a', size: 20, y: 215},
  ], 512, 256, '#F2EAD8');
  return (
    <group position={[x, y, z]} rotation={[lerp(-1.2, -Math.PI / 2, fall) + Math.sin(k * 5 + i) * 0.5 * (1 - fall), 0.3 * i, Math.sin(k * 4) * 0.4 * (1 - fall)]}>
      <Pic p={[0, 0, 0]} w={0.36} h={0.18} tex={tex} emissive={0.95} />
    </group>
  );
};

export const Party: React.FC<ShotProps> = ({t, dur, m}) => {
  const M = (k: string, d = 0) => (m[k] !== undefined ? m[k] : d);
  const inv0 = M('b5.4', 3.0) - 0.1;
  const nobody = M('b5.5', 6.0);
  const somebody = M('b5.6', 7.4);
  const remember = M('b5.7', 11.6);
  const dim = t > nobody ? 1 - 0.35 * smooth(inv(nobody, nobody + 0.5, t)) : 1;
  const flick = t > nobody && t < nobody + 0.2 ? (Math.floor(t * 30) % 3 === 1 ? 0.4 : 1) : 1;
  const ghost = smooth(inv(somebody + 0.3, somebody + 0.9, t)) * (1 - smooth(inv(somebody + 2.6, somebody + 3.4, t)));
  const ghostStand = smooth(inv(somebody + 1.4, somebody + 2.2, t));
  const chairBack = smooth(inv(somebody + 2.0, somebody + 2.8, t));
  let cam: Cam;
  if (t < inv0) {
    const k = clamp(t / inv0);
    cam = {pos: [lerp(-3.2, -2.2, k), lerp(2.2, 1.9, k), lerp(4.2, 3.4, k)], look: [0.3, 1.3, -0.8], fov: 46, shake: 0.003, t};
  } else if (t < nobody - 0.1) {
    cam = {pos: [-0.6, 1.8, 2.2], look: [-0.2, 0.9, 0.0], fov: 42, shake: 0.003, t};
  } else if (t < remember - 0.1) {
    const k = clamp((t - nobody) / (remember - nobody));
    cam = {pos: [lerp(3.4, 2.8, k), lerp(1.7, 1.5, k), lerp(3.2, 2.6, k)], look: [0, 0.9, -0.3], fov: 40, shake: 0.002, t};
  } else {
    const k = easeInOut(inv(remember - 0.1, dur, t));
    cam = {pos: [lerp(1.2, 1.5, k), lerp(2.1, 2.25, k), lerp(0.2, -1.85, k)], look: [1.6, 2.25, -2.9], fov: lerp(40, 22, k), shake: 0.002, t};
  }
  const banner = signTexture('banner', [{text: 'WELCOME, TIME TRAVELERS', color: C.gold, size: 64, y: 128}], 1024, 256, '#2a1d5a');
  const card = signTexture('hostcard', [{text: 'HOST', color: '#9aa0c8', size: 40, y: 80}, {text: 'S. HAWKING', color: '#F4F6F8', size: 60, y: 160}], 512, 256, '#14102b');
  const chairs: [number, number, number][] = [
    [-0.9, 0.75, Math.PI], [0, 0.75, Math.PI], [0.9, 0.75, Math.PI],
    [-0.9, -0.75, 0], [0, -0.75, 0], [0.9, -0.75, 0],
  ];
  const ghostChair = 1;
  return (
    <AbsoluteFill style={{filter: `brightness(${dim * flick})`}}>
      <Stage cam={cam} bg="#140f2c" fog={[5, 16]}>
        <Room w={9} d={7} h={3.4} floor="#2a2050" wall="#221a48" side="#1c1640" trim="#3a2e70" />
        <Pic p={[0, 2.5, -3.44]} w={3.6} h={0.9} tex={banner} emissive={1} />
        <Glow p={[0, 2.5, -3.2]} s={4} color={C.gold} o={0.15} />
        {[[-2.6, 2.4, -3.1], [-2.3, 2.7, -3.2], [2.4, 2.5, -3.1], [2.7, 2.2, -3.0], [-3.2, 1.9, -2.8], [3.1, 1.8, -2.6], [-1.4, 2.9, -3.3], [1.6, 2.9, -3.3]].map((p, i) => (
          <Balloon key={i} p={p as V3} color={[C.teal, C.violet, C.coral, C.gold][i % 4]} t={t} i={i} />
        ))}
        <Table p={[0, 0, 0]} w={2.6} d={1.1} h={0.76} color="#3a2e70" top="#F4F6F8" />
        {[-1.0, -0.6, -0.2, 0.2, 0.6, 1.0].map((x, i) => (
          <Glass key={i} p={[x, 0.785, i % 2 ? 0.25 : -0.25]} />
        ))}
        <Cyl p={[0.05, 0.95, 0]} r={0.045} h={0.32} color="#1f5a3a" rim={0.6} />
        <Cyl p={[0.05, 1.14, 0]} r={0.02} h={0.08} color={C.gold} />
        {[-0.8, 0.8].map((x, i) => (
          <Cyl key={i} p={[x, 0.8, 0]} r={0.14} h={0.02} color="#e9dcc0" />
        ))}
        <group position={[-0.55, 0.79, 0.4]} rotation={[-1.2, 0, 0]}>
          <Pic p={[0, 0, 0]} w={0.2} h={0.1} tex={card} emissive={1} />
        </group>
        {chairs.map(([x, z, yaw], i) => (
          <Chair key={i} p={[x, 0, z + (i === ghostChair ? (1 - chairBack) * 0.25 * ghostStand : 0)]} yaw={yaw} color="#4b3f86" />
        ))}
        {ghost > 0.01 ? (
          <Stickman3D j={solve(mixPose(sit(t), stand(t), ghostStand))} pos={[0, 0, 0.62 + ghostStand * 0.3]} yaw={Math.PI} wear="you" ghost={0.62 * ghost} rimStrength={1.8} rim="#9fc0ff" />
        ) : null}
        {ghost > 0.01 ? (
          <mesh position={[0, 0.004, 0.78]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.3, 4, 1, Math.PI / 4]} />
            <meshBasicMaterial color={C.gold} transparent opacity={ghost * 0.7} toneMapped={false} />
          </mesh>
        ) : null}
        <group position={[1.6, 2.25, -3.42]}>
          <WallClock h={12} m={Math.floor(t * 4) % 60} s={Math.floor(t) % 60} glow={0.5} r={0.32} />
        </group>
        {Array.from({length: 6}).map((_, i) => (
          <Invite key={i} t={t} i={i} start={inv0} />
        ))}
        <pointLight position={[0, 2.6, 0]} color="#ffe0b0" intensity={6} distance={7} decay={1.3} />
        <pointLight position={[-2.5, 2, 1]} color={C.violet} intensity={5} distance={8} decay={1.3} />
        <pointLight position={[2.5, 2, 1]} color={C.teal} intensity={4} distance={8} decay={1.3} />
        <ambientLight color="#5a4fb0" intensity={0.7} />
        <Dust t={t} n={40} area={[7, 3, 5]} center={[0, 1.6, -0.5]} color="#ffe8c0" o={0.3} />
      </Stage>
      <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        {t > inv0 + 1.1 && t < nobody + 0.2 ? (
          <g transform={`translate(900 200) rotate(-10) scale(${lerp(1.7, 1, easeOut(inv(inv0 + 1.1, inv0 + 1.25, t)))})`}>
            <rect x={-190} y={-50} width={380} height={100} rx={12} fill="none" stroke={C.coral} strokeWidth={8} />
            <text x={0} y={18} textAnchor="middle" fontFamily="Montserrat, sans-serif" fontWeight={900} fontSize={54} fill={C.coral}>
              SENT AFTER
            </text>
          </g>
        ) : null}
        {t > nobody && t < somebody ? <Slam t={t} at={nobody + 0.15} x={640} y={140} size={30} color="#9aa0c8" text="GUESTS: 0" font="mono" /> : null}
      </svg>
    </AbsoluteFill>
  );
};
