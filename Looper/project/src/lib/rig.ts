// One shared stickman rig (section 6.5). The same joint data drives the 3D figure
// and the flat 2D figure, so a mode or view switch never changes the pose.
// Character local space: Y up, the character faces +Z, its left side is +X.
import {V3, lerp, clamp} from './anim';

export const H = 1.8;
export const SEG = {
  head: H / 6, // diameter
  torso: 0.3 * H,
  upper: 0.17 * H,
  fore: 0.17 * H,
  thigh: 0.26 * H,
  shin: 0.26 * H,
};
export const HIP_Y = SEG.thigh + SEG.shin; // standing hip height
export const LIMB_R = 0.03; // constant stroke radius in metres

export type Pose = {
  hip: V3; // hip joint, local
  lean: number; // forward lean of the torso (rad, toward +Z)
  side: number; // sideways lean (rad, toward +X)
  headPitch: number; // nod down positive
  headYaw: number;
  handL: V3;
  handR: V3;
  poleL: V3; // elbow bend hint direction
  poleR: V3;
  footL: V3;
  footR: V3;
  kneePole: V3;
  mouth: number; // -1 worry, 0 neutral, 1 smile
  blink: number; // 0 open, 1 shut
};

export type Joints = {
  hip: V3;
  neck: V3;
  head: V3;
  shoulderL: V3;
  shoulderR: V3;
  elbowL: V3;
  elbowR: V3;
  handL: V3;
  handR: V3;
  hipL: V3;
  hipR: V3;
  kneeL: V3;
  kneeR: V3;
  footL: V3;
  footR: V3;
  toeL: V3;
  toeR: V3;
  spineDir: V3;
  headPitch: number;
  headYaw: number;
  mouth: number;
  blink: number;
};

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.sqrt(dot(a, a));
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const V = {add, sub, mul, dot, len, norm};

// analytic two bone IK: returns [mid joint, end joint]
export function ik2(root: V3, target: V3, l1: number, l2: number, pole: V3): [V3, V3] {
  const toT = sub(target, root);
  let d = len(toT);
  const dir = norm(toT);
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let p = sub(pole, mul(dir, dot(pole, dir)));
  if (len(p) < 1e-4) p = [0, 0, 1];
  p = norm(p);
  const mid = add(add(root, mul(dir, a)), mul(p, h));
  const end = add(root, mul(dir, d));
  return [mid, end];
}

export function solve(p: Pose): Joints {
  const cl = Math.cos(p.lean);
  const sl = Math.sin(p.lean);
  const cs = Math.cos(p.side);
  const ss = Math.sin(p.side);
  const spineDir = norm([ss, cl * cs, sl * cs]);
  const neck = add(p.hip, mul(spineDir, SEG.torso));
  const head = add(neck, mul(spineDir, SEG.head / 2 + 0.03));
  const sh = add(neck, mul(spineDir, -0.035));
  const shoulderL = add(sh, [0.05, 0, 0]);
  const shoulderR = add(sh, [-0.05, 0, 0]);
  const [elbowL, handL] = ik2(shoulderL, p.handL, SEG.upper, SEG.fore, p.poleL);
  const [elbowR, handR] = ik2(shoulderR, p.handR, SEG.upper, SEG.fore, p.poleR);
  const hipL = add(p.hip, [0.06, 0, 0]);
  const hipR = add(p.hip, [-0.06, 0, 0]);
  const [kneeL, footL] = ik2(hipL, p.footL, SEG.thigh, SEG.shin, p.kneePole);
  const [kneeR, footR] = ik2(hipR, p.footR, SEG.thigh, SEG.shin, p.kneePole);
  const fwd = norm([p.kneePole[0], 0, p.kneePole[2]]);
  const toeL = add(footL, mul(fwd, 0.1));
  const toeR = add(footR, mul(fwd, 0.1));
  return {
    hip: p.hip, neck, head, shoulderL, shoulderR, elbowL, elbowR, handL, handR,
    hipL, hipR, kneeL, kneeR, footL, footR, toeL, toeR, spineDir,
    headPitch: p.headPitch, headYaw: p.headYaw, mouth: p.mouth, blink: p.blink,
  };
}

// ---------- pose library ----------
const SH_Y = HIP_Y + SEG.torso - 0.035;

export function stand(t: number, breath = 1): Pose {
  const b = Math.sin(t * 2 * Math.PI * 0.25) * 0.008 * breath;
  return {
    hip: [0, HIP_Y - 0.005, 0],
    lean: 0.02 + b * 0.5,
    side: 0,
    headPitch: 0.02,
    headYaw: 0,
    handL: [0.17, SH_Y - 0.58 + b, 0.02],
    handR: [-0.17, SH_Y - 0.58 + b, 0.02],
    poleL: [0.3, 0, -1],
    poleR: [-0.3, 0, -1],
    footL: [0.1, 0.03, 0],
    footR: [-0.1, 0.03, 0],
    kneePole: [0, 0, 1],
    mouth: 0,
    blink: blinkAt(t),
  };
}

export function blinkAt(t: number) {
  const c = (t + 0.7) % 3.7;
  return c < 0.12 ? 1 : 0;
}

