// Props with named grip sockets (section 6.6). Each prop exports where a hand must be.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {C, V3, hash} from '../lib/anim';
import {toon, basic, glowMat} from './mat';

const cyl = new THREE.CylinderGeometry(1, 1, 1, 32);
const sph = new THREE.SphereGeometry(1, 20, 14);
const box = new THREE.BoxGeometry(1, 1, 1);

export const Glow: React.FC<{p: V3; s: number; color: string; o: number}> = ({p, s, color, o}) => {
  const m = useMemo(() => glowMat(color, 1).clone(), [color]);
  m.opacity = Math.max(0, o);
  return <sprite position={p} scale={[s, s, s]} material={m} />;
};

// ---------- Chronometer (brass pocket watch) ----------
// local frame: face looks toward +Z, crown at +Y. Grip: rests in palm under the case,
// thumb on the crown.
export const CHRONO_R = 0.068;
export const Chronometer: React.FC<{glow?: number; spin?: number; tick?: number; crownPress?: number}> = ({glow = 0, spin = 0, tick = 0, crownPress = 0}) => {
  const brass = toon({color: '#E8A93A', rim: '#ffe6a8', rimStrength: 0.7, emissive: '#6a3c00', emissiveIntensity: 0.9});
  const face = toon({color: '#F6EBD2', emissive: '#FFC24A', emissiveIntensity: 0.15 + glow * 0.6});
  const dark = basic('#2a1c08');
  const minuteA = -tick * (Math.PI * 2) / 60;
  return (
    <group rotation={[0, 0, spin]}>
      <mesh geometry={cyl} material={brass} rotation={[Math.PI / 2, 0, 0]} scale={[CHRONO_R, 0.018, CHRONO_R]} />
      <mesh geometry={cyl} material={face} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0095]} scale={[CHRONO_R * 0.86, 0.002, CHRONO_R * 0.86]} />
      {/* hour marks */}
      {Array.from({length: 12}).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <mesh key={i} geometry={box} material={dark} position={[Math.sin(a) * CHRONO_R * 0.72, Math.cos(a) * CHRONO_R * 0.72, 0.0112]} rotation={[0, 0, -a]} scale={[0.0025, 0.007, 0.001]} />;
      })}
      <mesh geometry={box} material={dark} position={[0, 0, 0.012]} rotation={[0, 0, minuteA]}>
        <boxGeometry args={[0.0001, 0.0001, 0.0001]} />
      </mesh>
      <group rotation={[0, 0, minuteA]}>
        <mesh geometry={box} material={basic(C.coral)} position={[0, 0.016, 0.0125]} scale={[0.0018, 0.032, 0.001]} />
      </group>
      <group rotation={[0, 0, -Math.PI * 0.62]}>
        <mesh geometry={box} material={dark} position={[0, 0.011, 0.012]} scale={[0.0032, 0.022, 0.001]} />
      </group>
      {/* crown and bow */}
      <mesh geometry={cyl} material={brass} position={[0, CHRONO_R + 0.009 - crownPress * 0.004, 0]} scale={[0.009, 0.018, 0.009]} />
      <mesh material={brass} position={[0, CHRONO_R + 0.022, 0]}>
        <torusGeometry args={[0.014, 0.0028, 8, 24]} />
      </mesh>
      {glow > 0.01 ? <Glow p={[0, 0, 0.03]} s={0.35 + glow * 0.4} color={C.gold} o={glow * 0.9} /> : null}
    </group>
  );
};
// chain from the bow, hanging over the wrist (relative to the watch)
export const ChronoChain: React.FC<{to: V3}> = ({to}) => {
  const brass = toon({color: C.brass, rim: '#ffe2a0', rimStrength: 0.6});
  const geo = useMemo(() => {
    const a = new THREE.Vector3(0, CHRONO_R + 0.034, 0);
    const b = new THREE.Vector3(...to);
    const m = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, -0.07, 0.01));
    const curve = new THREE.CatmullRomCurve3([a, m, b]);
    return new THREE.TubeGeometry(curve, 24, 0.0028, 6, false);
  }, [to[0], to[1], to[2]]);
  return <mesh geometry={geo} material={brass} />;
};

// ---------- Phone ----------
// local frame: screen faces +Z, top of the phone is +Y. 0.075 x 0.15 x 0.009
export const PHONE = {w: 0.075, h: 0.15, d: 0.009};
// grip socket for "held by the sides, thumb free": hand behind the lower half
export const PHONE_GRIP: V3 = [0, -0.035, -0.03];

