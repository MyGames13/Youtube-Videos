// The workshop (present day): teal and violet, the machine, the corkboard with Gran.
import React from 'react';
import {C, V3, keys, keys3, smooth, inv, lerp, easeOut, easeInOut} from '../lib/anim';
import {solve, stand, floorSit, mixPose, toLocal, toWorld as toWorldLocal, Pose, SEG, fpArms} from '../lib/rig';
import {Stickman3D} from '../three/Stickman3D';
import {Stage, Cam, fpCam, mixCam} from '../three/Stage';
import {Chronometer, ChronoChain, Phone, Dust, Glow, PHONE} from '../three/props';
import {Room, Machine, Lamp, Table, Box, Blob, Pic, Cyl} from '../three/sets';
import {Facing, frameOffset} from '../three/Facing';
import {granPhoto, corkTexture} from '../three/textures';

export type WorkshopVariant = 'hook' | 'charge' | 'floor' | 'crown' | 'stand' | 'present';

const YOU_POS: V3 = [-0.35, 0, -0.25];
const YOU_YAW = Math.PI; // facing the bench (-Z)
const BENCH_Z = -1.15;
const MACHINE_POS: V3 = [1.75, 1.32, -1.55];
const PHONE_POS: V3 = [-0.75, 0.795, -1.05];

const Set: React.FC<{t: number; charge: number; flash?: number; phone?: 'off' | 'ring' | 'missed' | 'incoming'; hidePhone?: boolean; grade?: number}> = ({t, charge, flash = 0, phone = 'off', hidePhone, grade = 0}) => (
  <group>
    <Room w={9} d={7} h={3.4} floor={grade ? '#16142a' : '#1b1640'} wall={grade ? '#13122a' : '#191338'} side="#15102f" trim="#2b2458" />
    {/* wall panels and shelves for depth */}
    {[-3, -1.6, 1.6, 3].map((x, i) => (
      <Box key={i} p={[x, 1.7, -3.47]} s={[0.04, 3.4, 0.04]} color="#2a2256" />
    ))}
    <Box p={[-2.6, 1.9, -3.3]} s={[1.4, 0.05, 0.32]} color="#3a2e6e" />
    <Box p={[-2.6, 1.2, -3.3]} s={[1.4, 0.05, 0.32]} color="#3a2e6e" />
    {[0, 1, 2, 3].map((i) => (
      <Box key={i} p={[-3.1 + i * 0.32, 2.05, -3.3]} s={[0.16, 0.26, 0.2]} color={[C.violet, C.teal, '#3a2e6e', C.coral][i]} rim={0.5} />
    ))}
    {/* bench */}
    <Table p={[-0.6, 0, BENCH_Z]} w={2.0} d={0.8} h={0.77} color="#2f2758" top="#3d3270" />
    <Lamp p={[-1.35, 0.795, -1.3]} color={C.teal} />
    <Box p={[-0.05, 0.84, -1.3]} s={[0.36, 0.08, 0.24]} color="#4b3f86" rim={0.4} />
    <Cyl p={[0.25, 0.86, -1.0]} r={0.05} h={0.12} color={C.coral} />
    {hidePhone ? null : (
      <group position={PHONE_POS} rotation={[-Math.PI / 2, 0, 0.3]}>
        <Phone state={phone === 'ring' ? 'incoming' : phone} t={t} glow={phone === 'off' ? 0 : 0.8} />
      </group>
    )}
    {/* corkboard with the photo of Gran */}
    <group position={[-0.6, 1.85, -3.44]}>
      <Box p={[0, 0, 0]} s={[1.5, 0.95, 0.04]} color="#5a3a20" />
      <Pic p={[0, 0, 0.025]} w={1.42} h={0.87} tex={corkTexture()} emissive={0.55} />
      <Pic p={[-0.28, 0.02, 0.04]} w={0.34} h={0.4} tex={granPhoto()} r={[0, 0, 0.06]} emissive={0.9} />
      <Glow p={[-0.28, 0.02, 0.2]} s={0.9} color={C.gold} o={0.18} />
    </group>
    {/* the machine */}
    <group position={MACHINE_POS} rotation={[0, -0.55, 0]}>
      <Machine t={t} charge={charge} flash={flash} />
    </group>
    {/* cables */}
    {[0, 1, 2].map((i) => (
      <Box key={i} p={[0.9 + i * 0.08, 0.02, -1.1 + i * 0.25]} s={[1.6, 0.03, 0.04]} r={[0, 0.5 + i * 0.2, 0]} color="#2b2458" />
    ))}
    <pointLight position={[MACHINE_POS[0] - 0.4, 1.4, MACHINE_POS[2] + 0.6]} color={C.teal} intensity={(4 + charge * 14 + flash * 40) * (grade ? 0.5 : 1)} distance={7} decay={1.6} />
    <pointLight position={[-1.25, 1.35, -1.2]} color="#9fe8ff" intensity={grade ? 1.2 : 2.6} distance={4} decay={1.5} />
    <pointLight position={[-0.6, 2.6, 1.5]} color={C.violet} intensity={grade ? 2 : 4} distance={9} decay={1.2} />
    <ambientLight color="#5a4fb0" intensity={grade ? 0.55 : 0.8} />
    <directionalLight position={[2, 4, 3]} color="#c9c0ff" intensity={0.5} />
    <Dust t={t} n={36} area={[6, 2.8, 4]} center={[0, 1.5, -1]} color="#bfe8ff" o={0.28} />
  </group>
);

