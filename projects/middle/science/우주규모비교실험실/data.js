export const AU_KM = 149_597_870.7;
export const LIGHT_SPEED_M_S = 299_792_458;
export const MODEL_VERSION = "2026.08.13-edu.1";

// 행성 지름은 JPL 적도 반지름의 2배, 거리는 대표 궤도 장반경이다.
// 달 거리는 지구 중심–달 중심, 프록시마 지름은 관측 반지름으로부터 얻은 추정값이다.
export const BODIES = [
  { id: "sun", name: "태양", short: "태양", parent: null, kind: "star", diameterKm: 1_391_400, diameterKind: "mean", distanceKm: 0, eccentricity: 0 },
  { id: "mercury", name: "수성", short: "수성", parent: "sun", kind: "planet", diameterKm: 4_881.06, diameterKind: "equatorial", distanceKm: 57_909_227, distanceAu: 0.387099, eccentricity: 0.20563 },
  { id: "venus", name: "금성", short: "금성", parent: "sun", kind: "planet", diameterKm: 12_103.6, diameterKind: "equatorial", distanceKm: 108_209_475, distanceAu: 0.723336, eccentricity: 0.00677 },
  { id: "earth", name: "지구", short: "지구", parent: "sun", kind: "planet", diameterKm: 12_756.2732, diameterKind: "equatorial", distanceKm: AU_KM, distanceAu: 1, eccentricity: 0.01671 },
  { id: "moon", name: "달", short: "달", parent: "earth", kind: "moon", diameterKm: 3_474.8, diameterKind: "mean", distanceKm: 384_400, eccentricity: 0.0549 },
  { id: "mars", name: "화성", short: "화성", parent: "sun", kind: "planet", diameterKm: 6_792.38, diameterKind: "equatorial", distanceKm: 227_943_822, distanceAu: 1.523710, eccentricity: 0.0934 },
  { id: "jupiter", name: "목성", short: "목성", parent: "sun", kind: "planet", diameterKm: 142_984, diameterKind: "equatorial", distanceKm: 778_340_817, distanceAu: 5.202887, eccentricity: 0.0489 },
  { id: "saturn", name: "토성", short: "토성", parent: "sun", kind: "planet", diameterKm: 120_536, diameterKind: "equatorial", distanceKm: 1_426_666_414, distanceAu: 9.536676, eccentricity: 0.0565 },
  { id: "uranus", name: "천왕성", short: "천왕성", parent: "sun", kind: "planet", diameterKm: 51_118, diameterKind: "equatorial", distanceKm: 2_870_658_171, distanceAu: 19.189165, eccentricity: 0.0457 },
  { id: "neptune", name: "해왕성", short: "해왕성", parent: "sun", kind: "planet", diameterKm: 49_528, diameterKind: "equatorial", distanceKm: 4_498_396_417, distanceAu: 30.069923, eccentricity: 0.0113 },
  { id: "proxima", name: "프록시마 센타우리", short: "프록시마", parent: "sun", kind: "star", diameterKm: 214_554, diameterKind: "estimated", distanceKm: 4.0174991951814375e13, lightYears: 4.2465, eccentricity: null },
];

export const BODY_BY_ID = Object.fromEntries(BODIES.map((body) => [body.id, body]));

export const VIEW_DEFINITIONS = {
  solar: { id: "solar", label: "운동장 태양계", hint: "태양에서 행성까지를 한 줄의 같은 축척으로 놓습니다.", parent: "sun" },
  moon: { id: "moon", label: "책상 위 지구–달", hint: "달의 크기와 지구–달 거리를 같은 축척으로 비교합니다.", parent: "earth" },
  star: { id: "star", label: "가까운 별까지", hint: "행성계 축척을 프록시마 센타우리까지 끊지 않고 연장합니다.", parent: "sun" },
  log: { id: "log", label: "로그 규모 엘리베이터", hint: "같은 비율 간격을 같은 화면 간격으로 바꾸어 여러 자릿수를 한눈에 봅니다.", parent: "sun" },
};

export const PRESETS = [
  {
    id: "sun-soccer",
    title: "태양이 축구공이라면",
    question: "태양을 22 cm 축구공으로 줄이면 지구는 얼마나 작고, 어디에 놓일까요?",
    view: "solar",
    selected: "earth",
    basis: "diameter",
    referenceId: "sun",
    modelValueM: 0.22,
  },
  {
    id: "earth-bb",
    title: "지구가 6 mm 비비탄이라면",
    question: "지구를 비비탄으로 정하면 태양은 여전히 축구공일까요? 두 비유의 축척 충돌을 검증하세요.",
    view: "solar",
    selected: "sun",
    basis: "diameter",
    referenceId: "earth",
    modelValueM: 0.006,
  },
  {
    id: "neptune-field",
    title: "태양계를 운동장 안에 넣기",
    question: "해왕성을 105 m 운동장 끝에 놓으려면 태양과 지구는 얼마나 작아져야 할까요?",
    view: "solar",
    selected: "neptune",
    basis: "distance",
    referenceId: "neptune",
    modelValueM: 105,
  },
  {
    id: "moon-desk",
    title: "지구–달을 1.2 m 책상에",
    question: "지구와 달 사이를 1.2 m로 줄였을 때 두 천체의 지름을 손가락과 비교해 보세요.",
    view: "moon",
    selected: "moon",
    basis: "distance",
    referenceId: "moon",
    modelValueM: 1.2,
  },
  {
    id: "proxima-road",
    title: "다음 별은 어느 도시 밖일까",
    question: "태양이 22 cm일 때 가장 가까운 별은 운동장, 도시, 나라 중 어디까지 밀려날까요?",
    view: "star",
    selected: "proxima",
    basis: "diameter",
    referenceId: "sun",
    modelValueM: 0.22,
  },
  {
    id: "light-race",
    title: "빛도 기다려야 하는 거리",
    question: "축척 모형에서 빛의 속도까지 같은 비율로 줄이면 지구까지 몇 분이 걸릴까요?",
    view: "solar",
    selected: "earth",
    basis: "diameter",
    referenceId: "sun",
    modelValueM: 0.22,
    playLight: true,
  },
];

