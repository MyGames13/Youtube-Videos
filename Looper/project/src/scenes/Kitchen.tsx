// The kitchen (the past, warm gold) and the street outside. One consistent set for all shots.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {C, V3, lerp, inv, smooth, easeOut, easeInOut, clamp, keys3, noise1} from '../lib/anim';
import {solve, stand, sit, walk, mixPose, toLocal, fpArms, Pose} from '../lib/rig';
import {Stickman3D} from '../three/Stickman3D';
import {Stage, Cam, fpCam, mixCam} from '../three/Stage';
import {Box, InkBox, Blob, Chair, Table, Cyl, Pic} from '../three/sets';
import {Cup, WallClock, Kettle, Door, DOOR, Glow, Dust, Phone, Steam} from '../three/props';
import {Facing} from '../three/Facing';
import {toon, basic} from '../three/mat';
import {granPhoto} from '../three/textures';
import {MemCall} from '../two/Panels';
import type {ShotProps} from './index';

const TABLE_Y = 0.785;
const GRAN_POS: V3 = [0, 0, -0.62];
const YOU_SEAT: V3 = [0, 0, 0.62];
const DOOR_HINGE: V3 = [-1.45, 0, 2.4];
const DOORWAY: V3 = [-1.0, 0, 2.15];
const CUP_G: V3 = [0.16, TABLE_Y, -0.16];
const CUP2_A: V3 = [-0.22, TABLE_Y, -0.2];
const CUP2_B: V3 = [-0.04, TABLE_Y, 0.24];

const LightCone: React.FC<{p: V3; h: number; r: number; color: string; o: number}> = ({p, h, r, color, o}) => {
  const m = useMemo(() => new THREE.MeshBasicMaterial({color, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}), [color, o]);
  return (
    <mesh position={[p[0], p[1] - h / 2, p[2]]} material={m}>
      <coneGeometry args={[r, h, 32, 1, true]} />
    </mesh>
  );
};

// window shafts: thin additive boxes angled down from the window
const Shafts: React.FC<{t: number; o: number}> = ({t, o}) => {
  const m = useMemo(() => new THREE.MeshBasicMaterial({color: '#ffd98a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}), []);
  m.opacity = o * (0.06 + 0.015 * Math.sin(t * 0.8));
  return (
    <group position={[0.9, 1.7, -1.6]} rotation={[0.75, 0, 0]}>
      {[-0.35, 0, 0.35].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} material={m}>
          <boxGeometry args={[0.22, 0.02, 2.6]} />
        </mesh>
      ))}
    </group>
  );
};

