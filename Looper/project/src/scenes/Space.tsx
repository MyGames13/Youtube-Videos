// Earth from orbit, a station, and a flat cosmonaut stickman: time already bends.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {C, V3, lerp, inv, smooth, easeOut, easeInOut, clamp, hash} from '../lib/anim';
import {Stage, Cam} from '../three/Stage';
import {Glow} from '../three/props';
import {toon, basic} from '../three/mat';
import {stand} from '../lib/rig';
import {Stick2D} from '../two/Stick2D';
import {Slam, Pop} from '../two/Panel';
import type {ShotProps} from './index';

let earthTex: THREE.CanvasTexture | null = null;
function earthTexture() {
  if (earthTex) return earthTex;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  const sea = g.createLinearGradient(0, 0, 0, 512);
  sea.addColorStop(0, '#1d3f9a');
  sea.addColorStop(0.5, '#2457c8');
  sea.addColorStop(1, '#1d3f9a');
  g.fillStyle = sea;
  g.fillRect(0, 0, 1024, 512);
  // invented continents: soft blobs
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3.3) * 1024;
    const y = 90 + hash(i * 7.1) * 330;
    const r = 30 + hash(i * 1.9) * 90;
    g.fillStyle = i % 3 ? '#2fa36b' : '#c9a85a';
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const rr = r * (0.7 + 0.3 * Math.sin(a * 3 + i) + 0.15 * Math.sin(a * 7 + i * 2));
      const px = x + Math.cos(a) * rr * 1.4;
      const py = y + Math.sin(a) * rr * 0.8;
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(0, 0, 1024, 30);
  g.fillRect(0, 482, 1024, 30);
  // clouds
  for (let i = 0; i < 70; i++) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    const x = hash(i * 5.7) * 1024;
    const y = hash(i * 2.3) * 512;
    g.beginPath();
    g.ellipse(x, y, 40 + hash(i) * 60, 8 + hash(i * 9) * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  earthTex = new THREE.CanvasTexture(c);
  earthTex.colorSpace = THREE.SRGBColorSpace;
  return earthTex;
}

const Station: React.FC<{t: number}> = ({t}) => {
  const m = toon({color: '#d9dce8', rim: '#ffffff', rimStrength: 0.5});
  const pan = toon({color: '#2c3f9a', rim: '#9fb4ff', rimStrength: 0.6, emissive: '#1c2a6a', emissiveIntensity: 0.4});
  const gold = toon({color: C.gold, rim: '#fff0c0', rimStrength: 0.5});
  return (
    <group rotation={[0.2, t * 0.05, 0.1]}>
      <mesh material={m} scale={[1.6, 0.06, 0.06]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {[-0.7, -0.45, 0.45, 0.7].map((x, i) => (
        <mesh key={i} material={pan} position={[x, 0, 0]} scale={[0.2, 0.01, 0.7]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <mesh material={m} rotation={[0, 0, Math.PI / 2]} scale={[0.09, 0.5, 0.09]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
      </mesh>
      <mesh material={gold} position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]} scale={[0.07, 0.22, 0.07]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
      </mesh>
      <Glow p={[0.25, 0.05, 0.1]} s={0.18} color={C.coral} o={Math.sin(t * 6) > 0 ? 0.9 : 0.2} />
    </group>
  );
};

export const Space: React.FC<ShotProps> = ({t, dur, m}) => {
  const k = easeInOut(clamp(t / dur));
  const cam: Cam = {pos: [lerp(-0.6, 0.4, k), lerp(0.5, 0.3, k), lerp(4.2, 3.4, k)], look: [lerp(0.2, 0.1, k), 0, 0], fov: 42, shake: 0.002, t};
  const tex = earthTexture();
  const atm = useMemo(() => new THREE.MeshBasicMaterial({color: '#5fd8ff', transparent: true, opacity: 0.22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), []);
  const s0 = m['b4.6'] ?? 0.1;
  const days = Math.min(803, Math.floor(803 * easeOut(inv(s0 + 0.6, s0 + 2.4, t))));
  const future = s0 + 3.0;
  return (
    <AbsoluteFill style={{background: '#04030c'}}>
      <Stage cam={cam} bg="#04030c">
        {Array.from({length: 140}).map((_, i) => (
          <mesh key={i} position={[(hash(i) - 0.5) * 40, (hash(i * 2.1) - 0.5) * 24, -12 - hash(i * 3.7) * 10]} material={basic('#e8ecff', 0.4 + hash(i * 5) * 0.6)} scale={0.03 + hash(i * 7) * 0.04}>
            <sphereGeometry args={[1, 6, 4]} />
          </mesh>
        ))}
        <group position={[0.6, -3.2, -1.5]} rotation={[0.3, t * 0.04, 0.15]}>
          <mesh>
            <sphereGeometry args={[3, 64, 48]} />
            <meshToonMaterial map={tex} />
          </mesh>
          <mesh material={atm} scale={1.06}>
            <sphereGeometry args={[3, 48, 32]} />
          </mesh>
        </group>
        <group position={[Math.cos(t * 0.35) * 0.9 - 0.3, 0.55 + Math.sin(t * 0.35) * 0.1, 0.4]} scale={0.7}>
          <Station t={t} />
        </group>
        <directionalLight position={[-4, 3, 4]} color="#ffffff" intensity={2.4} />
        <ambientLight color="#3a46a0" intensity={0.5} />
      </Stage>
      <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <Pop t={t} at={s0 + 0.2} x={210} y={420}>
          <Stick2D pose={{...stand(t), handR: [-0.25, 1.15, 0.2], handL: [0.25, 1.12, 0.2], mouth: 0.4}} x={210} y={540} s={150} wear="cosmo" label="SERGEI KRIKALEV" accent={C.teal} />
        </Pop>
        <Pop t={t} at={s0 + 0.6} x={980} y={170}>
          <rect x={800} y={120} width={380} height={100} rx={16} fill="#0B0A1E" stroke={C.teal} strokeWidth={3} opacity={0.9} />
          <text x={990} y={182} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={800} fontSize={40} fill={C.white} letterSpacing={2}>
            {`${days} DAYS`}
          </text>
          <text x={990} y={208} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={500} fontSize={16} fill="#9aa0c8" letterSpacing={4}>
            IN ORBIT
          </text>
        </Pop>
        <Slam t={t} at={future} x={990} y={300} size={64} color={C.teal} text="+ 1/50 s" glow={C.teal} />
        <Slam t={t} at={future + 0.4} x={990} y={370} size={30} color={C.white} text="INTO THE FUTURE" font="mono" />
      </svg>
    </AbsoluteFill>
  );
};
