export type LaunchSettings = {
  angle: number;
  speed: number;
  gravity: number;
  startHeight: number;
  wind: number;
  airResistance: boolean;
  drag: number;
  airDensity: number;
};

export type FlightPoint = {
  x: number;
  y: number;
  time: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  speed: number;
};

export type Flight = {
  duration: number;
  distance: number;
  peakHeight: number;
  impactSpeed: number;
  trajectory: FlightPoint[];
  settings: LaunchSettings;
};

export type GravityPreset = {
  id: "moon" | "mars" | "earth" | "jupiter";
  label: string;
  gravity: number;
};

export const GRAVITY_PRESETS: GravityPreset[] = [
  { id: "moon", label: "달", gravity: 1.62 },
  { id: "mars", label: "화성", gravity: 3.71 },
  { id: "earth", label: "지구", gravity: 9.81 },
  { id: "jupiter", label: "목성", gravity: 24.79 },
];

export const DEFAULT_SETTINGS: LaunchSettings = {
  angle: 45,
  speed: 20,
  gravity: 9.81,
  startHeight: 1,
  wind: 0,
  airResistance: false,
  drag: 0.045,
  airDensity: 1.225,
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const simulateFlight = (settings: LaunchSettings): Flight => {
  const radians = toRadians(settings.angle);
  const delta = 0.02;
  const densityRatio = settings.airDensity / 1.225;
  const drag = settings.airResistance ? settings.drag * densityRatio : 0;
  const trajectory: FlightPoint[] = [];
  let x = 0;
  let y = settings.startHeight;
  let vx = settings.speed * Math.cos(radians);
  let vy = settings.speed * Math.sin(radians);
  let time = 0;
  let peakHeight = y;

  for (let step = 0; step < 6_000; step += 1) {
    const relativeVx = vx - settings.wind;
    const ax = -drag * relativeVx * Math.abs(relativeVx);
    const ay = -settings.gravity - drag * vy * Math.abs(vy);
    trajectory.push({ x, y: Math.max(0, y), time, vx, vy, ax, ay, speed: Math.hypot(vx, vy) });

    const nextVx = vx + ax * delta;
    const nextVy = vy + ay * delta;
    const nextX = x + nextVx * delta;
    const nextY = y + nextVy * delta;
    peakHeight = Math.max(peakHeight, nextY);

    if (nextY <= 0) {
      const ratio = y <= 0 ? 0 : y / (y - nextY);
      const groundVx = vx + (nextVx - vx) * ratio;
      const groundVy = vy + (nextVy - vy) * ratio;
      trajectory.push({
        x: x + (nextX - x) * ratio,
        y: 0,
        time: time + delta * ratio,
        vx: groundVx,
        vy: groundVy,
        ax,
        ay,
        speed: Math.hypot(groundVx, groundVy),
      });
      break;
    }

    x = nextX;
    y = nextY;
    vx = nextVx;
    vy = nextVy;
    time += delta;
  }

  const finalPoint = trajectory.at(-1) ?? trajectory[0];
  return {
    duration: finalPoint.time,
    distance: finalPoint.x,
    peakHeight,
    impactSpeed: finalPoint.speed,
    trajectory,
    settings: { ...settings },
  };
};

export const positionAt = (flight: Flight, progress: number): FlightPoint => {
  const index = Math.min(flight.trajectory.length - 1, Math.max(0, Math.round(progress * (flight.trajectory.length - 1))));
  return flight.trajectory[index];
};

export const buildAngleSweep = (settings: LaunchSettings) =>
  Array.from({ length: 17 }, (_, index) => {
    const angle = 5 + index * 5;
    return { angle, distance: simulateFlight({ ...settings, angle }).distance };
  });

export const formatNumber = (value: number, digits = 1) =>
  value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
