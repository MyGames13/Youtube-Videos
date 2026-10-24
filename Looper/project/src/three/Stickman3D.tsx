// 3D stickman: capsules of constant radius, sphere head, white matte toon with rim
// light and an ink hull, built from the shared rig joints (lib/rig.ts).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Joints, LIMB_R, SEG, V, toWorld} from '../lib/rig';
import {V3, C} from '../lib/anim';
import {toon, basic} from './mat';

export type Wardrobe = 'you' | 'young' | 'gran' | 'neighbor' | 'plain';

const UP = new THREE.Vector3(0, 1, 0);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false);
const sphGeo = new THREE.SphereGeometry(1, 24, 16);
const coneGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);

type SegProps = {a: V3; b: V3; r: number; mat: THREE.Material; ink?: boolean};
const Seg: React.FC<SegProps> = ({a, b, r, mat, ink = true}) => {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va);
  const l = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  return (
    <group position={mid} quaternion={q}>
      <mesh geometry={cylGeo} material={mat} scale={[r, l, r]} />
      {ink ? <mesh geometry={cylGeo} material={INK} scale={[r * 1.45, l, r * 1.45]} /> : null}
    </group>
  );
};
const Ball: React.FC<{p: V3; r: number; mat: THREE.Material; ink?: boolean}> = ({p, r, mat, ink = true}) => (
  <group position={p}>
    <mesh geometry={sphGeo} material={mat} scale={r} />
    {ink ? <mesh geometry={sphGeo} material={INK} scale={r * 1.35} /> : null}
  </group>
);
const INK = basic(C.ink, 1, false, THREE.BackSide);

// tapered tube between two points (coat, cardigan, hoodie bodies)
const Tube: React.FC<{a: V3; b: V3; ra: number; rb: number; mat: THREE.Material; squash?: number}> = ({a, b, ra, rb, mat, squash = 0.75}) => {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va);
  const l = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  const geo = useMemo(() => new THREE.CylinderGeometry(rb, ra, 1, 22, 1, false), [ra, rb]);
  return (
    <group position={mid} quaternion={q}>
      <mesh geometry={geo} material={mat} scale={[1, l, squash]} />
      <mesh geometry={geo} material={INK} scale={[1.06, l * 1.01, squash * 1.08]} />
    </group>
  );
};

export type StickProps = {
  j: Joints; // local joints
  pos?: V3;
  yaw?: number;
  wear?: Wardrobe;
  accent?: string;
  hideHead?: boolean;
  hideBody?: boolean; // first person: only arms
  rim?: string;
  rimStrength?: number;
  flat?: number;
  ghost?: number; // echo ghost opacity
  thumbL?: V3; // optional thumb direction (local)
  thumbR?: V3;
  fp?: boolean; // first person: forearms and hands only
};