const KitchenSet: React.FC<{t: number; exterior?: boolean; doorOpen?: number; warm?: number}> = ({t, exterior, doorOpen = 1, warm = 1}) => {
  const wall = '#4a2c22';
  const wall2 = '#3e2420';
  return (
    <group>
      {/* floor tiles */}
      {Array.from({length: 10}).map((_, i) =>
        Array.from({length: 10}).map((__, k) => (
          <mesh key={`${i}_${k}`} position={[-2.25 + i * 0.5, 0.001, -2.15 + k * 0.5]} rotation={[-Math.PI / 2, 0, 0]} material={toon({color: (i + k) % 2 ? '#5a3624' : '#3c2318'})}>
            <planeGeometry args={[0.5, 0.5]} />
          </mesh>
        )),
      )}
      {/* back wall with a window opening (x 0.25 to 1.55, y 1.0 to 2.2) */}
      <Box p={[-1.2, 1.5, -2.45]} s={[2.9, 3, 0.1]} color={wall} rim={0.1} />
      <Box p={[2.05, 1.5, -2.45]} s={[1.0, 3, 0.1]} color={wall} rim={0.1} />
      <Box p={[0.9, 0.5, -2.45]} s={[1.3, 1.0, 0.1]} color={wall} rim={0.1} />
      <Box p={[0.9, 2.6, -2.45]} s={[1.3, 0.8, 0.1]} color={wall} rim={0.1} />
      {/* window frame and cross */}
      <Box p={[0.9, 1.6, -2.42]} s={[0.05, 1.2, 0.06]} color="#e9dcc0" />
      <Box p={[0.9, 1.6, -2.42]} s={[1.3, 0.05, 0.06]} color="#e9dcc0" />
      <Box p={[0.9, 0.98, -2.36]} s={[1.45, 0.06, 0.22]} color="#e9dcc0" />
      {/* curtains */}
      <Box p={[0.16, 1.65, -2.36]} s={[0.22, 1.3, 0.04]} color={C.granCoral} rim={0.3} />
      <Box p={[1.64, 1.65, -2.36]} s={[0.22, 1.3, 0.04]} color={C.granCoral} rim={0.3} />
      {/* plant on the sill */}
      <Cyl p={[1.35, 1.08, -2.32]} r={0.06} h={0.12} color="#b5653a" />
      <mesh position={[1.35, 1.22, -2.32]} material={toon({color: '#3f8a5a', rim: '#bfffcf', rimStrength: 0.3})}>
        <sphereGeometry args={[0.1, 12, 10]} />
      </mesh>
      {/* side walls */}
      <Box p={[-2.55, 1.5, 0]} s={[0.1, 3, 5]} color={wall2} rim={0.1} />
      <Box p={[2.55, 1.5, 0]} s={[0.1, 3, 5]} color={wall2} rim={0.1} />
      {/* front wall with the door opening (x -1.45 to -0.55) */}
      <Box p={[-2.0, 1.5, 2.45]} s={[1.1, 3, 0.1]} color={wall2} />
      <Box p={[0.95, 1.5, 2.45]} s={[3.0, 3, 0.1]} color={wall2} />
      <Box p={[-1.0, 2.55, 2.45]} s={[0.9, 0.9, 0.1]} color={wall2} />
      <group position={DOOR_HINGE}>
        <Door open={doorOpen} color="#8a5a3a" />
      </group>
      {/* hallway outside the door */}
      <Box p={[-1.95, 1.5, 3.6]} s={[0.1, 3, 2.3]} color="#2a1e3a" rim={0.2} />
      <Box p={[-0.05, 1.5, 3.6]} s={[0.1, 3, 2.3]} color="#2a1e3a" rim={0.2} />
      <Box p={[-1.0, 0.1, 4.0]} s={[1.9, 0.2, 0.5]} color="#3a2a4a" rim={0.3} />
      <Box p={[-1.0, -0.1, 4.5]} s={[1.9, 0.2, 0.5]} color="#3a2a4a" rim={0.3} />
      <Box p={[-1.0, 3.0, 3.6]} s={[1.9, 0.05, 2.3]} color="#1e1530" />
      <Box p={[-1.0, 0.012, 2.47]} s={[0.86, 0.02, 0.02]} color="#ffd27a" emissive="#ffb040" ei={2} />
      <pointLight position={[-1.0, 2.6, 3.8]} color="#a89aff" intensity={4} distance={4} decay={1.4} />
      <pointLight position={[-1.0, 0.3, 2.7]} color="#ffb040" intensity={1.5} distance={1.5} decay={1.6} />
      {/* ceiling */}
      <Box p={[0, 3.0, 0]} s={[5.2, 0.05, 5]} color="#2e1c16" />
      {/* counter and kettle */}
      <Box p={[-2.2, 0.45, -0.8]} s={[0.6, 0.9, 2.2]} color="#6a4430" rim={0.3} />
      <Box p={[-2.2, 0.92, -0.8]} s={[0.66, 0.05, 2.26]} color="#d9c7a0" rim={0.3} />
      <Box p={[-2.35, 2.0, -0.8]} s={[0.35, 0.7, 2.0]} color="#6a4430" rim={0.2} />
      <group position={[-2.15, 0.945, -1.3]}>
        <Kettle t={t} steam={0.6} />
      </group>
      <Box p={[-2.2, 1.1, -0.2]} s={[0.2, 0.3, 0.3]} color="#b33a3a" rim={0.3} />
      {/* clock and a framed photo */}
      <group position={[-1.1, 2.05, -2.39]}>
        <WallClock h={9} m={14} s={Math.floor(t) % 60} glow={0.4} r={0.24} />
      </group>
      <Pic p={[-0.35, 1.95, -2.39]} w={0.3} h={0.36} tex={granPhoto()} emissive={0.8} />
      {/* table, chairs */}
      <Table p={[0, 0, 0]} w={1.25} d={0.95} h={0.76} color="#7a4a2a" top="#b98a5e" />
      <Chair p={[0, 0, -0.78]} color="#8a5a32" />
      <Chair p={[0, 0, 0.78]} yaw={Math.PI} color="#8a5a32" />
      {/* teapot */}
      <group position={[0.42, TABLE_Y, -0.28]}>
        <mesh position={[0, 0.07, 0]} material={toon({color: '#F4F6F8', rim: '#ffe7b0', rimStrength: 0.4})} scale={[0.09, 0.07, 0.09]}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
        <Cyl p={[0.08, 0.09, 0]} r={0.012} h={0.08} color="#F4F6F8" rot={[0, 0, -0.8]} />
      </group>
      {/* pendant lamp with a warm cone */}
      <Cyl p={[0, 2.62, 0]} r={0.008} h={0.75} color="#2a1a10" />
      <mesh position={[0, 2.2, 0]} material={toon({color: C.gold, emissive: C.gold, emissiveIntensity: 0.7})}>
        <coneGeometry args={[0.22, 0.18, 24, 1, true]} />
      </mesh>
      <Glow p={[0, 2.12, 0]} s={1.4} color="#ffd27a" o={0.8 * warm} />
      <LightCone p={[0, 2.12, 0]} h={1.35} r={0.85} color="#ffcf70" o={0.05 * warm} />
      <Shafts t={t} o={warm} />
      <pointLight position={[0, 2.0, 0]} color="#ffc76a" intensity={9 * warm} distance={7} decay={1.4} />
      <pointLight position={[-2.0, 1.6, -0.8]} color="#ffb060" intensity={2.5} distance={4} decay={1.5} />
      <pointLight position={[0.9, 1.6, -3.5]} color="#6f8cff" intensity={2.5} distance={5} decay={1.4} />
      <ambientLight color="#8a5a40" intensity={0.75} />
      <Dust t={t} n={40} area={[3.5, 2.2, 3]} center={[0, 1.4, 0]} color="#ffe2a0" o={0.35} />
      {exterior ? <Street t={t} /> : null}
    </group>
  );
};

