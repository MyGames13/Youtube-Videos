// The billiard ball thought experiment, on a glossy table with a ring shaped time tunnel.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {C, V3, lerp, inv, smooth, easeOut, easeInOut, clamp} from '../lib/anim';
import {Stage, Cam, orbit} from '../three/Stage';
import {Box, Cyl} from '../three/sets';
import {Glow} from '../three/props';
import {toon, basic} from '../three/mat';
import {Slam} from '../two/Panel';
import type {ShotProps} from './index';

const TY = 0.8; // felt height
const BR = 0.05; // ball radius
const A: V3 = [0.95, TY + BR, 0.0]; // mouth A, ball enters here (faces -x)
const B: V3 = [0.25, TY + BR, -0.55]; // mouth B, ball exits here earlier (faces +z)
const START: [number, number] = [-1.0, 0.16];
const P: [number, number] = [0.25, 0.09]; // collision point

const Mouth: React.FC<{p: V3; yaw: number; color: string; t: number; flash: number}> = ({p, yaw, color, t, flash}) => {
  const m = useMemo(() => new THREE.MeshBasicMaterial({color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), [color]);
  m.opacity = 0.75 + 0.25 * Math.sin(t * 6);
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh material={m}>
        <torusGeometry args={[0.1, 0.012, 10, 48]} />
      </mesh>
      <mesh material={m} rotation={[0, 0, t * 2]} scale={0.75}>
        <torusGeometry args={[0.1, 0.006, 8, 48, Math.PI * 1.5]} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.095, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.18 + flash * 0.6} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <Glow p={[0, 0, 0]} s={0.7 + flash * 1.2} color={color} o={0.5 + flash} />
    </group>
  );
};

const Ball: React.FC<{p: V3; color: string; glow?: string; label?: string; o?: number}> = ({p, color, glow, o = 1}) => (
  <group position={p}>
    <mesh material={toon({color, rim: '#ffffff', rimStrength: 0.6, emissive: glow ?? '#000000', emissiveIntensity: glow ? 0.5 : 0, opacity: o})}>
      <sphereGeometry args={[BR, 28, 20]} />
    </mesh>
    <mesh material={basic('#ffffff', 0.8)} position={[-BR * 0.35, BR * 0.45, BR * 0.55]} scale={BR * 0.18}>
      <sphereGeometry args={[1, 10, 8]} />
    </mesh>
    {glow ? <Glow p={[0, 0, 0]} s={0.35} color={glow} o={0.6 * o} /> : null}
  </group>
);

const Trail: React.FC<{pts: V3[]; color: string; o: number}> = ({pts, color, o}) => {
  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1] - BR + 0.004, q[2])));
    return new THREE.TubeGeometry(curve, 80, 0.008, 6, false);
  }, [JSON.stringify(pts.map((q) => q.map((x) => Math.round(x * 200))))]);
  if (!geo) return null;
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial color={color} transparent opacity={o} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

