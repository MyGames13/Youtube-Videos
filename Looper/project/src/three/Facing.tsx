import React from 'react';
import * as THREE from 'three';
import {V3} from '../lib/anim';

// orient a group so its local +Z points at target (props facing the eye, screens, etc.)
export function facingQuat(from: V3, to: V3, up: V3 = [0, 1, 0], roll = 0) {
  const o = new THREE.Object3D();
  o.position.set(...from);
  o.up.set(...up);
  o.lookAt(new THREE.Vector3(...to));
  if (roll) o.rotateZ(roll);
  return o.quaternion.clone();
}

export const Facing: React.FC<{p: V3; target: V3; up?: V3; roll?: number; children: React.ReactNode}> = ({p, target, up, roll, children}) => (
  <group position={p} quaternion={facingQuat(p, target, up, roll)}>
    {children}
  </group>
);

// local offset in a facing frame to world
export function frameOffset(p: V3, target: V3, off: V3, up: V3 = [0, 1, 0], roll = 0): V3 {
  const q = facingQuat(p, target, up, roll);
  const v = new THREE.Vector3(...off).applyQuaternion(q);
  return [p[0] + v.x, p[1] + v.y, p[2] + v.z];
}