function phoneTexture(state: string, t: number) {
  const c = document.createElement('canvas');
  c.width = 150;
  c.height = 300;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 300);
  bg.addColorStop(0, state === 'off' ? '#05050c' : '#1b1550');
  bg.addColorStop(1, state === 'off' ? '#05050c' : '#0a3a46');
  g.fillStyle = bg;
  g.fillRect(0, 0, 150, 300);
  if (state === 'off') return c;
  g.fillStyle = '#F4F6F8';
  g.textAlign = 'center';
  g.font = '600 16px Inter, sans-serif';
  g.fillText('9:14', 75, 30);
  if (state === 'missed') {
    g.font = '700 13px Inter, sans-serif';
    g.fillStyle = '#FF5C7A';
    g.fillText('MISSED CALL', 75, 120);
    g.fillStyle = '#F4F6F8';
    g.font = '800 24px Inter, sans-serif';
    g.fillText('GRAN', 75, 152);
    return c;
  }
  g.font = '600 12px Inter, sans-serif';
  g.fillText(state === 'call' ? 'CALLING' : 'INCOMING CALL', 75, 92);
  g.font = '800 26px Inter, sans-serif';
  if (state !== 'incoming') g.fillText(state === 'call' ? 'ME' : 'GRAN', 75, 124);
  // avatar ring pulse
  g.strokeStyle = 'rgba(30,230,200,0.7)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(75, 185, 22 + (t % 1) * 10, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#2ec27e';
  g.beginPath();
  g.arc(110, 260, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e5484d';
  g.beginPath();
  g.arc(40, 260, 16, 0, Math.PI * 2);
  g.fill();
  return c;
}

export const Phone: React.FC<{state?: 'off' | 'ring' | 'missed' | 'call' | 'incoming'; t?: number; glow?: number}> = ({state = 'off', t = 0, glow = 1}) => {
  const body = toon({color: '#1a1a26', rim: '#8899ff', rimStrength: 0.5});
  const tq = Math.floor(t * 6) / 6;
  const tex = useMemo(() => {
    const tx = new THREE.CanvasTexture(phoneTexture(state, tq));
    tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }, [state, tq]);
  const screen = useMemo(() => new THREE.MeshBasicMaterial({map: tex, toneMapped: false}), [tex]);
  return (
    <group>
      <mesh geometry={box} material={body} scale={[PHONE.w, PHONE.h, PHONE.d]} />
      <mesh position={[0, 0, PHONE.d / 2 + 0.0006]} material={screen}>
        <planeGeometry args={[PHONE.w * 0.9, PHONE.h * 0.92]} />
      </mesh>
      {state !== 'off' ? <Glow p={[0, 0, 0.02]} s={0.42} color={state === 'missed' ? C.coral : C.teal} o={0.55 * glow} /> : null}
    </group>
  );
};

// ---------- Teacup with saucer and steam ----------
// local: cup sits on y=0. Handle at +X. Grip socket: fingers through the handle.
export const CUP_HANDLE: V3 = [0.06, 0.035, 0];
export const Cup: React.FC<{t: number; steam?: number; color?: string}> = ({t, steam = 1, color = '#F4F6F8'}) => {
  const china = toon({color, rim: '#ffe7b0', rimStrength: 0.5});
  const tea = basic('#7a3e12');
  return (
    <group>
      <mesh geometry={cyl} material={china} position={[0, 0.034, 0]} scale={[0.042, 0.066, 0.042]} />
      <mesh geometry={cyl} material={tea} position={[0, 0.066, 0]} scale={[0.037, 0.002, 0.037]} />
      <mesh material={china} position={[0.045, 0.036, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.018, 0.005, 8, 16, Math.PI * 1.2]} />
      </mesh>
      <Steam t={t} amount={steam} y={0.08} />
    </group>
  );
};
export const Steam: React.FC<{t: number; amount: number; y: number}> = ({t, amount, y}) => {
  if (amount <= 0) return null;
  return (
    <group>
      {Array.from({length: 7}).map((_, i) => {
        const life = 2.6;
        const ph = ((t + i * (life / 7)) % life) / life;
        const x = Math.sin(ph * 5 + i * 1.7) * 0.02 * (0.4 + ph);
        const o = Math.sin(ph * Math.PI) * 0.22 * amount;
        return <Glow key={i} p={[x, y + ph * 0.22, 0]} s={0.05 + ph * 0.09} color="#fff2dc" o={o} />;
      })}
    </group>
  );
};

