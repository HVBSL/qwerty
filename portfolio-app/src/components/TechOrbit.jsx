import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export default function TechOrbit() {
  const groupRef = useRef();
  const [activeTech, setActiveTech] = useState('React');

  const techs = ["React", "ASP.NET Core", "MSSQL", "REST APIs", "WordPress", "PHP", "CI/CD Jenkins", "Node.js"];

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group>
      {/* Central Node */}
      <mesh>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial color={0x121214} roughness={0.3} metalness={0.8} emissive={0x221133} />
      </mesh>

      {/* Orbit Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.52, 48]} />
        <meshBasicMaterial color={0x29e0e0} side={THREE.DoubleSide} transparent opacity={0.3} />
      </mesh>

      <group ref={groupRef}>
        {techs.map((tech, i) => {
          const angle = (i / techs.length) * Math.PI * 2;
          const x = Math.cos(angle) * 1.51;
          const z = Math.sin(angle) * 1.51;

          return (
            <mesh
              key={tech}
              position={[x, 0, z]}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTech(tech);
              }}
              onPointerOver={() => document.body.style.cursor = 'pointer'}
              onPointerOut={() => document.body.style.cursor = 'auto'}
            >
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? 0xff2fd0 : 0x29e0e0}
                roughness={0.2}
                metalness={0.5}
              />
            </mesh>
          );
        })}
      </group>

      <Html position={[0, -2, 0]} center>
        <div className="text-xl font-mono text-[#29e0e0] bg-black/50 px-4 py-2 rounded whitespace-nowrap">
          Active: {activeTech}
        </div>
      </Html>
    </group>
  );
}
