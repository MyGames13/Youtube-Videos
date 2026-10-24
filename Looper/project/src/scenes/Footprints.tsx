// Free will, first person: you walk, and glowing footprints are already on the floor ahead.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {C, V3, lerp, inv, smooth, easeInOut, clamp} from '../lib/anim';
import {Stage, Cam} from '../three/Stage';
import {Glow, Dust} from '../three/props';
import {toon, basic} from '../three/mat';
import type {ShotProps} from './index';

const STRIDE = 0.55;
const SPEED = 1.1; // m/s

const Print: React.FC<{x: number; z: number; o: number; hot: number}> = ({x, z, o, hot}) => {
  const m = useMemo(() => new THREE.MeshBasicMaterial({color: C.teal, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), []);
  m.opacity = o * (0.55 + hot * 0.45);
  return (
    <group position={[x, 0.004, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[0.085, 0.18, 1]} material={m}>
        <circleGeometry args={[1, 24]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.13]} scale={[0.055, 0.05, 1]} material={m}>
        <circleGeometry args={[1, 18]} />
      </mesh>
      {hot > 0.02 ? <Glow p={[0, 0.02, -0.03]} s={0.5 + hot * 0.6} color={C.teal} o={hot * 0.8} /> : null}
    </group>
  );
};

export const Footprints: React.FC<ShotProps> = ({t, dur, m}) => {
  const z = -t * SPEED; // you walk toward -z
  const bob = Math.abs(Math.sin(t * Math.PI * (SPEED / STRIDE))) * 0.03;
  const lookUp = smooth(inv(m['b4.4'] !== undefined ? m['b4.4'] + 0.2 : 1.5, (m['b4.4'] ?? 1.5) + 1.4, t));
  const eye: V3 = [0, 1.66 + bob, z + 0.1];
  const cam: Cam = {pos: eye, look: [0, lerp(0.1, 1.1, lookUp), z - lerp(0.75, 4, lookUp)], fov: 68, shake: 0.003, t};
  // footprints ahead, alternating; they appear one by one ahead of you
  const prints = Array.from({length: 26}).map((_, i) => ({x: i % 2 ? -0.11 : 0.11, z: 0.6 - i * STRIDE, i}));
  // your feet: the current step lands in the next print
  const stepPhase = (t * SPEED) / STRIDE;
  const cur = Math.floor(stepPhase);
  const fr = stepPhase - cur;
  const feet = [0, 1].map((side) => {
    const idx = cur + (side === cur % 2 ? 1 : 0);
    const p = prints[Math.min(prints.length - 1, Math.max(0, idx))];
    const prevP = prints[Math.max(0, idx - 2)];
    const moving = side === (cur + 1) % 2;
    const k = moving ? smooth(fr) : 1;
    const fz = moving ? lerp(prevP.z, p.z, k) : prints[Math.max(0, cur + (side === cur % 2 ? 1 : 0) - 0)].z;
    const lift = moving ? Math.sin(k * Math.PI) * 0.08 : 0;
    return {x: p.x, z: fz, y: 0.03 + lift};
  });
  const ring = smooth(inv((m['b4.4'] ?? 1.5) + 0.6, (m['b4.4'] ?? 1.5) + 1.6, t));
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({color: C.violet, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), []);
  ringMat.opacity = 0.45 + ring * 0.55;
  return (
    <AbsoluteFill>
      <Stage cam={cam} bg="#0a0820" fog={[2.5, 14]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]} material={toon({color: '#16123a'})}>
          <planeGeometry args={[10, 30]} />
        </mesh>
        {Array.from({length: 30}).map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 2 - i]} material={basic(C.violet, 0.12)}>
            <planeGeometry args={[10, 0.01]} />
          </mesh>
        ))}
        {prints.map((p) => {
          const appear = smooth(inv(p.i * 0.05 - 0.4, p.i * 0.05 - 0.1, t));
          const hot = Math.max(0, 1 - Math.abs(z - 0.1 - p.z) / 0.35);
          return <Print key={p.i} x={p.x} z={p.z} o={appear} hot={hot} />;
        })}
        {feet.map((f, i) => (
          <group key={i} position={[f.x, f.y, f.z]}>
            <mesh material={toon({color: C.white, emissive: '#c8ccd8', emissiveIntensity: 0.3})} position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} scale={[0.028, 0.14, 0.028]}>
              <capsuleGeometry args={[1, 0.6, 6, 10]} />
            </mesh>
            <mesh material={toon({color: C.white, emissive: '#c8ccd8', emissiveIntensity: 0.3})} position={[0, 0.2, 0.05]} rotation={[-0.35, 0, 0]} scale={[0.028, 0.2, 0.028]}>
              <capsuleGeometry args={[1, 1.6, 6, 10]} />
            </mesh>
          </group>
        ))}
        {/* coat hem at the bottom of the view */}
        <mesh position={[0, 0.98 + bob, z - 0.12]} rotation={[0.2, 0, 0]} material={toon({color: C.blue, emissive: '#1c46c8', emissiveIntensity: 0.5})}>
          <cylinderGeometry args={[0.16, 0.2, 0.08, 20, 1, true]} />
        </mesh>
        {/* far ahead the footprints curve into the Loop Ring on the floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -8.2]} material={ringMat}>
          <ringGeometry args={[1.6, 1.72, 64]} />
        </mesh>
        <Glow p={[0, 0.3, -8.2]} s={6} color={C.violet} o={0.25 + ring * 0.45} />
        <ambientLight color="#6a5ad0" intensity={0.6} />
        <pointLight position={[0, 2.2, z - 3]} color={C.teal} intensity={2} distance={5} decay={1.5} />
        <pointLight position={[0, 2.0, z + 0.5]} color="#ffffff" intensity={1.5} distance={3} decay={1.5} />
        <Dust t={t} n={36} area={[4, 2.5, 8]} center={[0, 1.2, z - 3]} color="#bfe8ff" o={0.3} />
      </Stage>
    </AbsoluteFill>
  );
};