// the street behind the kitchen window, and the neighbour's window across it
const Street: React.FC<{t: number}> = ({t}) => (
  <group>
    {/* outside of Gran's house: facade around the kitchen window */}
    <Box p={[-4.6, 1.8, -2.56]} s={[4.2, 3.6, 0.08]} color="#3a2a4a" rim={0.1} />
    <Box p={[4.6, 1.8, -2.56]} s={[4.2, 3.6, 0.08]} color="#3a2a4a" rim={0.1} />
    <Box p={[0, 3.4, -2.56]} s={[5.2, 0.8, 0.08]} color="#3a2a4a" rim={0.1} />
    <Box p={[0.9, 0.95, -2.62]} s={[1.6, 0.08, 0.2]} color="#e9dcc0" />
    <mesh position={[0, 0, -7]} rotation={[-Math.PI / 2, 0, 0]} material={toon({color: '#17142e'})}>
      <planeGeometry args={[30, 9]} />
    </mesh>
    <Box p={[0, 0.02, -6.5]} s={[30, 0.02, 0.12]} color="#c9b46a" emissive="#5a4a10" ei={0.4} />
    {[-6, -1.5, 3].map((x, i) => (
      <group key={i} position={[x, 0, -4.2]}>
        <Cyl p={[0, 1.6, 0]} r={0.04} h={3.2} color="#2a2448" />
        <Glow p={[0, 3.25, 0]} s={1.8} color="#ffd98a" o={0.5} />
        <pointLight position={[0, 3.1, 0]} color="#ffd98a" intensity={2.5} distance={5} decay={1.6} />
      </group>
    ))}
    {/* rain streaks */}
    {Array.from({length: 70}).map((_, i) => {
      const x = ((i * 1.37) % 12) - 6;
      const z = -3 - ((i * 0.77) % 6);
      const y = 4 - ((t * 7 + i * 0.53) % 4.2);
      return <Box key={i} p={[x, y, z]} s={[0.008, 0.25, 0.008]} color="#9fb2ff" emissive="#9fb2ff" ei={0.6} />;
    })}
    {/* neighbour's house front with their window (x -2.4 to -0.6, y 0.9 to 2.3) */}
    <Box p={[-5.2, 1.8, -10.2]} s={[5.6, 3.6, 0.2]} color="#2c2448" rim={0.15} />
    <Box p={[2.4, 1.8, -10.2]} s={[6.0, 3.6, 0.2]} color="#2c2448" rim={0.15} />
    <Box p={[-1.5, 0.45, -10.2]} s={[1.8, 0.9, 0.2]} color="#2c2448" rim={0.15} />
    <Box p={[-1.5, 3.0, -10.2]} s={[1.8, 1.4, 0.2]} color="#2c2448" rim={0.15} />
    <Box p={[-1.5, 1.6, -10.12]} s={[0.04, 1.4, 0.05]} color="#d8d0e8" />
    <Box p={[-1.5, 0.92, -10.05]} s={[1.9, 0.05, 0.25]} color="#d8d0e8" />
    <pointLight position={[-1.5, 2.0, -10.8]} color="#ffd98a" intensity={1.6} distance={3} decay={1.6} />
    <Stickman3D j={solve({...stand(t), handR: [-0.16, 1.18, 0.22], handL: [0.1, 1.15, 0.24], headPitch: 0.02, mouth: 0})} pos={[-1.7, 0, -10.55]} yaw={0.1} wear="neighbor" rim="#c9b46a" rimStrength={0.6} />
    <group position={[-1.75, 1.2, -10.28]}>
      <Cyl p={[0, 0, 0]} r={0.045} h={0.1} color={C.mustard} />
    </group>
    <ambientLight color="#3a3a7a" intensity={0.25} />
  </group>
);

