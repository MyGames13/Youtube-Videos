// The station (present, teal and violet): cancelled board, the zip jam, the running montage.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {C, V3, lerp, inv, smooth, easeOut, easeInOut, noise1, clamp} from '../lib/anim';
import {solve, stand, walk, toLocal} from '../lib/rig';
import {Stickman3D} from '../three/Stickman3D';
import {Stage, Cam} from '../three/Stage';
import {Box, Blob, Pic, Cyl} from '../three/sets';
import {Glow, Dust} from '../three/props';
import {toon, basic} from '../three/mat';
import {boardTexture} from '../three/textures';
import {XPunch} from '../two/Panel';
import type {ShotProps} from './index';

const PlatformSet: React.FC<{t: number; board: number; trainX?: number; doors?: number}> = ({t, board, trainX = 0, doors = 0}) => {
  const lights = Array.from({length: 9});
  return (
    <group>
      {/* platform */}
      <Box p={[0, -0.25, 2]} s={[60, 0.5, 10]} color="#2a2552" rim={0.1} />
      <Box p={[0, 0.005, -2.75]} s={[60, 0.01, 0.25]} color={C.gold} emissive={C.gold} ei={0.4} />
      {/* track bed */}
      <Box p={[0, -1.1, -5]} s={[60, 0.2, 4]} color="#14102b" />
      <Box p={[0, -0.95, -4.3]} s={[60, 0.08, 0.1]} color="#6b6a90" />
      <Box p={[0, -0.95, -5.7]} s={[60, 0.08, 0.1]} color="#6b6a90" />
      {/* back wall with tiles */}
      <Box p={[0, 2, 7.2]} s={[60, 5, 0.2]} color="#1c1740" />
      {Array.from({length: 14}).map((_, i) => (
        <Box key={i} p={[-26 + i * 4, 1.4, 7.05]} s={[3.6, 1.2, 0.05]} color={i % 3 === 0 ? '#2a3d6a' : '#241f4e'} rim={0.2} />
      ))}
      {/* pillars and lamps */}
      {lights.map((_, i) => {
        const x = -16 + i * 4;
        return (
          <group key={i}>
            <Box p={[x, 2.2, 1.4]} s={[0.3, 4.4, 0.3]} color="#2e2860" rim={0.4} />
            <Box p={[x, 3.6, -0.6]} s={[0.06, 0.04, 4]} color="#2e2860" />
            <Box p={[x, 3.3, -0.6]} s={[0.9, 0.06, 0.12]} color="#dff" emissive={C.teal} ei={1.2} />
            <Glow p={[x, 3.2, -0.6]} s={2.2} color={C.teal} o={0.22} />
          </group>
        );
      })}
      {/* departures board */}
      <group position={[0.4, 2.65, -1.2]}>
        <Box p={[0, 0, -0.04]} s={[2.5, 1.35, 0.08]} color="#0b0b16" rim={0.5} />
        <Pic p={[0, 0, 0.005]} w={2.36} h={1.2} tex={boardTexture(board)} emissive={1} />
        <Glow p={[0, 0, 0.4]} s={3} color={board ? C.coral : C.gold} o={0.12 + board * 0.1} />
        <Box p={[-0.8, 0.95, 0]} s={[0.03, 0.6, 0.03]} color="#2e2860" />
        <Box p={[0.8, 0.95, 0]} s={[0.03, 0.6, 0.03]} color="#2e2860" />
      </group>
      {/* train */}
      <group position={[trainX, 0, -4.9]}>
        <Box p={[0, 0.9, 0]} s={[22, 2.6, 2.6]} color="#3a3170" rim={0.4} />
        <Box p={[0, 2.25, 0]} s={[22, 0.12, 2.7]} color={C.violet} emissive={C.violet} ei={0.4} />
        {Array.from({length: 10}).map((_, i) => (
          <Box key={i} p={[-10 + i * 2.2, 1.35, 1.31]} s={[1.3, 0.7, 0.02]} color="#bff" emissive={C.cyan} ei={0.5} />
        ))}
        {[-4, 4].map((x, i) => (
          <group key={i}>
            <Box p={[x - 0.35 * (1 - doors), 0.75, 1.32]} s={[0.7, 1.7, 0.03]} color="#544a9a" />
            <Box p={[x + 0.35 * (1 - doors), 0.75, 1.32]} s={[0.7, 1.7, 0.03]} color="#544a9a" />
          </group>
        ))}
      </group>
      <ambientLight color="#5a50b0" intensity={0.85} />
      <directionalLight position={[3, 6, 4]} color="#d8d0ff" intensity={0.6} />
      <pointLight position={[0.4, 2.4, 0.2]} color={board ? C.coral : C.gold} intensity={3} distance={6} decay={1.5} />
      <pointLight position={[-4, 3, 0]} color={C.teal} intensity={4} distance={10} decay={1.3} />
      <pointLight position={[6, 3, 0]} color={C.violet} intensity={5} distance={12} decay={1.3} />
      <Dust t={t} n={30} area={[14, 3, 4]} center={[0, 1.6, 0]} color="#bfe8ff" o={0.25} />
    </group>
  );
};