export const REFERENCE_OBJECTS = [
  { id: "bb", label: "비비탄 · 6 mm", meters: 0.006 },
  { id: "marble", label: "구슬 · 16 mm", meters: 0.016 },
  { id: "soccer", label: "축구공 · 22 cm", meters: 0.22 },
  { id: "basketball", label: "농구공 · 24 cm", meters: 0.24 },
  { id: "desk", label: "책상 · 1.2 m", meters: 1.2 },
  { id: "field", label: "운동장 · 105 m", meters: 105 },
  { id: "custom", label: "직접 입력", meters: null },
];

export const SOURCES = [
  { label: "JPL 행성 물리량", url: "https://ssd.jpl.nasa.gov/planets/phys_par.html" },
  { label: "JPL 대표 궤도요소", url: "https://ssd.jpl.nasa.gov/planets/approx_pos.html" },
  { label: "JPL 위성 물리량·궤도", url: "https://ssd.jpl.nasa.gov/sats/phys_par/" },
  { label: "JPL 천문 상수", url: "https://ssd.jpl.nasa.gov/astro_par.html" },
  { label: "NASA 태양 사실", url: "https://science.nasa.gov/sun/facts/" },
];

export function getScale({ basis, referenceId, modelValueM }) {
  const reference = BODY_BY_ID[referenceId] ?? BODY_BY_ID.sun;
  const realMeters = basis === "distance"
    ? reference.distanceKm * 1_000
    : reference.diameterKm * 1_000;
  if (!(realMeters > 0) || !(modelValueM > 0)) return 1;
  return modelValueM / realMeters;
}

export function scaledBody(body, scale) {
  const diameterM = body.diameterKm * 1_000 * scale;
  const distanceM = body.distanceKm * 1_000 * scale;
  const lightSeconds = body.distanceKm * 1_000 / LIGHT_SPEED_M_S;
  const periapsisM = body.eccentricity == null ? null : distanceM * (1 - body.eccentricity);
  const apoapsisM = body.eccentricity == null ? null : distanceM * (1 + body.eccentricity);
  return { ...body, diameterM, distanceM, lightSeconds, periapsisM, apoapsisM };
}

export function modelRows(scale) {
  return BODIES.map((body) => scaledBody(body, scale));
}

export function modelLightSpeed(scale) {
  return LIGHT_SPEED_M_S * scale;
}

export function trueRatio(numeratorId, denominatorId, property = "diameterKm") {
  return BODY_BY_ID[numeratorId][property] / BODY_BY_ID[denominatorId][property];
}

export function orbitRange(body) {
  if (body.eccentricity == null) return null;
  return {
    minKm: body.distanceKm * (1 - body.eccentricity),
    maxKm: body.distanceKm * (1 + body.eccentricity),
  };
}

export function formatMetric(valueM, digits = 3) {
  const absolute = Math.abs(valueM);
  const units = [
    { min: 1e9, factor: 1e9, unit: "백만 km" },
    { min: 1e3, factor: 1e3, unit: "km" },
    { min: 1, factor: 1, unit: "m" },
    { min: 1e-2, factor: 1e-2, unit: "cm" },
    { min: 1e-3, factor: 1e-3, unit: "mm" },
    { min: 1e-6, factor: 1e-6, unit: "µm" },
    { min: 0, factor: 1e-9, unit: "nm" },
  ];
  const choice = units.find((item) => absolute >= item.min) ?? units.at(-1);
  const scaled = valueM / choice.factor;
  const shown = Math.abs(scaled) >= 100 ? scaled.toFixed(0) : Math.abs(scaled) >= 10 ? scaled.toFixed(1) : scaled.toFixed(digits);
  return `${Number(shown).toLocaleString("ko-KR")} ${choice.unit}`;
}

export function formatRealDistance(km) {
  if (km >= 9.4607e12) return `${(km / 9.4607e12).toFixed(4)} 광년`;
  if (km >= AU_KM * 0.2) return `${(km / AU_KM).toLocaleString("ko-KR", { maximumFractionDigits: 4 })} AU`;
  return `${km.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} km`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}초`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}분 ${Math.round(seconds % 60)}초`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}시간 ${Math.round((seconds % 3_600) / 60)}분`;
  if (seconds < 31_557_600) return `${(seconds / 86_400).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}일`;
  return `${(seconds / 31_557_600).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}년`;
}

export function formatScale(scale) {
  if (!(scale > 0)) return "—";
  const denominator = 1 / scale;
  return `1 : ${denominator.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
}

export function scaleInvariantReport(state) {
  const scale = getScale(state);
  const rows = Object.fromEntries(modelRows(scale).map((body) => [body.id, body]));
  const earthDiameterDistanceRatio = BODY_BY_ID.earth.distanceKm / BODY_BY_ID.earth.diameterKm;
  const predictionRatio = 10 ** state.predictionExponent;
  const signedOrderError = Math.log10(predictionRatio / earthDiameterDistanceRatio);
  return {
    scale,
    rows,
    earthDiameterDistanceRatio,
    predictionRatio,
    signedOrderError,
    absoluteOrderError: Math.abs(signedOrderError),
    modelLightSpeedMps: modelLightSpeed(scale),
  };
}
