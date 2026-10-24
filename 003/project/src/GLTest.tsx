import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const GLTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <div style={{ width, height, background: '#06080B' }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ position: [0, 1.5, 5], fov: 40 }}>
        <ambientLight intensity={0.3} />
        <spotLight position={[2, 4, 3]} intensity={60} castShadow angle={0.6} penumbra={0.5} />
        <mesh rotation={[0, frame / 20, 0]} castShadow position={[0, 1, 0]}>
          <torusKnotGeometry args={[0.6, 0.2, 200, 32]} />
          <meshToonMaterial color="#F4F6F8" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#1c232b" />
        </mesh>
      </ThreeCanvas>
    </div>
  );
};