// speed lines overlay for the run
const SpeedLines: React.FC<{t: number; amt: number}> = ({t, amt}) => (
  <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
    {Array.from({length: 26}).map((_, i) => {
      const y = (i * 53) % 720;
      const len = 120 + (i % 5) * 60;
      const x = 1400 - ((t * 2600 + i * 197) % 1700);
      return <line key={i} x1={x} y1={y} x2={x + len} y2={y} stroke="white" strokeWidth={2 + (i % 3)} opacity={0.18 * amt} strokeLinecap="round" />;
    })}
  </svg>
);

export const Station: React.FC<ShotProps & {v: 'cancel' | 'zip' | 'race'}> = ({t, dur, v}) => {
  if (v === 'cancel') {
    const board = t > 0.25 ? 1 : 0;
    const crane = easeInOut(clamp(t / dur));
    const cam: Cam = {pos: [lerp(-3.2, -1.6, crane), lerp(4.6, 2.0, crane), lerp(6.2, 4.2, crane)], look: [0.2, lerp(1.4, 1.9, crane), -0.8], fov: 46, shake: 0.004, t};
    const pose = {...stand(t), headPitch: -0.25, handR: [-0.17, 0.9, 0.05] as V3};
    return (
      <AbsoluteFill>
        <Stage cam={cam} bg="#110d28" fog={[8, 30]}>
          <PlatformSet t={t} board={board} trainX={0} doors={0} />
          <Stickman3D j={solve(pose)} pos={[-0.2, 0, 0.6]} yaw={Math.PI + 0.15} wear="you" />
          <Blob p={[-0.2, 0, 0.6]} s={0.9} />
        </Stage>
        <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
          <XPunch t={t} at={dur - 0.5} x={640} y={300} size={200} />
        </svg>
      </AbsoluteFill>
    );
  }
  if (v === 'zip') {
    // first person: looking down at the coat. Left hand pinches the zip pull, right hand holds the hem.
    const pull = smooth(inv(0.15, 0.55, t));
    const jam = t > 0.55 ? noise1(t * 50, 3) * 0.004 * (1 - inv(0.55, 1.2, t)) : 0;
    const zipY = lerp(0.95, 1.12, pull) + jam;
    const eye: V3 = [0, 1.68, 0.05];
    const cam: Cam = {pos: eye, look: [0, 1.08, 0.3], fov: 58, shake: 0.004, t};
    // coat front panel below the chin
    const pullPos: V3 = [0.0, zipY, 0.22];
    return (
      <AbsoluteFill>
        <Stage cam={cam} bg="#110d28" fog={[3, 18]}>
          <PlatformSet t={t} board={1} trainX={-lerp(0, 14, easeInOut(inv(0.4, dur, t)))} doors={0} />
          <group>
            {/* coat front: two panels with the zipper track between */}
            <Box p={[0.13, 1.05, 0.2]} s={[0.24, 0.62, 0.03]} r={[-0.35, 0.12, 0]} color={C.blue} rim={0.5} emissive="#1c46c8" ei={0.5} />
            <Box p={[-0.13, 1.05, 0.2]} s={[0.24, 0.62, 0.03]} r={[-0.35, -0.12, 0]} color={C.blue} rim={0.5} emissive="#1c46c8" ei={0.5} />
            <pointLight position={[0, 1.6, 0.6]} color="#ffffff" intensity={2.2} distance={2} decay={1.5} />
            <Box p={[0, 1.05, 0.215]} s={[0.025, 0.6, 0.01]} r={[-0.35, 0, 0]} color="#1b1b2a" />
            {/* closed teeth below the pull */}
            <Box p={[0, lerp(0.85, 0.94, pull), 0.24]} s={[0.03, lerp(0.15, 0.3, pull), 0.012]} r={[-0.35, 0, 0]} color="#b9b9c9" />
            <group position={pullPos} rotation={[-0.35, 0, 0]}>
              <Box p={[0, 0, 0.012]} s={[0.05, 0.035, 0.018]} color="#ffcf66" emissive="#a06000" ei={0.9} rim={0.6} />
              <Box p={[0, -0.04, 0.022]} s={[0.026, 0.06, 0.01]} color="#ffcf66" emissive="#a06000" ei={0.9} />
            </group>
          </group>
          {/* hands: left pinches the pull (thumb over it), right holds the hem */}
          <Stickman3D
            j={(() => {
              const p = {...stand(t), handL: [0.035, zipY - 0.03, 0.27] as V3, handR: [-0.1, 0.8, 0.27] as V3};
              const j = solve(p);
              return {...j, elbowL: [0.25, zipY - 0.25, 0.05] as V3, elbowR: [-0.3, 0.62, 0.05] as V3};
            })()}
            pos={[0, 0, 0]}
            yaw={0}
            wear="you"
            fp
            thumbL={[-0.6, 0.2, 0.3]}
          />
        </Stage>
        <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
          {t > 0.6 && t < 1.2 ? (
            <text x={760} y={330} fontFamily="Montserrat, sans-serif" fontWeight={900} fontSize={54} fill={C.coral} stroke="#07061A" strokeWidth={3} paintOrder="stroke" transform={`rotate(-8 760 330)`}>
              JAMMED
            </text>
          ) : null}
          <XPunch t={t} at={dur - 0.5} x={640} y={300} size={200} />
        </svg>
      </AbsoluteFill>
    );
  }
  // race: running montage with echo ghosts and internal hard cuts every ~0.45 s
  const seg = Math.max(0, Math.floor(t / 0.45));
  const x = t * 6 - 6;
  const pose = walk(t, 2.8, 1);
  const angles: Cam[] = [
    {pos: [x + 2.2, 1.2, 3.6], look: [x + 0.4, 1.0, 0.4], fov: 50, shake: 0.012, t},
    {pos: [x - 2.6, 0.5, 1.8], look: [x + 0.5, 1.1, 0.4], fov: 64, shake: 0.016, t},
    {pos: [x + 4, 3.4, 4.5], look: [x, 1.0, 0.4], fov: 40, shake: 0.01, t},
    {pos: [x + 0.8, 1.7, 2.4], look: [x - 0.3, 1.2, 0.2], fov: 56, shake: 0.014, t},
    {pos: [x - 1, 1.0, 5], look: [x + 1, 1.2, 0.4], fov: 38, shake: 0.01, t},
    {pos: [x + 2.2, 1.2, 3.6], look: [x + 0.4, 1.0, 0.4], fov: 50, shake: 0.012, t},
  ];
  const cam = angles[seg % angles.length];
  const ghosts = [0.12, 0.24, 0.36];
  return (
    <AbsoluteFill>
      <Stage cam={cam} bg="#130d2c" fog={[6, 26]}>
        <PlatformSet t={t} board={1} trainX={-t * 3} />
        <Stickman3D j={solve(pose)} pos={[x, 0, 0.4]} yaw={Math.PI / 2} wear="you" />
        {ghosts.map((d, i) => (
          <Stickman3D key={i} j={solve(walk(t - d, 2.8, 1))} pos={[x - d * 6, 0, 0.4]} yaw={Math.PI / 2} wear="you" ghost={0.32 - i * 0.09} rimStrength={1.2} rim={C.coral} />
        ))}
        <Blob p={[x, 0, 0.4]} s={0.9} />
      </Stage>
      <SpeedLines t={t} amt={1} />
      <svg viewBox="0 0 1280 720" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        {[0.45, 0.9, 1.35, 1.8].map((a, i) => (
          <XPunch key={i} t={t} at={a - 0.08} x={420 + ((i * 260) % 520)} y={250 + (i % 2) * 120} size={130} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
