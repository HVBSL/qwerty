import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';

export default function ContactCube({ isFocused, isSubmitting }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      if (!isSubmitting && !isFocused) {
        meshRef.current.rotation.y += 0.006;
        meshRef.current.rotation.x += 0.003;
      } else if (isFocused && !isSubmitting) {
        meshRef.current.rotation.y += (0.4 - meshRef.current.rotation.y) * 0.1;
        meshRef.current.rotation.x += (0.2 - meshRef.current.rotation.x) * 0.1;
      } else if (isSubmitting) {
        meshRef.current.rotation.y += 0.22;
      }
    }
  });

  const getEdgeColor = () => {
    if (isSubmitting) return "#29e0e0";
    if (isFocused) return "#29e0e0";
    return "#7a3cff";
  };

  return (
    <group>
      <pointLight position={[2, 2, 3]} color="#ff2fd0" intensity={2} distance={10} />
      <mesh ref={meshRef}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial color={0x0a0a0c} roughness={0.4} />
        <Edges
          linewidth={2}
          threshold={15}
          color={getEdgeColor()}
        />
      </mesh>
    </group>
  );
}
