import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import {
  BackSide,
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector3,
} from "three";
import {
  getCelestialDirections,
  latLonToVector,
  type Location,
  type TideOptions,
  type Vec3,
} from "../simulation/model";

type ViewMode = "earth" | "system";

type TideSceneProps = {
  hour: number;
  date: string;
  location: Location;
  tideOptions: TideOptions;
  exaggeration: number;
  viewMode: ViewMode;
};

const toVector3 = (value: Vec3, length = 1) =>
  new Vector3(value[0], value[1], value[2]).multiplyScalar(length);

const orbitPoints = (radius: number) =>
  Array.from({ length: 97 }, (_, index) => {
    const angle = (index / 96) * Math.PI * 2;
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [
      number,
      number,
      number,
    ];
  });

function CameraRig({ viewMode }: { viewMode: ViewMode }) {
  const { camera } = useThree();
  const target = useMemo(
    () =>
      viewMode === "earth"
        ? new Vector3(0.2, 1.2, 4.6)
        : new Vector3(0, 6.4, 10.8),
    [viewMode],
  );
  const moving = useRef(true);

  useEffect(() => {
    moving.current = true;
  }, [target]);

  useFrame((_, delta) => {
    if (!moving.current) return;
    camera.position.lerp(target, 1 - Math.exp(-delta * 3.6));
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(target) < 0.02) {
      camera.position.copy(target);
      moving.current = false;
    }
  });

  return null;
}

const vertexShader = `
  uniform vec3 uMoonDirection;
  uniform vec3 uSunDirection;
  uniform float uMoonStrength;
  uniform float uSunStrength;
  uniform float uExaggeration;

  varying float vTide;
  varying vec3 vNormalWorld;

  float p2(float value) {
    return (3.0 * value * value - 1.0) * 0.5;
  }

  void main() {
    vec3 sphereNormal = normalize(position);
    float totalStrength = max(uMoonStrength + uSunStrength, 0.001);
    float tide = (
      uMoonStrength * p2(dot(sphereNormal, normalize(uMoonDirection))) +
      uSunStrength * p2(dot(sphereNormal, normalize(uSunDirection)))
    ) / totalStrength;

    vec3 displaced = position + sphereNormal * tide * uExaggeration;
    vTide = tide;
    vNormalWorld = normalize(mat3(modelMatrix) * sphereNormal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uSunDirection;
  varying float vTide;
  varying vec3 vNormalWorld;

  void main() {
    float light = max(dot(normalize(vNormalWorld), normalize(uSunDirection)), 0.0);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormalWorld), vec3(0.0, 0.0, 1.0))), 2.0);
    vec3 lowColor = vec3(0.015, 0.25, 0.34);
    vec3 highColor = vec3(0.07, 0.78, 0.88);
    vec3 color = mix(lowColor, highColor, clamp(vTide + 0.35, 0.0, 1.0));
    color *= 0.42 + light * 0.58;
    color += fresnel * vec3(0.08, 0.38, 0.48);
    gl_FragColor = vec4(color, 0.72);
  }
`;