export const Kitchen: React.FC<ShotProps & {v: string}> = ({t, dur, m, v}) => {
  const M = (k: string, d = 0) => (m[k] !== undefined ? m[k] : d);
  const granBase = sit(t);
  // Gran's hands rest by her cup; holding the phone in split
  let granPose: Pose = {...granBase, lean: 0.14, headPitch: 0.12, handR: [-0.12, 0.83, 0.42], handL: [0.14, 0.83, 0.4], mouth: 0.4};
  let youPose: Pose = sit(t);
  let youPos: V3 = YOU_SEAT;
  let youYaw = Math.PI;
  let youVisible = true;
  let youFp = false;
  let cam: Cam = {pos: [2.2, 1.7, 2.6], look: [0, 1.0, 0], fov: 44, t};
  let cup2: V3 = CUP2_B;
  let doorOpen = 1;
  let exterior = false;
  let granHead = 0;
  let outline = 0;
  let cupLift = 0;
  let phoneGran = false;
  let split = false;

  if (v === 'door') {
    // first person in the hall: two steps up, hand to the knob, the door swings in
    exterior = false;
    const climb = easeOut(inv(0, 0.9, t));
    const reach = smooth(inv(0.55, 1.05, t));
    doorOpen = smooth(inv(1.3, 2.3, t));
    const head: V3 = [-1.0, lerp(1.35, 1.68, climb) + Math.sin(t * 9) * 0.02 * (1 - climb), lerp(4.0, 3.15, climb)];
    const lookDown = smooth(inv(0.4, 0.8, t)) * (1 - smooth(inv(1.5, 2.1, t)));
    cam = fpCam(head, Math.PI, lerp(0.25, 0.12, climb) + lookDown * 0.45, t, 70, 1);
    youPos = [-1.0, head[1] - 1.68, head[2] - 0.05];
    youYaw = Math.PI;
    youFp = true;
    const knob: V3 = [DOOR_HINGE[0] + Math.cos(doorOpen * 1.6) * (DOOR.w - 0.1) + Math.sin(doorOpen * 1.6) * 0.1, 1.0, DOOR_HINGE[2] + 0.1 * Math.cos(doorOpen * 1.6) - Math.sin(doorOpen * 1.6) * (DOOR.w - 0.1)];
    const rest: V3 = [-0.75, 1.0 + (head[1] - 1.68), head[2] - 0.3];
    const release = smooth(inv(1.75, 2.2, t));
    const hand: V3 = [lerp(lerp(rest[0], knob[0], reach), rest[0], release), lerp(lerp(rest[1], knob[1], reach), rest[1], release), lerp(lerp(rest[2], knob[2] + 0.02, reach), rest[2] - 0.2, release)];
    youPose = {...stand(t), handR: toLocal(hand, youPos, youYaw), handL: [0.2, 0.9, 0.05]};
  } else if (v === 'reveal') {
    // over the shoulder from the doorway, push past you into the warm room
    youPos = DOORWAY;
    youYaw = Math.PI;
    youPose = {...stand(t), headPitch: 0.05};
    const k = easeInOut(clamp(t / dur));
    cam = {pos: [lerp(-0.55, -0.7, k), lerp(1.75, 1.6, k), lerp(3.6, 3.0, k)], look: [lerp(-0.3, 0.0, k), 1.15, -0.6], fov: lerp(52, 44, k), shake: 0.003, t};
    granPose = {...granPose, headPitch: 0.25};
  } else if (v === 'split') {
    split = true;
    phoneGran = t < M('b7.4e', 5) + 0.2;
    youVisible = false;
    const lower = smooth(inv(M('b7.4e', 5), M('b7.4e', 5) + 0.6, t));
    granPose = {...granPose, handR: lower < 0.5 ? [-0.19, 1.27, 0.0] : [-0.12, 0.83, 0.42], poleR: [-1, -0.6, 0.2], headYaw: 0.15, mouth: -0.3, headPitch: 0.1};
    cam = {pos: [lerp(0.95, 0.85, t / dur), 1.35, lerp(0.55, 0.4, t / dur)], look: [-0.25, 1.25, -0.9], fov: 46, shake: 0.003, t};
  } else if (v === 'sees') {
    // behind Gran toward the door: you stand in the doorway; she turns and slides a cup
    const sees = M('b7.5', 0.1);
    const slide0 = M('b7.6', 2.0) + 1.2;
    granHead = smooth(inv(sees + 0.2, sees + 0.8, t));
    youPos = DOORWAY;
    youYaw = Math.PI;
    youPose = {...stand(t), headPitch: 0.1};
    const sl = smooth(inv(slide0, slide0 + 1.1, t));
    cup2 = [lerp(CUP2_A[0], CUP2_B[0], sl), TABLE_Y, lerp(CUP2_A[2], CUP2_B[2], sl)];
    const reach = smooth(inv(slide0 - 0.5, slide0, t)) * (1 - smooth(inv(slide0 + 1.2, slide0 + 1.6, t)));
    const handW: V3 = [cup2[0] + 0.0, TABLE_Y + 0.05, cup2[2] - 0.06];
    const handLocal = toLocal(handW, GRAN_POS, 0);
    granPose = {...granPose, headYaw: -granHead * 0.35, headPitch: lerp(0.12, -0.05, granHead), mouth: granHead > 0.5 ? 1 : 0.3, handR: reach > 0.01 ? ([lerp(-0.12, handLocal[0], reach), lerp(0.83, handLocal[1], reach), lerp(0.42, handLocal[2], reach)] as V3) : granPose.handR};
    const wide = t > slide0 - 0.7;
    cam = wide
      ? {pos: [1.6, 1.25, 0.9], look: [-0.1, 0.85, 0.0], fov: 40, shake: 0.003, t}
      : {pos: [0.75, 1.75, -1.95], look: [-0.95, 1.2, 2.1], fov: lerp(40, 35, t / dur), shake: 0.003, t};
  } else if (v === 'cup') {
    // first person: you sit, both hands around the cup, steam, Gran across the table
    youPos = YOU_SEAT;
    youYaw = Math.PI;
    youFp = true;
    cupLift = smooth(inv(dur - 1.0, dur - 0.2, t)) * 0.0;
    const sitDown = easeOut(inv(0, 0.6, t));
    const head: V3 = [0, lerp(1.62, 1.36, sitDown), lerp(0.72, 0.66, sitDown)];
    cam = fpCam(head, Math.PI, lerp(0.2, 0.48, sitDown), t, 70, 0.25);
    cup2 = CUP2_B;
    const handle: V3 = [cup2[0] + 0.065, TABLE_Y + 0.04, cup2[2]];
    const under: V3 = [cup2[0] - 0.06, TABLE_Y + 0.035, cup2[2] + 0.02];
    youPose = {...sit(t), handL: toLocal(handle, youPos, youYaw), handR: toLocal(under, youPos, youYaw)};
    granPose = {...granPose, headYaw: 0, headPitch: -0.12, mouth: 1, lean: 0.3};
  } else if (v === 'wide') {
    const k = easeInOut(clamp(t / dur));
    cam = {pos: [lerp(2.3, 1.9, k), lerp(2.0, 1.75, k), lerp(2.2, 1.7, k)], look: [0, 0.95, -0.05], fov: 42, shake: 0.002, t};
    youPose = {...sit(t), handL: toLocal([CUP2_B[0] + 0.065, TABLE_Y + 0.04, CUP2_B[2]], YOU_SEAT, Math.PI), handR: toLocal([CUP2_B[0] - 0.06, TABLE_Y + 0.035, CUP2_B[2] + 0.02], YOU_SEAT, Math.PI)};
    granPose = {...granPose, mouth: 1, headPitch: 0.0};
  } else if (v === 'neighbor') {
    exterior = true;
    const k1 = clamp(t / 1.7);
    const k2 = easeInOut(inv(1.5, dur, t));
    cam = {pos: [lerp(lerp(-2.25, -2.1, k1), 1.15, k2), lerp(1.95, 1.32, k2), lerp(lerp(-11.9, -11.6, k1), -4.0, k2)], look: [lerp(0.5, 0.0, k2), lerp(1.4, 1.12, k2), 0.62], fov: lerp(42, 24, k2), shake: 0.003, t};
    youPose = {...sit(t), handL: toLocal([CUP2_B[0] + 0.065, TABLE_Y + 0.04, CUP2_B[2]], YOU_SEAT, Math.PI), handR: toLocal([CUP2_B[0] - 0.06, TABLE_Y + 0.035, CUP2_B[2] + 0.02], YOU_SEAT, Math.PI), headPitch: -0.05};
  } else {
    // closed: the cup returns exactly to where it was. Nothing changed.
    const place = M('b8.4', 0.1) + 1.0;
    const pl = smooth(inv(place - 0.7, place, t));
    outline = smooth(inv(place - 1.2, place - 0.8, t)) * (1 - smooth(inv(place + 0.6, place + 1.2, t)));
    cup2 = [lerp(CUP2_B[0] + 0.05, CUP2_B[0], pl), TABLE_Y + Math.sin(pl * Math.PI) * 0.05, lerp(CUP2_B[2] + 0.05, CUP2_B[2], pl)];
    const handW: V3 = [cup2[0] + 0.065, cup2[1] + 0.04, cup2[2]];
    youPose = {...sit(t), handL: toLocal(handW, YOU_SEAT, Math.PI), handR: [-0.16, 0.8, 0.28], headPitch: 0.1};
    const k = easeInOut(clamp(t / dur));
    cam = t < place + 0.9 ? {pos: [0.12, 1.95, -0.4], look: [CUP2_B[0], TABLE_Y, CUP2_B[2]], fov: 38, shake: 0.002, t} : {pos: [lerp(1.6, 2.3, k), lerp(1.55, 1.95, k), lerp(1.2, 2.1, k)], look: [0, 1.0, -0.3], fov: 40, shake: 0.002, t};
    granPose = {...granPose, mouth: 1, headPitch: 0.0};
  }

  const gj = solve(granPose);
  const yj0 = solve(youPose);
  const yj = youFp ? fpArms(yj0) : yj0;
  const scene = (
    <Stage cam={cam} bg="#24140e" fog={exterior ? [6, 26] : [5, 16]}>
      <KitchenSet t={t} exterior={exterior} doorOpen={doorOpen} />
      <Stickman3D j={gj} pos={GRAN_POS} yaw={0} wear="gran" rim="#ffd7a0" rimStrength={0.5} />
      {phoneGran ? (
        <group position={[GRAN_POS[0] - 0.2, 1.25, GRAN_POS[2] + 0.02]} rotation={[0, -Math.PI / 2 + 0.25, 0]}>
          <Phone state="call" t={t} />
        </group>
      ) : null}
      {youVisible ? <Stickman3D j={yj} pos={youPos} yaw={youYaw} wear="you" fp={youFp} rim="#ffe0b0" rimStrength={0.45} /> : null}
      <Blob p={[GRAN_POS[0], 0, GRAN_POS[2]]} s={0.9} o={0.4} />
      <group position={CUP_G}>
        <Cup t={t} steam={1} color="#F4F6F8" />
      </group>
      <group position={cup2}>
        <Cup t={t + 1.3} steam={1} color="#ffd3c4" />
      </group>
      {outline > 0 ? (
        <mesh position={[CUP2_B[0], TABLE_Y + 0.003, CUP2_B[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.045, 0.055, 40]} />
          <meshBasicMaterial color={C.gold} transparent opacity={outline} toneMapped={false} />
        </mesh>
      ) : null}
    </Stage>
  );
  if (!split) return <AbsoluteFill>{scene}</AbsoluteFill>;
  // the SPLIT: left, her kitchen at 9:14; right, your younger self letting it ring
  const ring = 0.2;
  const flip = M('b7.4', 3.0) + 0.2;
  const k = easeOut(inv(0, 0.45, t));
  return (
    <AbsoluteFill style={{background: '#07061A'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 640, height: 720, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: -320, top: 0, width: 1280, height: 720}}>{scene}</div>
      </div>
      <div style={{position: 'absolute', left: 640, top: 0, width: 640, height: 720, overflow: 'hidden', transform: `translateX(${(1 - k) * 640}px)`}}>
        <div style={{position: 'absolute', left: -560, top: -20, width: 1280, height: 720, transform: 'scale(1.05)'}}>
          <MemCall t={t + 0.0} dur={dur} m={{'b1.4': ring, 'b1.5': flip - 1.0, 'b1.6': 999}} abs={0} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 637, top: 0, width: 6, height: 720, background: 'linear-gradient(#FFC24A, #38D6FF)', boxShadow: '0 0 18px #FFC24A'}} />
    </AbsoluteFill>
  );
};
export {walk, mixPose, keys3, noise1, basic, Facing, InkBox, Steam};