export const Stickman3D: React.FC<StickProps> = (props) => {
  let {
  j, pos = [0, 0, 0], yaw = 0, wear = 'plain', accent = C.teal, hideHead, hideBody,
  rim = '#a9b8ff', rimStrength = 0.4, flat = 0, ghost, thumbL, thumbR, fp,
} = props;
  if (fp) { hideHead = true; hideBody = true; }
  const op = ghost ?? 1;
  const white = toon({color: C.white, rim, rimStrength: rimStrength * 0.5, flat, opacity: op, emissive: '#c8ccd8', emissiveIntensity: 0.22});
  const blue = toon({color: C.blue, rim, rimStrength: rimStrength * 0.6, flat, opacity: op, emissive: '#1c46c8', emissiveIntensity: 0.55});
  const blueDark = toon({color: '#2457D6', rim, rimStrength: rimStrength * 0.4, flat, opacity: op, emissive: '#16379e', emissiveIntensity: 0.5});
  const coral = toon({color: C.granCoral, rim: '#ffd2a0', rimStrength: rimStrength * 0.5, flat, opacity: op});
  const grey = toon({color: C.hoodie, rim, rimStrength: rimStrength * 0.5, flat, opacity: op});
  const mustard = toon({color: C.mustard, rim, rimStrength: rimStrength * 0.4, flat, opacity: op});
  const acc = toon({color: accent, rim, rimStrength: rimStrength * 0.4, flat, opacity: op});
  const black = basic('#101018', op);
  const r = LIMB_R;
  const ink = ghost === undefined;

  const cloth = wear === 'you' ? blue : wear === 'gran' ? coral : wear === 'young' ? grey : wear === 'neighbor' ? white : acc;
  const sleeve = wear === 'you' || wear === 'gran' || wear === 'young';
  const wrist = (e: V3, h: V3): V3 => V.add(h, V.mul(V.norm(V.sub(e, h)), 0.06));

  // face orientation
  const sd = new THREE.Vector3(...j.spineDir);
  const faceQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(j.headPitch, j.headYaw, 0, 'YXZ'));
  const tilt = new THREE.Quaternion().setFromUnitVectors(UP, sd);
  const headQ = tilt.multiply(faceQ);
  const hr = SEG.head / 2;

  const midKnee: V3 = V.mul(V.add(j.kneeL, j.kneeR), 0.5);
  const hipToKnee = V.sub(midKnee, j.hip);
  const coatEnd: V3 = V.add(j.hip, V.mul(V.norm(hipToKnee), Math.min(V.len(hipToKnee) + 0.08, 0.6)));
  const cardEnd: V3 = V.add(j.hip, V.mul(V.norm(hipToKnee), 0.16));

  return (
    <group position={pos} rotation={[0, yaw, 0]}>
      {/* arms */}
      {fp ? null : <Seg a={j.shoulderL} b={j.elbowL} r={r} mat={white} ink={ink} />}
      <Seg a={j.elbowL} b={j.handL} r={fp ? r * 0.6 : r} mat={white} ink={ink} />
      {fp ? null : <Seg a={j.shoulderR} b={j.elbowR} r={r} mat={white} ink={ink} />}
      <Seg a={j.elbowR} b={j.handR} r={fp ? r * 0.6 : r} mat={white} ink={ink} />
      <Ball p={j.handL} r={fp ? 0.038 : 0.048} mat={white} ink={ink} />
      <Ball p={j.handR} r={fp ? 0.038 : 0.048} mat={white} ink={ink} />
      <Ball p={j.elbowL} r={r} mat={white} ink={false} />
      <Ball p={j.elbowR} r={r} mat={white} ink={false} />
      {thumbL ? <Seg a={j.handL} b={V.add(j.handL, V.mul(V.norm(thumbL), 0.06))} r={0.017} mat={white} ink={ink} /> : null}
      {thumbR ? <Seg a={j.handR} b={V.add(j.handR, V.mul(V.norm(thumbR), 0.06))} r={0.017} mat={white} ink={ink} /> : null}
      {sleeve ? (
        <>
          {fp ? null : <Seg a={j.shoulderL} b={j.elbowL} r={r * 1.6} mat={cloth} ink={ink} />}
          <Seg a={fp ? j.elbowL : j.elbowL} b={wrist(j.elbowL, j.handL)} r={r * (fp ? 0.95 : 1.5)} mat={cloth} ink={ink} />
          {fp ? null : <Seg a={j.shoulderR} b={j.elbowR} r={r * 1.6} mat={cloth} ink={ink} />}
          <Seg a={fp ? j.elbowR : j.elbowR} b={wrist(j.elbowR, j.handR)} r={r * (fp ? 0.95 : 1.5)} mat={cloth} ink={ink} />
          {fp ? null : (
            <>
              <Ball p={j.elbowL} r={r * 1.55} mat={cloth} ink={false} />
              <Ball p={j.elbowR} r={r * 1.55} mat={cloth} ink={false} />
              <Ball p={j.shoulderL} r={r * 1.65} mat={cloth} ink={false} />
              <Ball p={j.shoulderR} r={r * 1.65} mat={cloth} ink={false} />
            </>
          )}
        </>
      ) : null}
      {hideBody ? null : (
        <>
          {/* torso and legs */}
          {fp ? null : <Seg a={j.hip} b={j.neck} r={r} mat={white} ink={ink} />}
          <Seg a={j.hipL} b={j.kneeL} r={r} mat={white} ink={ink} />
          <Seg a={j.kneeL} b={j.footL} r={r} mat={white} ink={ink} />
          <Seg a={j.hipR} b={j.kneeR} r={r} mat={white} ink={ink} />
          <Seg a={j.kneeR} b={j.footR} r={r} mat={white} ink={ink} />
          <Seg a={j.hipL} b={j.hipR} r={r} mat={white} ink={false} />
          <Seg a={j.footL} b={j.toeL} r={r * 1.1} mat={white} ink={ink} />
          <Seg a={j.footR} b={j.toeR} r={r * 1.1} mat={white} ink={ink} />
          <Ball p={j.kneeL} r={r} mat={white} ink={false} />
          <Ball p={j.kneeR} r={r} mat={white} ink={false} />
          {wear === 'you' ? (
            <>
              {fp ? null : <Tube a={j.neck} b={j.hip} ra={0.075} rb={0.1} mat={cloth} squash={0.62} />}
              <Tube a={j.hip} b={coatEnd} ra={0.1} rb={0.165} mat={cloth} squash={0.55} />
              {fp ? null : <Tube a={V.add(j.neck, V.mul(j.spineDir, -0.03))} b={V.add(j.neck, V.mul(j.spineDir, 0.075))} ra={0.075} rb={0.07} mat={blueDark} squash={0.8} />}
              {fp ? null : <Seg a={V.add(j.neck, [0, -0.02, 0.05])} b={V.add(coatEnd, [0, 0, 0.09])} r={0.006} mat={blueDark} ink={false} />}
            </>
          ) : null}
          {wear === 'gran' ? (
            <>
              <Tube a={j.neck} b={j.hip} ra={0.075} rb={0.11} mat={cloth} squash={0.65} />
              <Tube a={j.hip} b={cardEnd} ra={0.11} rb={0.125} mat={cloth} squash={0.65} />
            </>
          ) : null}
          {wear === 'young' ? (
            <>
              <Tube a={j.neck} b={j.hip} ra={0.085} rb={0.1} mat={cloth} squash={0.7} />
              <Ball p={V.add(j.neck, [0, 0.03, -0.09])} r={0.11} mat={grey} />
            </>
          ) : null}
          {wear === 'neighbor' ? (
            <Tube a={V.add(j.neck, V.mul(j.spineDir, -0.04))} b={V.add(j.neck, V.mul(j.spineDir, 0.05))} ra={0.075} rb={0.07} mat={mustard} squash={1} />
          ) : null}
          {wear === 'plain' ? <Tube a={j.neck} b={V.add(j.neck, V.mul(j.spineDir, -0.16))} ra={0.06} rb={0.09} mat={acc} /> : null}
        </>
      )}
      {hideHead || hideBody ? null : (
        <group position={j.head} quaternion={headQ}>
          <mesh geometry={sphGeo} material={white} scale={hr} />
          {ink ? <mesh geometry={sphGeo} material={INK} scale={hr * 1.06} /> : null}
          {/* eyes */}
          <mesh geometry={sphGeo} material={black} position={[0.052, 0.022, hr * 0.9]} scale={[0.017, 0.017 * (1 - j.blink * 0.85), 0.012]} />
          <mesh geometry={sphGeo} material={black} position={[-0.052, 0.022, hr * 0.9]} scale={[0.017, 0.017 * (1 - j.blink * 0.85), 0.012]} />
          {/* mouth */}
          <Mouth curve={j.mouth} z={hr * 0.93} mat={black} />
          {wear === 'gran' || wear === 'neighbor' ? (
            <>
              <mesh position={[0.052, 0.022, hr * 0.97]} material={black}>
                <torusGeometry args={[0.03, 0.006, 6, 20]} />
              </mesh>
              <mesh position={[-0.052, 0.022, hr * 0.97]} material={black}>
                <torusGeometry args={[0.03, 0.006, 6, 20]} />
              </mesh>
              <mesh position={[0, 0.026, hr * 0.99]} rotation={[0, 0, Math.PI / 2]} material={black} scale={[0.004, 0.025, 0.004]} geometry={cylGeo} />
            </>
          ) : null}
          {wear === 'gran' ? (
            <>
              <mesh geometry={sphGeo} material={white} position={[0, hr * 0.85, -hr * 0.45]} scale={0.062} />
              <mesh geometry={sphGeo} material={INK} position={[0, hr * 0.85, -hr * 0.45]} scale={0.07} />
            </>
          ) : null}
        </group>
      )}
    </group>
  );
};

const Mouth: React.FC<{curve: number; z: number; mat: THREE.Material}> = ({curve, z, mat}) => {
  if (Math.abs(curve) < 0.15) {
    return <mesh geometry={cylGeo} material={mat} position={[0, -0.045, z]} rotation={[0, 0, Math.PI / 2]} scale={[0.005, 0.05, 0.005]} />;
  }
  const smile = curve > 0;
  return (
    <mesh material={mat} position={[0, smile ? -0.025 : -0.07, z - 0.005]} rotation={[0, 0, smile ? Math.PI + 0.55 : 0.55]}>
      <torusGeometry args={[0.032, 0.005, 6, 14, Math.PI / 2.2]} />
    </mesh>
  );
};

// world position of a local joint, for grips and cameras
export const jointWorld = (local: V3, pos: V3, yaw: number) => toWorld(local, pos, yaw);