// walking, speed in strides per second, run=1 for running
export function walk(t: number, rate = 1.7, run = 0): Pose {
  const ph = t * rate * Math.PI * 2;
  const stride = lerp(0.28, 0.5, run);
  const lift = lerp(0.12, 0.28, run);
  const bob = Math.abs(Math.cos(ph)) * lerp(0.03, 0.07, run);
  const fz = (s: number) => Math.sin(ph + s) * stride;
  const fy = (s: number) => 0.03 + Math.max(0, Math.cos(ph + s)) * lift;
  const swing = lerp(0.22, 0.4, run);
  const armY = SH_Y - lerp(0.56, 0.38, run);
  return {
    hip: [0, HIP_Y - 0.04 - lerp(0, 0.06, run) + bob, 0],
    lean: lerp(0.06, 0.25, run),
    side: Math.sin(ph) * 0.02,
    headPitch: lerp(0.0, -0.1, run),
    headYaw: 0,
    handL: [0.16, armY, -Math.sin(ph) * swing + lerp(0, 0.18, run)],
    handR: [-0.16, armY, Math.sin(ph) * swing + lerp(0, 0.18, run)],
    poleL: [0.2, run * 0.3, -1],
    poleR: [-0.2, run * 0.3, -1],
    footL: [0.09, fy(0), fz(0)],
    footR: [-0.09, fy(Math.PI), fz(Math.PI)],
    kneePole: [0, 0, 1],
    mouth: 0,
    blink: blinkAt(t),
  };
}

// sitting on a chair of seat height sh (seat front edge at z=0.0)
export function sit(t: number, sh = 0.47): Pose {
  const b = Math.sin(t * 2 * Math.PI * 0.22) * 0.006;
  return {
    hip: [0, sh + 0.06, -0.08],
    lean: 0.08 + b,
    side: 0,
    headPitch: 0.05,
    headYaw: 0,
    handL: [0.14, sh + 0.2, 0.3],
    handR: [-0.14, sh + 0.2, 0.3],
    poleL: [0.6, -0.3, -0.5],
    poleR: [-0.6, -0.3, -0.5],
    footL: [0.11, 0.03, 0.36],
    footR: [-0.11, 0.03, 0.36],
    kneePole: [0, 0.4, 1],
    mouth: 0,
    blink: blinkAt(t),
  };
}

// sitting on the floor, back against something, knees up
export function floorSit(t: number): Pose {
  const b = Math.sin(t * 2 * Math.PI * 0.18) * 0.01;
  return {
    hip: [0, 0.1, -0.1],
    lean: 0.15 + b,
    side: 0,
    headPitch: 0.35,
    headYaw: 0,
    handL: [0.16, 0.5, 0.36],
    handR: [-0.16, 0.5, 0.36],
    poleL: [0.6, -0.2, -0.3],
    poleR: [-0.6, -0.2, -0.3],
    footL: [0.14, 0.03, 0.55],
    footR: [-0.14, 0.03, 0.55],
    kneePole: [0, 1, 0.4],
    mouth: -1,
    blink: blinkAt(t),
  };
}

export function mixPose(a: Pose, b: Pose, w: number): Pose {
  const m = (x: V3, y: V3): V3 => [lerp(x[0], y[0], w), lerp(x[1], y[1], w), lerp(x[2], y[2], w)];
  return {
    hip: m(a.hip, b.hip),
    lean: lerp(a.lean, b.lean, w),
    side: lerp(a.side, b.side, w),
    headPitch: lerp(a.headPitch, b.headPitch, w),
    headYaw: lerp(a.headYaw, b.headYaw, w),
    handL: m(a.handL, b.handL),
    handR: m(a.handR, b.handR),
    poleL: m(a.poleL, b.poleL),
    poleR: m(a.poleR, b.poleR),
    footL: m(a.footL, b.footL),
    footR: m(a.footR, b.footR),
    kneePole: m(a.kneePole, b.kneePole),
    mouth: lerp(a.mouth, b.mouth, w),
    blink: w < 0.5 ? a.blink : b.blink,
  };
}

// helpers to place a hand on a grip socket expressed in world space
export function toLocal(world: V3, pos: V3, yaw: number): V3 {
  const d = sub(world, pos);
  const c = Math.cos(-yaw);
  const s = Math.sin(-yaw);
  return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c];
}
export function toWorld(local: V3, pos: V3, yaw: number): V3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [pos[0] + local[0] * c + local[2] * s, pos[1] + local[1], pos[2] - local[0] * s + local[2] * c];
}

// head and eye positions in local space (for first person cameras and eye match)
export function headLocal(j: Joints): V3 {
  return j.head;
}
export function eyeLocal(j: Joints): V3 {
  return add(j.head, [0, 0.02, SEG.head * 0.45]);
}

// first person arms: elbows sit below the bottom corners of the frame so the
// forearms enter diagonally from the edges (the camera sits at the head joint).
export function fpArms(j: Joints): Joints {
  const el = (h: V3, side: number): V3 => add(h, mul(norm([0.55 * side, -0.78, -0.3]), SEG.fore));
  return {...j, elbowL: el(j.handL, 1), elbowR: el(j.handR, -1)};
}
