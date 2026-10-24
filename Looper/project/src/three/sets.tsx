// Reusable set pieces for the 3D worlds.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {C, V3} from '../lib/anim';
import {toon, basic} from './mat';
import {Glow} from './props';

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 24);

export const Box: React.FC<{p: V3; s: V3; color: string; r?: V3; rim?: number; emissive?: string; ei?: number; flat?: number}> = ({p, s, color, r = [0, 0, 0], rim = 0.25, emissive, ei, flat}) => (
  <mesh geometry={box} material={toon({color, rim: '#b9a8ff', rimStrength: rim, emissive, emissiveIntensity: ei, flat})} position={p} scale={s} rotation={r} />
);

export const InkBox: React.FC<{p: V3; s: V3; color: string; r?: V3; rim?: number; emissive?: string; ei?: number}> = (pr) => {
  const ink = basic(C.ink, 1, false, THREE.BackSide);
  return (
    <group position={pr.p} rotation={pr.r ?? [0, 0, 0]}>
      <mesh geometry={box} material={toon({color: pr.color, rim: '#b9a8ff', rimStrength: pr.rim ?? 0.25, emissive: pr.emissive, emissiveIntensity: pr.ei})} scale={pr.s} />
      <mesh geometry={box} material={ink} scale={[pr.s[0] + 0.03, pr.s[1] + 0.03, pr.s[2] + 0.03]} />
    </group>
  );
};

export const Cyl: React.FC<{p: V3; r: number; h: number; color: string; rot?: V3; rim?: number; emissive?: string; ei?: number}> = ({p, r, h, color, rot = [0, 0, 0], rim = 0.3, emissive, ei}) => (
  <mesh geometry={cyl} material={toon({color, rim: '#b9a8ff', rimStrength: rim, emissive, emissiveIntensity: ei})} position={p} scale={[r, h, r]} rotation={rot} />
);

