export type Vec3 = readonly [number, number, number];

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

export type TideOptions = {
  moonEnabled: boolean;
  sunEnabled: boolean;
  moonPhase: number;
  displayMode: TideDisplayMode;
};

export type TideDisplayMode = "concept" | "relative";

export type Sample = {
  hour: number;
  tide: number;
  daylight: number;
};

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const LUNAR_DAY_HOURS = 24 + 50 / 60;
const MOON_STRENGTH = 1;
const SUN_STRENGTH = 0.46;

export const LOCATIONS: Location[] = [
  { name: "서울", latitude: 37.5665, longitude: 126.978 },
  { name: "부산", latitude: 35.1796, longitude: 129.0756 },
  { name: "제주", latitude: 33.4996, longitude: 126.5312 },
  { name: "인천", latitude: 37.4563, longitude: 126.7052 },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const dot = (a: Vec3, b: Vec3) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const latLonToVector = (latitude: number, longitude: number): Vec3 => {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), Math.sin(lat), cosLat * Math.sin(lon)];
};

const directionFromSubpoint = (declination: number, longitude: number): Vec3 =>
  latLonToVector(declination, longitude);

export const dayOfYear = (date: string) => {
  const current = new Date(`${date}T12:00:00Z`);
  const start = new Date(Date.UTC(current.getUTCFullYear(), 0, 0));
  return Math.floor((current.getTime() - start.getTime()) / 86_400_000);
};

export const solarDeclination = (date: string) => {
  const day = dayOfYear(date);
  return 23.44 * Math.sin((TAU * (284 + day)) / 365.24);
};

export const getCelestialDirections = (
  hour: number,
  location: Location,
  date: string,
  moonPhase: number,
) => {
  // 지구 고정 좌표계. 선택 지점의 자정을 hour=0으로 둔다.
  const sunLongitude =
    location.longitude + 180 + (hour / 24) * 360;
  const moonLongitude =
    location.longitude +
    180 +
    moonPhase * 360 +
    (hour / LUNAR_DAY_HOURS) * 360;

  const sunDirection = directionFromSubpoint(
    solarDeclination(date),
    sunLongitude,
  );
  const moonDeclination =
    5.14 * Math.sin(TAU * (dayOfYear(date) / 27.321661 + moonPhase));
  const moonDirection = directionFromSubpoint(
    moonDeclination,
    moonLongitude,
  );

  return { sunDirection, moonDirection };
};

const legendreP2 = (cosine: number) => (3 * cosine * cosine - 1) / 2;

export const getTideLevel = (
  observer: Vec3,
  sunDirection: Vec3,
  moonDirection: Vec3,
  options: TideOptions,
) => {
  const moon = options.moonEnabled
    ? MOON_STRENGTH * legendreP2(dot(observer, moonDirection))
    : 0;
  const sun = options.sunEnabled
    ? SUN_STRENGTH * legendreP2(dot(observer, sunDirection))
    : 0;
  const activeStrength =
    (options.moonEnabled ? MOON_STRENGTH : 0) +
    (options.sunEnabled ? SUN_STRENGTH : 0);
  // 개념 보기는 켜진 천체만으로 정규화해 모양을 읽기 쉽게 한다.
  // 상대 세기 보기는 달=1.00을 고정 기준으로 삼아 태양만 켰을 때도
  // 조석 팽대부가 달의 약 0.46배로 남도록 한다.
  const scale =
    options.displayMode === "relative" ? MOON_STRENGTH : activeStrength;
  return scale === 0 ? 0 : (moon + sun) / scale;
};

export const getDaylight = (observer: Vec3, sunDirection: Vec3) =>
  dot(observer, sunDirection);

export const getSample = (
  hour: number,
  location: Location,
  date: string,
  options: TideOptions,
): Sample => {
  const observer = latLonToVector(location.latitude, location.longitude);
  const { sunDirection, moonDirection } = getCelestialDirections(
    hour,
    location,
    date,
    options.moonPhase,
  );
  return {
    hour,
    tide: getTideLevel(observer, sunDirection, moonDirection, options),
    daylight: getDaylight(observer, sunDirection),
  };
};

export const buildDaySamples = (
  location: Location,
  date: string,
  options: TideOptions,
  endHour = 26,
) => {
  const samples: Sample[] = [];
  for (let hour = 0; hour <= endHour; hour += 0.25) {
    samples.push(getSample(hour, location, date, options));
  }
  return samples;
};

export const getTideTrend = (
  hour: number,
  location: Location,
  date: string,
  options: TideOptions,
) => {
  const before = getSample(hour - 0.04, location, date, options).tide;
  const after = getSample(hour + 0.04, location, date, options).tide;
  if (Math.abs(after - before) < 0.002) return "정체";
  return after > before ? "상승 중" : "하강 중";
};

export const getExtrema = (samples: Sample[]) =>
  samples.filter((sample, index) => {
    if (index === 0 || index === samples.length - 1) return false;
    const previous = samples[index - 1].tide;
    const next = samples[index + 1].tide;
    return (
      (sample.tide > previous && sample.tide >= next) ||
      (sample.tide < previous && sample.tide <= next)
    );
  });

export const formatHour = (hour: number) => {
  const normalized = ((hour % 24) + 24) % 24;
  const totalMinutes = Math.round(normalized * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const getSunStatus = (daylight: number) => {
  if (daylight > 0.18) return "낮";
  if (daylight > -0.08) return "박명";
  return "밤";
};

export const normalizedPercent = (value: number) =>
  Math.round(clamp((value + 1) / 2, 0, 1) * 100);
