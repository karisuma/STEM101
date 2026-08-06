import type { Flight, LaunchSettings } from "./simulation/model";

export type EnvironmentLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type EnvironmentLevels = {
  gravity: EnvironmentLevel;
  wind: EnvironmentLevel;
  drag: EnvironmentLevel;
  airDensity: EnvironmentLevel;
};

export type ExperimentRecord = {
  id: string;
  createdAt: string;
  angle: number;
  speed: number;
  startHeight: number;
  gravityLevel: EnvironmentLevel;
  gravity: number;
  windLevel: EnvironmentLevel;
  wind: number;
  dragLevel: EnvironmentLevel;
  drag: number;
  airDensityLevel: EnvironmentLevel;
  airDensity: number;
  distance: number;
  peakHeight: number;
  duration: number;
  impactSpeed: number;
  settings: LaunchSettings;
};

export const GRAVITY_LEVELS = [
  { value: 1.62, label: "달 수준" },
  { value: 3.71, label: "약함" },
  { value: 6.2, label: "중간" },
  { value: 9.81, label: "지구 수준" },
  { value: 15.5, label: "강함" },
  { value: 24.79, label: "목성 수준" },
] as const;

export const WIND_LEVELS = [
  { value: 0, label: "없음" },
  { value: 2.5, label: "산들바람" },
  { value: 5, label: "약함" },
  { value: 7.5, label: "중간" },
  { value: 10, label: "강함" },
  { value: 12.5, label: "매우 강함" },
] as const;

export const DRAG_LEVELS = [
  { value: 0, label: "없음" },
  { value: 0.012, label: "매우 작음" },
  { value: 0.025, label: "작음" },
  { value: 0.045, label: "중간" },
  { value: 0.075, label: "큼" },
  { value: 0.11, label: "매우 큼" },
] as const;

export const AIR_DENSITY_LEVELS = [
  { value: 0, label: "진공" },
  { value: 0.3, label: "매우 희박" },
  { value: 0.6, label: "희박" },
  { value: 0.9, label: "보통 이하" },
  { value: 1.225, label: "해수면 표준" },
  { value: 1.5, label: "조밀" },
] as const;

export const DEFAULT_ENVIRONMENT: EnvironmentLevels = {
  gravity: 3,
  wind: 0,
  drag: 0,
  airDensity: 4,
};

const STORAGE_KEY = "stem101:projectile-experiments:v2";

export const clampLevel = (value: number): EnvironmentLevel =>
  Math.max(0, Math.min(5, Math.round(value))) as EnvironmentLevel;

export const settingsFromLevels = (
  settings: LaunchSettings,
  levels: EnvironmentLevels,
): LaunchSettings => ({
  ...settings,
  gravity: GRAVITY_LEVELS[levels.gravity].value,
  wind: WIND_LEVELS[levels.wind].value,
  airResistance: levels.drag > 0,
  drag: DRAG_LEVELS[levels.drag].value,
  airDensity: AIR_DENSITY_LEVELS[levels.airDensity].value,
});

export const createExperimentRecord = (
  flight: Flight,
  levels: EnvironmentLevels,
  id: string,
): ExperimentRecord => ({
  id,
  createdAt: new Date().toISOString(),
  angle: flight.settings.angle,
  speed: flight.settings.speed,
  startHeight: flight.settings.startHeight,
  gravityLevel: levels.gravity,
  gravity: flight.settings.gravity,
  windLevel: levels.wind,
  wind: flight.settings.wind,
  dragLevel: levels.drag,
  drag: flight.settings.airResistance ? flight.settings.drag : 0,
  airDensityLevel: levels.airDensity,
  airDensity: flight.settings.airDensity,
  distance: flight.distance,
  peakHeight: flight.peakHeight,
  duration: flight.duration,
  impactSpeed: flight.impactSpeed,
  settings: { ...flight.settings },
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is ExperimentRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ExperimentRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    isFiniteNumber(record.angle) &&
    isFiniteNumber(record.speed) &&
    isFiniteNumber(record.startHeight) &&
    isFiniteNumber(record.gravity) &&
    isFiniteNumber(record.wind) &&
    isFiniteNumber(record.drag) &&
    isFiniteNumber(record.airDensity) &&
    isFiniteNumber(record.distance) &&
    isFiniteNumber(record.peakHeight) &&
    isFiniteNumber(record.duration) &&
    isFiniteNumber(record.impactSpeed) &&
    isFiniteNumber(record.gravityLevel) &&
    isFiniteNumber(record.windLevel) &&
    isFiniteNumber(record.dragLevel) &&
    isFiniteNumber(record.airDensityLevel) &&
    !!record.settings
  );
};

export const readExperiments = (): ExperimentRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
};

export const writeExperiments = (records: ExperimentRecord[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 저장 공간이 부족해도 현재 실험은 계속 작동해야 한다.
  }
};