// chronometer held in the right palm, face toward the eye; left thumb on the crown
function chronoGrip(pos: V3, yaw: number, eye: V3, w: V3, press: number) {
  const palm = frameOffset(w, eye, [0.012, -0.078, -0.03]);
  const crown = frameOffset(w, eye, [0, 0.082, 0]);
  const lh = frameOffset(w, eye, [-0.06, 0.094 - press * 0.012, 0.0]);
  return {
    handR: toLocal(palm, pos, yaw),
    handL: toLocal(lh, pos, yaw),
    thumbL: (() => {
      const d: V3 = [crown[0] - lh[0], crown[1] - lh[1], crown[2] - lh[2]];
      // to local direction (rotate by -yaw)
      const c = Math.cos(-yaw);
      const s = Math.sin(-yaw);
      return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c] as V3;
    })(),
    palm,
  };
}

export const Workshop: React.FC<{t: number; v: WorkshopVariant; dur: number; charge?: number; m?: Record<string, number>}> = ({t, v, dur, charge = 0}) => {
  let pose: Pose;
  let cam: Cam;
  let watchPos: V3 | null = null;
  let thumbL: V3 | undefined;
  let hideHead = false;
  let phoneState: 'off' | 'ring' | 'missed' | 'incoming' = 'off';
  let ch = charge;
  let flash = 0;
  let grade = 0;
  let pos: V3 = YOU_POS;
  let yaw = YOU_YAW;
  let press = 0;
  let phoneInHand = false;
  let phoneHandLocal: V3 | null = null;

  const base = stand(t);
  if (v === 'hook') {
    // 0 to 3.2 s first person: lift the chronometer; then shoulder detach to a wide
    const lift = easeOut(inv(0.3, 1.6, t));
    const j0 = solve(base);
    const headW: V3 = [pos[0] + j0.head[0] * Math.cos(yaw) + j0.head[2] * Math.sin(yaw), j0.head[1], pos[2] - j0.head[0] * Math.sin(yaw) + j0.head[2] * Math.cos(yaw)];
    const eye: V3 = [headW[0], headW[1] + 0.02, headW[2] - 0.06];
    const w: V3 = [lerp(pos[0] - 0.02, pos[0] + 0.03, lift), lerp(1.02, 1.33, lift), lerp(pos[2] - 0.34, pos[2] - 0.44, lift)];
    press = smooth(inv(2.0, 2.3, t)) * (1 - smooth(inv(2.5, 2.8, t)));
    const g = chronoGrip(pos, yaw, eye, w, press);
    pose = {...base, handR: g.handR, handL: g.handL, poleR: [-1, -0.9, 0], poleL: [1, -0.9, 0], headPitch: 0.35};
    thumbL = g.thumbL;
    watchPos = w;
    phoneState = t > 1.1 ? 'missed' : 'off';
    const fp = fpCam(headW, yaw, 0.55, t, 66);
    const detach = easeInOut(inv(3.2, 5.4, t));
    const wide: Cam = {pos: [1.3, 2.05, 2.1], look: [-0.45, 1.25, -1.4], fov: 46, shake: 0.004, t};
    const wide2: Cam = {pos: [0.9, 1.9, 1.6], look: [-0.55, 1.45, -2.2], fov: 40, shake: 0.004, t};
    cam = detach < 1 ? mixCam(fp, wide, detach) : mixCam(wide, wide2, easeInOut(inv(5.4, dur, t)));
    hideHead = detach < 0.35;
    ch = 0.1;
  } else if (v === 'charge') {
    // the machine charges, the camera pushes past you to the ring
    const j = stand(t);
    pose = {...j, handR: [-0.2, 1.0, 0.15], handL: [0.2, 1.0, 0.15], headPitch: -0.05};
    pos = [0.6, 0, -0.2];
    yaw = Math.PI - 0.55;
    ch = keys(t, [[0, 0.2], [dur * 0.85, 1], [dur, 0.05, (x) => x]]);
    cam = {pos: [lerp(-1.1, -0.6, t / dur), lerp(1.55, 1.6, t / dur), lerp(2.0, 1.0, easeInOut(t / dur))], look: [1.4, 1.3, -1.4], fov: lerp(50, 38, t / dur), shake: 0.003 + ch * 0.004, t};
  } else if (v === 'floor' || v === 'crown') {
    pose = floorSit(t);
    pos = [MACHINE_POS[0] - 0.55, 0, MACHINE_POS[2] + 0.75];
    yaw = -0.55 + 0.25;
    grade = 1;
    ch = 0.05;
    if (v === 'floor') {
      cam = {pos: [lerp(-0.2, 0.1, t / dur), lerp(1.2, 1.05, t / dur), lerp(1.6, 1.2, t / dur)], look: [pos[0], 0.65, pos[2]], fov: 42, shake: 0.003, t};
    } else {
      // first person: thumb trembling on the crown
      const j0 = solve(pose);
      const headW: V3 = [pos[0] + j0.head[0] * Math.cos(yaw) + j0.head[2] * Math.sin(yaw), j0.head[1], pos[2] - j0.head[0] * Math.sin(yaw) + j0.head[2] * Math.cos(yaw)];
      const fwd: V3 = [Math.sin(yaw), 0, Math.cos(yaw)];
      const eye: V3 = [headW[0] + fwd[0] * 0.06, headW[1] + 0.02, headW[2] + fwd[2] * 0.06];
      const w: V3 = [headW[0] + fwd[0] * 0.42, headW[1] - 0.32, headW[2] + fwd[2] * 0.42];
      press = 0.35 + Math.sin(t * 38) * 0.15 * (1 - inv(dur - 0.6, dur, t));
      const g = chronoGrip(pos, yaw, eye, w, press);
      pose = {...pose, handR: g.handR, handL: g.handL, poleR: [-0.8, -0.8, 0.3], poleL: [0.9, -0.8, 0.4]};
      thumbL = g.thumbL;
      watchPos = w;
      hideHead = true;
      cam = fpCam(headW, yaw, 0.78, t, 64, 0.3);
    }
  } else if (v === 'stand') {
    // stand up from the floor, press the crown: flash at the end
    const up = easeInOut(inv(0, 1.4, t));
    pose = mixPose(floorSit(t), stand(t), up);
    pos = [MACHINE_POS[0] - 0.55, 0, MACHINE_POS[2] + 0.75 + up * 0.25];
    yaw = -0.3;
    grade = 1 - up * 0.7;
    ch = 0.1 + up * 0.9;
    flash = smooth(inv(dur - 0.35, dur, t));
    pose = {...pose, handR: [-0.08, lerp(0.5, 1.3, up), lerp(0.36, 0.3, up)], handL: [0.06, lerp(0.5, 1.34, up), lerp(0.36, 0.3, up)], headPitch: lerp(0.35, 0.25, up)};
    cam = {pos: [lerp(0.1, -0.3, up), lerp(1.0, 1.55, up), lerp(1.4, 0.9, up)], look: [pos[0], lerp(0.7, 1.4, up), pos[2]], fov: 44, shake: 0.004, t};
    const hr = toWorldLocal(pose.handR, pos, yaw);
    const hl = toWorldLocal(pose.handL, pos, yaw);
    watchPos = [(hr[0] + hl[0]) / 2, (hr[1] + hl[1]) / 2 + 0.06, (hr[2] + hl[2]) / 2];
    press = smooth(inv(dur - 1.0, dur - 0.6, t));
  } else {
    // present: back at the bench; the phone lights; first person, your hand lifts it before the second ring
    const j0 = solve(base);
    pos = [-0.7, 0, -0.45];
    yaw = Math.PI;
    const headW: V3 = [pos[0] - j0.head[0], j0.head[1], pos[2] - j0.head[2]];
    phoneState = t > 0.5 ? 'ring' : 'off';
    const swing = easeInOut(inv(0.2, 2.0, t));
    const reach = easeInOut(inv(2.35, 2.75, t));
    const lift = easeOut(inv(2.75, 3.45, t));
    const tp: Cam = {pos: [0.6, 1.75, 1.2], look: [-0.7, 1.1, -1.0], fov: 44, shake: 0.004, t};
    const fp = fpCam(headW, yaw, lerp(0.85, 0.6, lift), t, 60, 0.5);
    cam = mixCam(tp, fp, swing);
    hideHead = swing > 0.7;
    const phoneW: V3 = [lerp(PHONE_POS[0], headW[0] - 0.02, lift), lerp(PHONE_POS[1] + 0.02, headW[1] - 0.24, lift), lerp(PHONE_POS[2], headW[2] - 0.36, lift)];
    phoneHandLocal = toLocal([phoneW[0] + 0.0, phoneW[1] - 0.065, phoneW[2] - 0.03], pos, yaw);
    const rest: V3 = [-0.17, 0.9, 0.05];
    pose = {...base, handR: reach < 1 ? [lerp(rest[0], phoneHandLocal[0], reach), lerp(rest[1], phoneHandLocal[1] + 0.05 * Math.sin(reach * Math.PI), reach), lerp(rest[2], phoneHandLocal[2], reach)] : phoneHandLocal, poleR: [-0.9, -0.6, 0.2]};
    phoneInHand = reach >= 1;
    if (phoneInHand) watchPos = phoneW;
  }

  const j0 = solve(pose);
  const j = hideHead ? fpArms(j0) : j0;
  const eyeW: V3 = cam.pos;
  return (
    <Stage cam={cam} bg={grade ? '#0d0b1f' : '#120e2a'} fog={[5, 14]}>
      <Set t={t} charge={ch} flash={flash} phone={phoneState} hidePhone={phoneInHand} grade={grade} />
      <Stickman3D j={j} pos={pos} yaw={yaw} wear="you" hideHead={hideHead} fp={hideHead} thumbL={thumbL} rim={grade ? '#8a8fb0' : '#a9c8ff'} />
      <Blob p={[pos[0], 0, pos[2]]} s={0.9} o={0.5} />
      {watchPos && v !== 'present' ? (
        <Facing p={watchPos} target={eyeW}>
          <Chronometer glow={0.25 + press * 0.8 + (v === 'hook' ? smooth(inv(0.2, 1.4, t)) * 0.3 : 0)} tick={Math.floor(t)} crownPress={press} />
          <ChronoChain to={[0.03, -0.12, -0.08]} />
        </Facing>
      ) : null}
      {watchPos && v === 'present' ? (
        <Facing p={watchPos} target={eyeW}>
          <group position={[0, 0, 0]}>
            <Phone state="incoming" t={t} />
          </group>
        </Facing>
      ) : null}
    </Stage>
  );
};
export const PHONE_SIZE = PHONE;
export const SEGS = SEG;