// a room: floor, back wall, side walls. Never pure black (section 6.7).
export const Room: React.FC<{w: number; d: number; h: number; floor: string; wall: string; side?: string; trim?: string}> = ({w, d, h, floor, wall, side, trim}) => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={toon({color: floor})}>
      <planeGeometry args={[w, d]} />
    </mesh>
    <mesh position={[0, h / 2, -d / 2]} material={toon({color: wall})}>
      <planeGeometry args={[w, h]} />
    </mesh>
    <mesh position={[-w / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={toon({color: side ?? wall})}>
      <planeGeometry args={[d, h]} />
    </mesh>
    <mesh position={[w / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={toon({color: side ?? wall})}>
      <planeGeometry args={[d, h]} />
    </mesh>
    {trim ? <Box p={[0, 0.06, -d / 2 + 0.02]} s={[w, 0.12, 0.04]} color={trim} /> : null}
  </group>
);

// the time machine: a standing ring portal with inner rings that spin with charge
export const Machine: React.FC<{t: number; charge: number; color?: string; flash?: number}> = ({t, charge, color = C.teal, flash = 0}) => {
  const frame = toon({color: '#2b2450', rim: '#9d86ff', rimStrength: 0.7});
  const brass = toon({color: '#ffcf66', rim: '#fff0c0', rimStrength: 0.6, emissive: '#d08a10', emissiveIntensity: 0.5});
  const glowRing = useMemo(() => new THREE.MeshBasicMaterial({color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), [color]);
  const glowRing2 = useMemo(() => new THREE.MeshBasicMaterial({color: C.violet, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), []);
  glowRing.opacity = 0.35 + charge * 0.6;
  glowRing2.opacity = 0.25 + charge * 0.5;
  const sp = t * (0.4 + charge * 3.5);
  return (
    <group>
      <mesh material={frame}>
        <torusGeometry args={[1.05, 0.11, 16, 64]} />
      </mesh>
      <group rotation={[0, 0, sp]}>
        <mesh material={glowRing}>
          <torusGeometry args={[0.9, 0.018, 8, 80]} />
        </mesh>
        {Array.from({length: 12}).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <mesh key={i} geometry={box} material={brass} position={[Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0.1]} scale={[0.06, 0.06, 0.05]} rotation={[0, 0, a]} />;
        })}
      </group>
      <group rotation={[0, 0, -sp * 1.3]}>
        <mesh material={glowRing2}>
          <torusGeometry args={[0.72, 0.012, 8, 80]} />
        </mesh>
      </group>
      <mesh position={[0, 0, -0.02]}>
        <circleGeometry args={[0.88, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.06 + charge * 0.22 + flash * 0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Glow p={[0, 0, 0.2]} s={2.6 + charge * 1.6} color={color} o={0.18 + charge * 0.45 + flash} />
      {/* base */}
      <mesh geometry={box} material={frame} position={[0, -1.18, 0]} scale={[1.3, 0.16, 0.6]} />
      <mesh geometry={box} material={brass} position={[0, -1.1, 0.31]} scale={[0.9, 0.03, 0.02]} />
    </group>
  );
};

export const Lamp: React.FC<{p: V3; color: string; o?: number}> = ({p, color, o = 1}) => (
  <group position={p}>
    <Cyl p={[0, 0.02, 0]} r={0.09} h={0.04} color="#2a2342" />
    <Cyl p={[0, 0.22, 0]} r={0.012} h={0.4} color="#2a2342" />
    <mesh position={[0.06, 0.44, 0]} rotation={[0, 0, -2.3]} material={toon({color: '#3c3166', rim: '#b9a8ff', rimStrength: 0.5})}>
      <coneGeometry args={[0.09, 0.14, 20, 1, true]} />
    </mesh>
    <Glow p={[0.1, 0.38, 0]} s={0.9} color={color} o={0.55 * o} />
  </group>
);

export const Chair: React.FC<{p: V3; yaw?: number; color?: string}> = ({p, yaw = 0, color = '#5a3a26'}) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <Box p={[0, 0.45, 0]} s={[0.46, 0.05, 0.44]} color={color} />
    <Box p={[0, 0.82, -0.2]} s={[0.46, 0.7, 0.05]} color={color} />
    {[
      [0.2, 0.2],
      [-0.2, 0.2],
      [0.2, -0.2],
      [-0.2, -0.2],
    ].map(([x, z], i) => (
      <Box key={i} p={[x, 0.22, z]} s={[0.04, 0.45, 0.04]} color={color} />
    ))}
  </group>
);

export const Table: React.FC<{p: V3; w: number; d: number; h?: number; color: string; top?: string}> = ({p, w, d, h = 0.76, color, top}) => (
  <group position={p}>
    <InkBox p={[0, h, 0]} s={[w, 0.05, d]} color={top ?? color} rim={0.35} />
    {[
      [w / 2 - 0.06, d / 2 - 0.06],
      [-w / 2 + 0.06, d / 2 - 0.06],
      [w / 2 - 0.06, -d / 2 + 0.06],
      [-w / 2 + 0.06, -d / 2 + 0.06],
    ].map(([x, z], i) => (
      <Box key={i} p={[x, h / 2, z]} s={[0.05, h, 0.05]} color={color} />
    ))}
  </group>
);

// soft blob shadow under a character or prop
export const Blob: React.FC<{p: V3; s: number; o?: number}> = ({p, s, o = 0.45}) => {
  const m = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false});
  }, []);
  m.opacity = o;
  return (
    <mesh position={[p[0], p[1] + 0.003, p[2]]} rotation={[-Math.PI / 2, 0, 0]} material={m}>
      <planeGeometry args={[s, s * 0.7]} />
    </mesh>
  );
};

export const Pic: React.FC<{p: V3; w: number; h: number; tex: THREE.Texture; r?: V3; emissive?: number}> = ({p, w, h, tex, r = [0, 0, 0], emissive = 0.85}) => {
  const m = useMemo(() => new THREE.MeshBasicMaterial({map: tex, toneMapped: false, color: new THREE.Color(emissive, emissive, emissive)}), [tex, emissive]);
  return (
    <mesh position={p} rotation={r} material={m}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
};
