import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
export const GLTest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#07061A'}}>
      <ThreeCanvas width={1280} height={720} camera={{position: [0, 1.5, 5], fov: 45}}>
        <ambientLight intensity={0.3} />
        <pointLight position={[2, 3, 2]} intensity={30} color="#1EE6C8" />
        <mesh rotation={[0, f / 20, 0]} position={[0, 0.5, 0]}>
          <torusKnotGeometry args={[0.7, 0.25, 160, 24]} />
          <meshToonMaterial color="#2F6BFF" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#221A44" />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