function TideOcean({
  moonDirection,
  sunDirection,
  tideOptions,
  exaggeration,
}: {
  moonDirection: Vec3;
  sunDirection: Vec3;
  tideOptions: TideOptions;
  exaggeration: number;
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uMoonDirection: { value: toVector3(moonDirection) },
      uSunDirection: { value: toVector3(sunDirection) },
      uMoonStrength: { value: tideOptions.moonEnabled ? 1 : 0 },
      uSunStrength: { value: tideOptions.sunEnabled ? 0.46 : 0 },
      uExaggeration: { value: exaggeration },
    }),
    [],
  );

  useFrame(() => {
    if (!material.current) return;
    material.current.uniforms.uMoonDirection.value.copy(
      toVector3(moonDirection),
    );
    material.current.uniforms.uSunDirection.value.copy(toVector3(sunDirection));
    material.current.uniforms.uMoonStrength.value = tideOptions.moonEnabled
      ? 1
      : 0;
    material.current.uniforms.uSunStrength.value = tideOptions.sunEnabled
      ? 0.46
      : 0;
    material.current.uniforms.uExaggeration.value = exaggeration;
  });

  return (
    <mesh>
      <sphereGeometry args={[1.035, 128, 96]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

function LocationMarker({ location }: { location: Location }) {
  const position = useMemo(
    () =>
      toVector3(
        latLonToVector(location.latitude, location.longitude),
        1.13,
      ),
    [location.latitude, location.longitude],
  );

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.035, 20, 20]} />
        <meshBasicMaterial color="#ff7557" />
      </mesh>
      <pointLight color="#ff7557" intensity={0.7} distance={0.7} />
    </group>
  );
}

function Earth({
  moonDirection,
  sunDirection,
  location,
  tideOptions,
  exaggeration,
}: {
  moonDirection: Vec3;
  sunDirection: Vec3;
  location: Location;
  tideOptions: TideOptions;
  exaggeration: number;
}) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <meshStandardMaterial
          color="#0b3445"
          roughness={0.82}
          metalness={0.05}
        />
      </mesh>

      <mesh scale={1.015}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial
          color="#90aeb4"
          wireframe
          transparent
          opacity={0.07}
        />
      </mesh>

      <TideOcean
        moonDirection={moonDirection}
        sunDirection={sunDirection}
        tideOptions={tideOptions}
        exaggeration={exaggeration}
      />

      <mesh scale={1.16}>
        <sphereGeometry args={[1, 64, 48]} />
        <meshBasicMaterial
          color="#4fd8ea"
          transparent
          opacity={0.08}
          side={BackSide}
        />
      </mesh>

      <Line
        points={orbitPoints(1.065)}
        color="#7d9ba4"
        transparent
        opacity={0.28}
        lineWidth={0.7}
      />
      <LocationMarker location={location} />
    </group>
  );
}

function SceneContent({
  hour,
  date,
  location,
  tideOptions,
  exaggeration,
  viewMode,
}: TideSceneProps) {
  const { sunDirection, moonDirection } = getCelestialDirections(
    hour,
    location,
    date,
    tideOptions.moonPhase,
  );
  const sunPosition = toVector3(sunDirection, 8);
  const moonPosition = toVector3(moonDirection, 4.2);

  return (
    <>
      <CameraRig viewMode={viewMode} />
      <color attach="background" args={["#050b11"]} />
      <fog attach="fog" args={["#050b11", 10, 22]} />
      <ambientLight intensity={0.1} />
      <directionalLight
        position={sunPosition}
        color="#fff1c1"
        intensity={2.8}
      />

      <Stars
        radius={45}
        depth={25}
        count={1800}
        factor={2.2}
        saturation={0}
        fade
        speed={0.18}
      />

      <Line
        points={orbitPoints(4.2)}
        color="#667981"
        transparent
        opacity={0.24}
        lineWidth={0.7}
      />

      <Earth
        moonDirection={moonDirection}
        sunDirection={sunDirection}
        location={location}
        tideOptions={tideOptions}
        exaggeration={exaggeration}
      />

      <group position={moonPosition}>
        <mesh>
          <sphereGeometry args={[0.22, 40, 32]} />
          <meshStandardMaterial color="#d5d6cf" roughness={0.92} />
        </mesh>
      </group>

      <group position={sunPosition}>
        <mesh>
          <sphereGeometry args={[0.52, 40, 32]} />
          <meshBasicMaterial color={new Color("#ffd26a")} />
        </mesh>
        <pointLight color="#ffc55a" intensity={2} distance={4} />
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2.8}
        maxDistance={14}
        autoRotate={false}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

export default function TideScene(props: TideSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0.2, 1.2, 4.6], fov: 42, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
