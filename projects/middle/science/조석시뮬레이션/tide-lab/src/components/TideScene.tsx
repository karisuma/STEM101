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
export type FrameMode = "geo" | "helio";
export type ScaleMode = "learning" | "actual";

type TideSceneProps = {
  hour: number;
  date: string;
  location: Location;
  tideOptions: TideOptions;
  exaggeration: number;
  viewMode: ViewMode;
  frameMode: FrameMode;
  scaleMode: ScaleMode;
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

function CameraRig({
  viewMode,
  frameMode,
  scaleMode,
}: {
  viewMode: ViewMode;
  frameMode: FrameMode;
  scaleMode: ScaleMode;
}) {
  const { camera } = useThree();
  const target = useMemo(
    () => {
      if (viewMode === "earth") return new Vector3(0.2, 1.2, 4.6);
      if (scaleMode === "actual") {
        return frameMode === "helio"
          ? new Vector3(0, 2, 16)
          : new Vector3(0, 2.4, 8.5);
      }
      return frameMode === "helio"
        ? new Vector3(0, 8.8, 13)
        : new Vector3(0, 6.4, 10.8);
    },
    [frameMode, scaleMode, viewMode],
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
    vec3 lowColor = vec3(0.01, 0.18, 0.25);
    vec3 highColor = vec3(0.08, 0.86, 0.96);
    float tideContrast = smoothstep(-0.35, 0.72, vTide);
    vec3 color = mix(lowColor, highColor, tideContrast);
    color *= 0.46 + light * 0.54;
    color += fresnel * vec3(0.1, 0.48, 0.58);
    gl_FragColor = vec4(color, 0.84);
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

function LocationMarker({
  location,
  emphasized,
}: {
  location: Location;
  emphasized: boolean;
}) {
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
        <sphereGeometry args={[emphasized ? 0.06 : 0.035, 20, 20]} />
        <meshBasicMaterial color="#ff7557" />
      </mesh>
      <pointLight
        color="#ff7557"
        intensity={emphasized ? 1.2 : 0.7}
        distance={emphasized ? 1.1 : 0.7}
      />
    </group>
  );
}

function Earth({
  moonDirection,
  sunDirection,
  location,
  tideOptions,
  exaggeration,
  surfaceRotation,
  emphasizeLocation,
}: {
  moonDirection: Vec3;
  sunDirection: Vec3;
  location: Location;
  tideOptions: TideOptions;
  exaggeration: number;
  surfaceRotation: number;
  emphasizeLocation: boolean;
}) {
  return (
    <group>
      <group rotation={[0, surfaceRotation, 0]}>
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
        <LocationMarker location={location} emphasized={emphasizeLocation} />
      </group>

      <TideOcean
        moonDirection={moonDirection}
        sunDirection={sunDirection}
        tideOptions={tideOptions}
        exaggeration={exaggeration}
      />

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
  frameMode,
  scaleMode,
}: TideSceneProps) {
  const { sunDirection, moonDirection } = getCelestialDirections(
    hour,
    location,
    date,
    tideOptions.moonPhase,
  );
  const surfaceMode = viewMode === "earth";
  const learning = scaleMode === "learning";
  const geo = frameMode === "geo" || surfaceMode;
  const rotatingLocation = !surfaceMode && learning && !geo;
  const surfaceRotation = rotatingLocation ? -(hour / 24) * Math.PI * 2 : 0;
  const dayOfYear = Math.floor(
    (Date.parse(`${date}T12:00:00Z`) -
      Date.UTC(new Date(`${date}T12:00:00Z`).getUTCFullYear(), 0, 0)) /
      86_400_000,
  );
  const orbitalAngle = Math.PI * 2 * (dayOfYear / 365.24 - 0.22);
  const learningEarthPosition = new Vector3(
    Math.cos(orbitalAngle) * 7.2,
    0,
    Math.sin(orbitalAngle) * 7.2,
  );
  const flatMoonDirection = new Vector3(
    moonDirection[0],
    0,
    moonDirection[2],
  ).normalize();
  const earthPosition =
    surfaceMode || (learning && geo)
      ? new Vector3()
      : learning
        ? learningEarthPosition
        : geo
          ? new Vector3(-3, 0, 0)
          : new Vector3(6, 0, 0);
  const sunPosition =
    surfaceMode || (learning && geo)
      ? toVector3(sunDirection, 8)
      : learning
        ? new Vector3()
        : geo
          ? new Vector3(40, 0, 0)
          : new Vector3(-6, 0, 0);
  const moonPosition =
    surfaceMode || (learning && geo)
      ? toVector3(moonDirection, 4.2)
      : learning
        ? learningEarthPosition.clone().addScaledVector(flatMoonDirection, 0.78)
        : geo
          ? new Vector3(3, 0, 0)
          : new Vector3(6.0308, 0, 0);
  const earthScale =
    surfaceMode || (learning && geo)
      ? 1
      : learning
        ? 0.42
        : geo
          ? 0.1
          : 0.000512;
  const sunScale =
    surfaceMode || (learning && geo) ? 1 : learning ? 1.7 : geo ? 0 : 0.112;
  const moonScale =
    surfaceMode || (learning && geo) ? 1 : learning ? 0.55 : geo ? 0.123 : 0.000632;

  return (
    <>
      <CameraRig
        viewMode={viewMode}
        frameMode={frameMode}
        scaleMode={scaleMode}
      />
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

      {learning && geo ? (
        <Line
          points={orbitPoints(4.2)}
          color="#667981"
          transparent
          opacity={0.24}
          lineWidth={0.7}
        />
      ) : learning ? (
        <>
          <Line
            points={orbitPoints(7.2)}
            color="#667981"
            transparent
            opacity={0.24}
            lineWidth={0.7}
          />
          <group position={learningEarthPosition}>
            <Line
              points={orbitPoints(0.78)}
              color="#82959b"
              transparent
              opacity={0.3}
              lineWidth={0.7}
            />
          </group>
        </>
      ) : (
        <Line
          points={[
            [geo ? -3 : -6, 0, 0],
            [geo ? 3 : 6, 0, 0],
          ]}
          color="#91a4aa"
          transparent
          opacity={0.75}
          lineWidth={0.8}
        />
      )}

      <group position={earthPosition} scale={earthScale}>
        <Earth
          moonDirection={moonDirection}
          sunDirection={sunDirection}
          location={location}
          tideOptions={tideOptions}
          exaggeration={exaggeration}
          surfaceRotation={surfaceRotation}
          emphasizeLocation={rotatingLocation}
        />
      </group>
      {scaleMode === "actual" && frameMode === "geo" && (
        <group position={earthPosition}>
          <mesh>
            <ringGeometry args={[0.11, 0.15, 32]} />
            <meshBasicMaterial
              color="#53d6df"
              transparent
              opacity={0.85}
              depthTest={false}
              side={DoubleSide}
            />
          </mesh>
        </group>
      )}

      <group position={moonPosition} scale={moonScale}>
        <mesh>
          <sphereGeometry args={[0.22, 40, 32]} />
          <meshStandardMaterial color="#d5d6cf" roughness={0.92} />
        </mesh>
      </group>
      {scaleMode === "actual" && frameMode === "geo" && (
        <group position={moonPosition}>
          <mesh>
            <ringGeometry args={[0.055, 0.075, 24]} />
            <meshBasicMaterial
              color="#d5d6cf"
              transparent
              opacity={0.85}
              depthTest={false}
              side={DoubleSide}
            />
          </mesh>
        </group>
      )}

      <group position={sunPosition} scale={sunScale}>
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
        maxDistance={scaleMode === "actual" ? 24 : 16}
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
