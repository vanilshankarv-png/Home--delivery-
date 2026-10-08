import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Text } from "@react-three/drei";
import * as THREE from "three";

function ParticleField() {
  const pointsRef = useRef();
  const positions = useMemo(() => {
    const data = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 18;
      data[i * 3 + 1] = (Math.random() - 0.5) * 12;
      data[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    }
    return data;
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.012;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.08) * 0.025;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={800} />
      </bufferGeometry>
      <pointsMaterial color="#9da9ff" size={0.035} sizeAttenuation transparent opacity={0.78} depthWrite={false} />
    </points>
  );
}

function OrbitRings() {
  const ringA = useRef();
  const ringB = useRef();
  const ringC = useRef();

  useFrame((_, delta) => {
    if (ringA.current) ringA.current.rotation.z += delta * 0.18;
    if (ringB.current) ringB.current.rotation.x += delta * 0.13;
    if (ringC.current) ringC.current.rotation.y -= delta * 0.16;
  });

  return (
    <>
      <mesh ref={ringA} rotation={[Math.PI / 2.5, 0.3, 0]}>
        <torusGeometry args={[1.55, 0.008, 8, 128]} />
        <meshBasicMaterial color="#6d67ff" transparent opacity={0.65} />
      </mesh>
      <mesh ref={ringB} rotation={[0.9, 0.4, 0.2]}>
        <torusGeometry args={[1.78, 0.006, 8, 128]} />
        <meshBasicMaterial color="#35d9f2" transparent opacity={0.42} />
      </mesh>
      <mesh ref={ringC} rotation={[0.4, 1.2, 0.8]}>
        <torusGeometry args={[1.95, 0.004, 8, 128]} />
        <meshBasicMaterial color="#a89fff" transparent opacity={0.3} />
      </mesh>
    </>
  );
}

function LaunchButton({ launching, onLaunch }) {
  const groupRef = useRef();
  const coreRef = useRef();
  const glowRef = useRef();
  const hoveredRef = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.x = Math.PI / 2;
    const targetScale = hoveredRef.current ? 1.15 : 1;
    const targetPosition = launching ? 0 : Math.sin(state.clock.elapsedTime * 1.1) * 0.1;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.exp(-delta * 8));
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetPosition, 4, delta);
    groupRef.current.rotation.z += delta * 0.08;
    if (coreRef.current) {
      coreRef.current.material.emissiveIntensity = THREE.MathUtils.damp(
        coreRef.current.material.emissiveIntensity,
        hoveredRef.current ? 2.4 : 1.1,
        5,
        delta
      );
    }
    if (glowRef.current) {
      glowRef.current.intensity = THREE.MathUtils.damp(
        glowRef.current.intensity,
        hoveredRef.current ? 3.8 : 2.2,
        5,
        delta
      );
    }
  });

  function setHovered(hovered) {
    hoveredRef.current = hovered;
    document.body.style.cursor = hovered ? "pointer" : "auto";
  }

  return (
    <group
      ref={groupRef}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        setHovered(false);
        onLaunch();
      }}
    >
      <mesh ref={coreRef} castShadow>
        <cylinderGeometry args={[0.94, 0.94, 0.34, 96, 1, false]} />
        <meshStandardMaterial
          color="#5146e5"
          emissive="#523fff"
          emissiveIntensity={1.1}
          metalness={0.55}
          roughness={0.23}
        />
      </mesh>
      <mesh position={[0, 0.176, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.025, 96]} />
        <meshStandardMaterial color="#111932" emissive="#132c55" emissiveIntensity={0.75} metalness={0.35} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.89, 0.018, 12, 96]} />
        <meshBasicMaterial color="#35d9f2" />
      </mesh>
      <Text
        position={[0, 0.205, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.31}
        letterSpacing={0.12}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#a7f4ff"
      >
        LAUNCH
      </Text>
      <pointLight ref={glowRef} position={[0, 0.6, 0]} color="#604cff" intensity={2.2} distance={4} />
    </group>
  );
}

function CameraTransition({ launching }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const destination = launching ? new THREE.Vector3(0, 0, 0.45) : new THREE.Vector3(0, 0, 6);
    camera.position.lerp(destination, 1 - Math.exp(-delta * (launching ? 3 : 1.8)));
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SceneContent({ launching, onLaunch }) {
  const shockwaveRef = useRef();
  const startedRef = useRef(false);

  useFrame((state) => {
    if (launching && !startedRef.current) {
      startedRef.current = true;
      if (shockwaveRef.current) shockwaveRef.current.userData.startedAt = state.clock.elapsedTime;
    }
  });

  return (
    <>
      <color attach="background" args={["#080b14"]} />
      <fog attach="fog" args={["#080b14", 8, 20]} />
      <ambientLight intensity={0.8} />
      <pointLight position={[3, 3, 4]} color="#4438ff" intensity={25} distance={12} />
      <pointLight position={[-4, -2, 2]} color="#00cce8" intensity={14} distance={10} />
      <ParticleField />
      <Float speed={0.7} rotationIntensity={0.03} floatIntensity={0.1}>
        <group position={[0, 0, -0.55]}>
          <OrbitRings />
        </group>
      </Float>
      <LaunchButton launching={launching} onLaunch={onLaunch} />
      <mesh
        ref={shockwaveRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.23, 0]}
      >
        <ringGeometry args={[0.96, 1, 96]} />
        <meshBasicMaterial color="#8af5ff" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <ShockwaveEffect shockwaveRef={shockwaveRef} />
      <CameraTransition launching={launching} />
    </>
  );
}

function ShockwaveEffect({ shockwaveRef }) {
  useFrame((state) => {
    const ring = shockwaveRef.current;
    if (!ring || ring.userData.startedAt === undefined) return;
    const progress = Math.min((state.clock.elapsedTime - ring.userData.startedAt) / 1.3, 1);
    ring.scale.setScalar(0.8 + progress * 3.8);
    ring.material.opacity = Math.max(0, 0.9 * (1 - progress));
  });

  return null;
}

export default function LaunchScene({ launching, onLaunch }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      className="!absolute inset-0"
    >
      <SceneContent launching={launching} onLaunch={onLaunch} />
    </Canvas>
  );
}