const TableSet: React.FC<{t: number; paper: number}> = ({t, paper}) => {
  const rail = toon({color: '#5a2f3a', rim: '#ffb3c6', rimStrength: 0.4});
  return (
    <group>
      <mesh position={[0, TY - 0.03, 0]} material={toon({color: '#0f5a5e', rim: '#7fffe8', rimStrength: 0.15})}>
        <boxGeometry args={[2.5, 0.06, 1.4]} />
      </mesh>
      {/* graph paper lines on the felt: it is all on paper */}
      {Array.from({length: 26}).map((_, i) => (
        <mesh key={`x${i}`} position={[-1.25 + i * 0.1, TY + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} material={basic('#7fffe8', 0.06 + paper * 0.18)}>
          <planeGeometry args={[0.004, 1.4]} />
        </mesh>
      ))}
      {Array.from({length: 14}).map((_, i) => (
        <mesh key={`z${i}`} position={[0, TY + 0.001, -0.7 + i * 0.1]} rotation={[-Math.PI / 2, 0, 0]} material={basic('#7fffe8', 0.06 + paper * 0.18)}>
          <planeGeometry args={[2.5, 0.004]} />
        </mesh>
      ))}
      <mesh position={[0, TY + 0.02, 0.74]} material={rail}>
        <boxGeometry args={[2.7, 0.1, 0.12]} />
      </mesh>
      <mesh position={[0, TY + 0.02, -0.74]} material={rail}>
        <boxGeometry args={[2.7, 0.1, 0.12]} />
      </mesh>
      <mesh position={[1.3, TY + 0.02, 0]} material={rail}>
        <boxGeometry args={[0.12, 0.1, 1.6]} />
      </mesh>
      <mesh position={[-1.3, TY + 0.02, 0]} material={rail}>
        <boxGeometry args={[0.12, 0.1, 1.6]} />
      </mesh>
      {[
        [-1.25, -0.68],
        [1.25, -0.68],
        [-1.25, 0.68],
        [1.25, 0.68],
        [0, 0.7],
        [0, -0.7],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, TY + 0.003, z]} rotation={[-Math.PI / 2, 0, 0]} material={basic('#05050c')}>
          <circleGeometry args={[0.07, 20]} />
        </mesh>
      ))}
      {[-1.15, 1.15].map((x, i) =>
        [-0.6, 0.6].map((z, k) => <Box key={`${i}${k}`} p={[x, TY / 2 - 0.05, z]} s={[0.14, TY - 0.1, 0.14]} color="#3a1f2a" />),
      )}
      {/* room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={toon({color: '#1a1436'})}>
        <planeGeometry args={[20, 20]} />
      </mesh>
      <mesh position={[0, 1.9, 0]} material={toon({color: '#2b2450', emissive: '#7fffe8', emissiveIntensity: 0.2})}>
        <boxGeometry args={[1.6, 0.06, 0.4]} />
      </mesh>
      <Glow p={[0, 1.85, 0]} s={3} color="#9ffcef" o={0.25} />
      <pointLight position={[0, 1.8, 0]} color="#d6fff8" intensity={6} distance={5} decay={1.4} />
      <pointLight position={[2, 1.6, 2]} color={C.violet} intensity={4} distance={7} decay={1.3} />
      <ambientLight color="#4a46a0" intensity={0.7} />
    </group>
  );
};

const lerp2 = (a: [number, number], b: [number, number], k: number): V3 => [lerp(a[0], b[0], k), TY + BR, lerp(a[1], b[1], k)];

export const Billiard: React.FC<ShotProps & {v: 'a' | 'b'}> = ({t, dur, m, v}) => {
  const M = (k: string, d = 0) => (m[k] !== undefined ? m[k] : d);
  let young: V3 | null = null;
  let old: V3 | null = null;
  let flashA = 0;
  let flashB = 0;
  let cam: Cam;
  let trailY: V3[] = [];
  let trailO: V3[] = [];
  let loopO = 0;
  let rewind = 0;
  let freeze = false;
  const paper = smooth(inv(M('b3.4', 0.1) + 1.4, M('b3.4', 0.1) + 2.0, t)) * (1 - smooth(inv(M('b3.5', 2.6), M('b3.5', 2.6) + 1, t)) * 0.6);

  if (v === 'a') {
    const r0 = M('b3.5', 2.6) - 0.1; // first roll
    const tin = r0 + 1.6; // enters A
    const rw = tin + 0.25; // rewind start
    const rw1 = rw + 0.7; // rewind end, replay with the old ball
    const tryT = M('b3.6', 5.3);
    const stop = M('b3.7', 8.0);
    freeze = t >= stop;
    const tt = freeze ? stop : t;
    if (tt < r0) {
      young = lerp2(START, START, 0);
    } else if (tt < tin) {
      young = lerp2(START, [A[0], A[2]], easeInOut(inv(r0, tin, tt)));
      trailY = [lerp2(START, START, 0), young];
    } else if (tt < rw) {
      young = null;
      flashA = 1 - inv(tin, rw, tt);
    } else if (tt < rw1) {
      // rewind: the world runs backwards, the ball returns to the start
      rewind = 1;
      young = lerp2(START, [A[0], A[2]], 1 - easeInOut(inv(rw, rw1, tt)));
    } else {
      // replay: young rolls again, the old ball pops out of B earlier and heads to knock it away
      const k = inv(rw1, stop + 0.6, tt);
      young = lerp2(START, P, easeOut(k) * 0.96);
      flashB = Math.max(0, 1 - inv(rw1, rw1 + 0.5, tt));
      const ko = inv(rw1 + 0.15, stop + 0.6, tt);
      old = [lerp(B[0], P[0] + 0.02, easeOut(ko) * 0.93), TY + BR, lerp(B[2], P[1] - 0.06, easeOut(ko) * 0.93)];
      trailO = [[B[0], TY + BR, B[2]], old];
      trailY = [lerp2(START, START, 0), young];
    }
    const k = clamp(t / dur);
    if (t < r0) cam = {pos: [-0.2, 2.5, 2.1], look: [0, TY, 0], fov: lerp(46, 40, k), shake: 0.003, t};
    else if (t < rw1) cam = {pos: [lerp(-1.6, -1.2, inv(r0, rw1, t)), 1.45, 1.45], look: [0.2, TY, -0.05], fov: 42, shake: 0.004, t};
    else if (!freeze) cam = orbit([0.1, TY, -0.1], 1.6, lerp(0.9, 0.5, inv(rw1, stop, t)), 0.75, 40, t, 0.003);
    else cam = orbit([P[0], TY, P[1] - 0.1], lerp(1.2, 0.85, easeOut(inv(stop, stop + 0.3, t))), 0.5, 0.45, 36, t, 0.006);
  } else {
    // bullet time: the glancing blow sends the young ball into the tunnel
    const hit = M('b4.1', 0.0) + 1.5;
    const slow = (x: number) => (x < hit - 0.3 ? x : x < hit + 0.6 ? hit - 0.3 + (x - (hit - 0.3)) * 0.25 : hit - 0.3 + 0.9 * 0.25 + (x - (hit + 0.6)));
    const s = slow(t);
    const tin = hit + 0.9;
    // young: start toward P, then deflect into A
    const kY1 = inv(0, hit, s);
    const kY2 = inv(hit, tin, s);
    young = s < hit ? lerp2(START, P, easeOut(kY1)) : s < tin ? lerp2(P, [A[0], A[2]], kY2) : null;
    const kO = inv(0.2, hit, s);
    old = s < hit ? [lerp(B[0], P[0] + 0.035, kO), TY + BR, lerp(B[2], P[1] - 0.09, kO)] : [lerp(P[0] + 0.035, P[0] - 0.25, inv(hit, hit + 1.4, s)), TY + BR, lerp(P[1] - 0.09, P[1] + 0.6, inv(hit, hit + 1.4, s))];
    if (inv(hit, hit + 1.4, s) >= 1) old = null;
    flashA = s >= tin ? Math.max(0, 1 - inv(tin, tin + 0.6, s)) : 0;
    flashB = s < 0.5 ? 1 - s * 2 : 0;
    trailY = [lerp2(START, START, 0), lerp2(START, P, 0.5), lerp2(P, P, 0), ...(s > hit ? [lerp2(P, [A[0], A[2]], Math.min(1, kY2))] : [])];
    trailO = [[B[0], TY + BR, B[2]], [P[0] + 0.035, TY + BR, P[1] - 0.09]];
    loopO = smooth(inv(tin + 0.2, tin + 1.2, s));
    const ang = 0.4 + t * 0.32;
    cam = orbit([P[0] + 0.15, TY, P[1] - 0.05], lerp(1.1, 1.5, clamp(t / dur)), ang, lerp(0.35, 0.9, clamp(t / dur)), 38, t, 0.003);
  }
  const loopPts: V3[] = [
    [A[0], TY + BR, A[2]],
    [A[0] + 0.15, TY + BR, -0.35],
    [B[0] + 0.3, TY + BR, B[2] - 0.12],
    [B[0], TY + BR, B[2]],
    [P[0], TY + BR, P[1]],
    [A[0] - 0.2, TY + BR, A[2] + 0.02],
    [A[0], TY + BR, A[2]],
  ];
  return (
    <AbsoluteFill style={{filter: rewind ? 'hue-rotate(40deg) saturate(1.4)' : undefined}}>
      <Stage cam={cam!} bg="#100c26" fog={[3, 12]}>
        <TableSet t={t} paper={paper} />
        <Mouth p={A} yaw={Math.PI / 2} color={C.teal} t={t} flash={flashA} />
        <Mouth p={B} yaw={0} color={C.violet} t={t} flash={flashB} />
        {young ? <Ball p={young} color="#F4F6F8" /> : null}
        {old ? <Ball p={old} color="#c9b8ff" glow={C.violet} /> : null}
        {trailY.length > 1 ? <Trail pts={trailY} color={C.teal} o={0.5} /> : null}
        {trailO.length > 1 ? <Trail pts={trailO} color={C.violet} o={0.6} /> : null}
        {loopO > 0 ? <Trail pts={loopPts} color={C.gold} o={loopO * 0.85} /> : null}
      </Stage>
      <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        {rewind ? (
          <g>
            <text x={70} y={110} fontFamily="JetBrains Mono, monospace" fontWeight={800} fontSize={34} fill={C.white}>
              ◀◀ EARLIER
            </text>
            {Array.from({length: 7}).map((_, i) => (
              <rect key={i} x={0} y={(i * 113 + t * 900) % 720} width={1280} height={3} fill="white" opacity={0.12} />
            ))}
          </g>
        ) : null}
        {v === 'a' ? <Slam t={t} at={M('b3.7', 8.0) + 0.05} x={640} y={300} size={110} color={C.coral} text="NO SOLUTION" glow={C.coral} rot={-3} /> : null}
        {v === 'b' ? <Slam t={t} at={M('b4.1', 0) + 2.2} x={640} y={120} size={40} color={C.gold} text="THE ONLY SHOT THAT WORKS" font="mono" /> : null}
      </svg>
    </AbsoluteFill>
  );
};