// ---------- Wall clock (always 9:14 in the kitchen) ----------
export const WallClock: React.FC<{h?: number; m?: number; s?: number; glow?: number; r?: number}> = ({h = 9, m = 14, s = 0, glow = 0, r = 0.22}) => {
  const rimM = toon({color: '#3a2a1a', rim: '#ffd27a', rimStrength: 0.6});
  const face = toon({color: '#FFF4DA', emissive: C.gold, emissiveIntensity: 0.08 + glow * 0.3});
  const dark = basic('#1b1208');
  const ma = -(m / 60) * Math.PI * 2;
  const ha = -((h % 12) / 12 + m / 720) * Math.PI * 2;
  const sa = -(s / 60) * Math.PI * 2;
  return (
    <group>
      <mesh geometry={cyl} material={rimM} rotation={[Math.PI / 2, 0, 0]} scale={[r * 1.08, 0.03, r * 1.08]} />
      <mesh geometry={cyl} material={face} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.016]} scale={[r, 0.004, r]} />
      {Array.from({length: 12}).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <mesh key={i} geometry={box} material={dark} position={[Math.sin(a) * r * 0.82, Math.cos(a) * r * 0.82, 0.02]} rotation={[0, 0, -a]} scale={[r * 0.03, r * (i % 3 === 0 ? 0.16 : 0.08), 0.002]} />;
      })}
      <group rotation={[0, 0, ha]}>
        <mesh geometry={box} material={dark} position={[0, r * 0.25, 0.024]} scale={[r * 0.06, r * 0.5, 0.003]} />
      </group>
      <group rotation={[0, 0, ma]}>
        <mesh geometry={box} material={dark} position={[0, r * 0.36, 0.026]} scale={[r * 0.04, r * 0.72, 0.003]} />
      </group>
      <group rotation={[0, 0, sa]}>
        <mesh geometry={box} material={basic(C.coral)} position={[0, r * 0.3, 0.028]} scale={[r * 0.015, r * 0.75, 0.002]} />
      </group>
      <mesh geometry={sph} material={dark} position={[0, 0, 0.03]} scale={r * 0.05} />
    </group>
  );
};

// ---------- Kettle ----------
export const Kettle: React.FC<{steam?: number; t: number}> = ({steam = 0, t}) => {
  const m = toon({color: '#E8E2D4', rim: '#ffe2a0', rimStrength: 0.5});
  const d = toon({color: '#2b2b33'});
  return (
    <group>
      <mesh geometry={sph} material={m} position={[0, 0.1, 0]} scale={[0.12, 0.1, 0.12]} />
      <mesh geometry={cyl} material={m} position={[0.13, 0.13, 0]} rotation={[0, 0, -0.9]} scale={[0.018, 0.12, 0.018]} />
      <mesh material={d} position={[0, 0.2, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.07, 0.012, 8, 20, Math.PI]} />
      </mesh>
      <Steam t={t} amount={steam} y={0.2} />
    </group>
  );
};

// ---------- Door with knob; hinge at local x=0, door spans +X ----------
export const DOOR = {w: 0.9, h: 2.05};
export const Door: React.FC<{open: number; color?: string}> = ({open, color = '#3a2c5c'}) => {
  const m = toon({color, rim: '#b9a8ff', rimStrength: 0.3});
  const brass = toon({color: C.brass, rim: '#ffe2a0', rimStrength: 0.7});
  return (
    <group rotation={[0, open * 1.6, 0]}>
      <mesh geometry={box} material={m} position={[DOOR.w / 2, DOOR.h / 2, 0]} scale={[DOOR.w, DOOR.h, 0.05]} />
      <mesh geometry={box} material={toon({color: '#6a4430'})} position={[DOOR.w / 2, DOOR.h * 0.72, 0.03]} scale={[DOOR.w * 0.7, DOOR.h * 0.35, 0.01]} />
      <mesh geometry={box} material={toon({color: '#6a4430'})} position={[DOOR.w / 2, DOOR.h * 0.28, 0.03]} scale={[DOOR.w * 0.7, DOOR.h * 0.35, 0.01]} />
      <mesh geometry={sph} material={brass} position={[DOOR.w - 0.1, 1.0, 0.07]} scale={0.035} />
      <mesh geometry={cyl} material={brass} position={[DOOR.w - 0.1, 1.0, 0.04]} rotation={[Math.PI / 2, 0, 0]} scale={[0.012, 0.05, 0.012]} />
    </group>
  );
};
// door knob world-ish position (local to door group before rotation)
export const DOOR_KNOB: V3 = [DOOR.w - 0.1, 1.0, 0.1];

// dust motes drifting in a box volume (deterministic)
export const Dust: React.FC<{t: number; n?: number; area: [number, number, number]; center: V3; color?: string; o?: number}> = ({t, n = 40, area, center, color = '#ffe8b0', o = 0.5}) => (
  <group position={center}>
    {Array.from({length: n}).map((_, i) => {
      const x = (hash(i * 3.1) - 0.5) * area[0] + Math.sin(t * 0.3 + i) * 0.05;
      const y = ((hash(i * 7.7) + t * 0.015 * (0.5 + hash(i))) % 1 - 0.5) * area[1];
      const z = (hash(i * 1.3) - 0.5) * area[2];
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 2.1);
      return <Glow key={i} p={[x, y, z]} s={0.025 + hash(i * 9.1) * 0.03} color={color} o={o * tw} />;
    })}
  </group>
);
