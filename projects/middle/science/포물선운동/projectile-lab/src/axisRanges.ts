import {
  AIR_DENSITY_LEVELS,
  DRAG_LEVELS,
  GRAVITY_LEVELS,
  WIND_LEVELS,
} from "./experiments";

export type ExperimentAxisKey =
  | "angle"
  | "speed"
  | "startHeight"
  | "gravityLevel"
  | "gravity"
  | "windLevel"
  | "wind"
  | "dragLevel"
  | "drag"
  | "airDensityLevel"
  | "airDensity"
  | "distance"
  | "peakHeight"
  | "duration"
  | "impactSpeed";

export type AxisExtent = { min: number; max: number };

export const LAUNCH_LIMITS = {
  angle: { min: 5, max: 85 },
  speed: { min: 3, max: 34 },
  startHeight: { min: 0, max: 20 },
} as const;

export const LAUNCH_HEIGHTS = [0, 5, 10, 15, 20] as const;

const minValue = (values: readonly { value: number }[]) =>
  Math.min(...values.map(({ value }) => value));

const maxValue = (values: readonly { value: number }[]) =>
  Math.max(...values.map(({ value }) => value));

const niceCeiling = (value: number, step: number) =>
  Math.ceil(value / step) * step;

function calculateVacuumResultMaximums() {
  const speed = LAUNCH_LIMITS.speed.max;
  const height = LAUNCH_LIMITS.startHeight.max;
  const gravity = minValue(GRAVITY_LEVELS);
  let distance = 0;
  let peakHeight = 0;
  let duration = 0;

  // 조준 각도는 화면에서 정수 단위로 저장되므로 허용 각도를 모두 계산한다.
  for (let angle = LAUNCH_LIMITS.angle.min; angle <= LAUNCH_LIMITS.angle.max; angle += 1) {
    const radians = (angle * Math.PI) / 180;
    const vx = speed * Math.cos(radians);
    const vy = speed * Math.sin(radians);
    const flightTime = (vy + Math.sqrt(vy ** 2 + 2 * gravity * height)) / gravity;
    distance = Math.max(distance, vx * flightTime);
    peakHeight = Math.max(peakHeight, height + vy ** 2 / (2 * gravity));
    duration = Math.max(duration, flightTime);
  }

  return {
    distance: niceCeiling(distance, 20),
    peakHeight: niceCeiling(peakHeight, 20),
    duration: niceCeiling(duration, 5),
    impactSpeed: niceCeiling(Math.sqrt(speed ** 2 + 2 * gravity * height), 5),
  };
}

export const RESULT_MAXIMUMS = calculateVacuumResultMaximums();

export const EXPERIMENT_AXIS_EXTENTS: Record<ExperimentAxisKey, AxisExtent> = {
  angle: LAUNCH_LIMITS.angle,
  speed: LAUNCH_LIMITS.speed,
  startHeight: LAUNCH_LIMITS.startHeight,
  gravityLevel: { min: 0, max: 5 },
  gravity: { min: minValue(GRAVITY_LEVELS), max: maxValue(GRAVITY_LEVELS) },
  windLevel: { min: 0, max: 5 },
  wind: { min: minValue(WIND_LEVELS), max: maxValue(WIND_LEVELS) },
  dragLevel: { min: 0, max: 5 },
  drag: { min: minValue(DRAG_LEVELS), max: maxValue(DRAG_LEVELS) },
  airDensityLevel: { min: 0, max: 5 },
  airDensity: { min: minValue(AIR_DENSITY_LEVELS), max: maxValue(AIR_DENSITY_LEVELS) },
  distance: { min: 0, max: RESULT_MAXIMUMS.distance },
  peakHeight: { min: 0, max: RESULT_MAXIMUMS.peakHeight },
  duration: { min: 0, max: RESULT_MAXIMUMS.duration },
  impactSpeed: { min: 0, max: RESULT_MAXIMUMS.impactSpeed },
};

export const TRAJECTORY_AXIS_EXTENTS = {
  distance: { min: 0, max: 150 },
  height: { min: 0, max: 80 },
} as const;
