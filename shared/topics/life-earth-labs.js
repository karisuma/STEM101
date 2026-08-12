import { math } from "../lab-runtime.js";

const { clamp, lerp, map, TAU } = math;
const points = (start, end, count, fn) => Array.from({ length: count }, (_, index) => { const x = lerp(start, end, index / Math.max(1, count - 1)); return fn(x, index); });
function rgba(hex, alpha) { const raw = hex.replace("#", ""); const value = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw; const n = Number.parseInt(value, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; }

function simulateEcosystem(v, days = 120) {
  let plants = Number(v.plants); let herbivores = Number(v.herbivores); let predators = Number(v.predators);
  const series = [{ day: 0, plants, herbivores, predators }]; const dt = 0.2;
  for (let step = 1; step <= days / dt; step += 1) {
    const drought = Number(v.drought) / 100; const carrying = 1000 * (1 - drought * 0.72);
    const growth = Number(v.growth) * plants * (1 - plants / Math.max(50, carrying));
    const grazing = Number(v.grazing) * 0.0026 * plants * herbivores;
    const hunting = Number(v.hunting) * 0.0012 * herbivores * predators;
    plants = Math.max(0, plants + (growth - grazing) * dt);
    herbivores = Math.max(0, herbivores + (grazing * 0.16 - hunting - Number(v.harvest) * herbivores / 1000) * dt);
    predators = Math.max(0, predators + (hunting * 0.11 - 0.045 * predators) * dt);
    if (step % 5 === 0) series.push({ day: step * dt, plants, herbivores, predators });
  }
  return series;
}

export const ecologyLab = {
  id: "ecosystem-network-lab",
  title: "생태계·먹이그물 실험실",
  subtitle: "한 종의 증감이 여러 시간지연 경로를 거쳐 군집 전체에 어떻게 번지는지 개체군과 에너지로 읽습니다.",
  theme: { primary: "#10251B", secondary: "#FF806C" },
  duration: 12,
  views: [
    { id: "populations", label: "개체군 변화", hint: "원인 변화 뒤 결과가 즉시가 아니라 시간차를 두고 나타납니다." },
    { id: "web", label: "먹이그물", hint: "화살표는 먹이에서 소비자로 흐르는 물질·에너지 방향입니다." },
    { id: "pyramid", label: "에너지 피라미드", hint: "영양 단계가 오를수록 이용 가능한 에너지가 크게 줄어듭니다." },
    { id: "sandbox", label: "자유 먹이그물", hint: "생물 종을 놓고 먹이→소비자 방향으로 연결해 새로운 생태계를 만듭니다." },
  ],
  variables: [
    { key: "plants", label: "생산자 초기 개체량", shortLabel: "생산자", unit: "상대개체", min: 100, max: 900, step: 25, default: 650, digits: 0 },
    { key: "herbivores", label: "초식동물 초기 개체량", shortLabel: "초식", unit: "상대개체", min: 10, max: 300, step: 10, default: 130, digits: 0 },
    { key: "predators", label: "포식자 초기 개체량", shortLabel: "포식", unit: "상대개체", min: 1, max: 100, step: 2, default: 28, digits: 0 },
    { key: "growth", label: "생산자 증식률", shortLabel: "증식", unit: "/일", min: 0.03, max: 0.35, step: 0.01, default: 0.16, digits: 2 },
    { key: "grazing", label: "초식 섭식 강도", shortLabel: "섭식", unit: "배", min: 0.3, max: 2, step: 0.1, default: 1, digits: 1 },
    { key: "hunting", label: "포식 강도", shortLabel: "포식강도", unit: "배", min: 0.2, max: 2, step: 0.1, default: 1, digits: 1 },
    { key: "drought", label: "가뭄 스트레스", shortLabel: "가뭄", unit: "%", min: 0, max: 80, step: 5, default: 10, digits: 0 },
    { key: "harvest", label: "초식동물 포획 압력", shortLabel: "포획", unit: "상대값", min: 0, max: 40, step: 2, default: 0, digits: 0, depth: "H1" },
  ],
  outputs: [
    { key: "finalPredators", label: "120일 뒤 포식자", shortLabel: "포식자", unit: "상대개체", digits: 1, classMetric: true },
    { key: "finalHerbivores", label: "120일 뒤 초식동물", unit: "상대개체", digits: 1 },
    { key: "finalPlants", label: "120일 뒤 생산자", unit: "상대개체", digits: 1 },
    { key: "diversity", label: "균등도 지수", unit: "0~1", digits: 3 },
    { key: "resilience", label: "회복력 지표", unit: "0~1", digits: 3, depth: "H1" },
  ],
  prediction: { question: "120일 뒤 포식자는 얼마나 남을까?", min: 0, max: 150, step: 5, unit: "상대개체", default: 30, digits: 0 },
  missions: [
    { id: "wolf", title: "늑대가 돌아온 계곡", question: "포식 강도를 올렸을 때 식물은 즉시 늘어날까요? 시간지연과 연쇄 효과를 추적하세요.", preset: { plants: 650, herbivores: 180, predators: 10, growth: 0.16, grazing: 1, hunting: 1.7, drought: 10, harvest: 0 }, view: "populations" },
    { id: "drought", title: "3년 가뭄의 첫 희생자는", question: "생산자 감소가 어느 영양단계에 어떤 순서로 나타나는지 A/B로 비교하세요.", preset: { plants: 700, herbivores: 140, predators: 30, growth: 0.13, grazing: 1, hunting: 1, drought: 60, harvest: 0 }, view: "pyramid" },
    { id: "fishery", title: "잡아도 사라지지 않는 기준", question: "초식성 어류 포획량을 늘려도 포식자와 생산자가 함께 유지되는 범위를 찾으세요.", preset: { plants: 600, herbivores: 200, predators: 35, growth: 0.18, grazing: 1.1, hunting: 0.9, drought: 5, harvest: 12 }, view: "populations" },
    { id: "alien", title: "외래종이 들어온 먹이그물", question: "자유 먹이그물에서 한 종이 너무 많은 자원·포식자와 연결될 때 취약점이 어떻게 바뀌는지 설계하세요.", preset: { plants: 650, herbivores: 130, predators: 28, growth: 0.16, grazing: 1, hunting: 1, drought: 10, harvest: 0 }, view: "sandbox" },
  ],
  theory: [
    { id: "flow", title: "화살표는 에너지의 방향", summary: "먹이그물 화살표는 먹는 동물의 행동 방향이 아니라 먹이에서 소비자로 물질과 에너지가 이동하는 방향입니다.", formula: "생산자 → 1차 소비자 → 2차 소비자", points: ["분해자는 모든 영양단계의 사체와 배설물을 무기물로 되돌립니다.", "한 종은 여러 먹이와 포식자를 가질 수 있어 먹이사슬보다 그물이 현실적입니다."], example: "해달 감소가 성게 증가와 다시마 숲 감소로 이어지는 영양단계 연쇄가 관찰됩니다." },
    { id: "delay", title: "개체군에는 시간지연이 있다", summary: "먹이가 늘어도 포식자가 즉시 늘지 않습니다. 성장과 번식에 시간이 필요해 두 집단의 봉우리가 어긋나고 진동할 수 있습니다.", formula: "변화량 = 출생 + 유입 − 사망 − 유출", points: ["한 시점의 상관관계만으로 원인을 단정하면 지연 효과를 놓칠 수 있습니다.", "환경수용력은 고정된 숫자가 아니라 기후와 서식지에 따라 달라집니다."], depth: "M2" },
    { id: "stability", title: "다양성과 안정성은 단순 동의어가 아니다", summary: "연결이 다양하면 한 자원이 줄 때 대체 경로가 생길 수 있지만, 강한 연결이 너무 많으면 교란이 빠르게 퍼질 수도 있습니다.", formula: "회복력 = 교란 뒤 원래 범위로 돌아오는 능력", points: ["종수, 균등도, 기능 다양성은 서로 다른 다양성 지표입니다.", "이 모형의 세 집단 평균만으로 실제 생태계의 안정성을 판정할 수 없습니다."], depth: "H1" },
  ],
  compute(v, time, view, depth, sandbox) {
    const series = simulateEcosystem(v); const last = series.at(-1); const total = last.plants + last.herbivores + last.predators;
    const proportions = [last.plants, last.herbivores, last.predators].map((value) => value / Math.max(1e-9, total)).filter((value) => value > 0);
    const diversity = -proportions.reduce((sum, value) => sum + value * Math.log(value), 0) / Math.log(3);
    const startTotal = Number(v.plants) + Number(v.herbivores) + Number(v.predators); const resilience = clamp(1 - Math.abs(total - startTotal) / Math.max(startTotal, 1), 0, 1);
    const network = sandbox ? { species: sandbox.items.filter((item) => !["sun"].includes(item.type)).length, links: sandbox.links.length } : null;
    return { finalPredators: last.predators, finalHerbivores: last.herbivores, finalPlants: last.plants, diversity, resilience, series, network };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(52); if (view === "sandbox") return;
    if (view === "populations") {
      const b = { x: 64, y: 60, w: g.width - 120, h: g.height - 135 }; g.axes(b, { x: "일", y: "상대 개체량" }); const maxValue = Math.max(...r.series.flatMap((p) => [p.plants, p.herbivores, p.predators]), 1);
      const make = (key, color, width) => g.polyline(r.series.map((p) => [b.x + p.day / 120 * b.w, b.y + b.h - p[key] / maxValue * b.h]), color, width);
      make("plants", g.accent, 3); make("herbivores", g.ink, 2); make("predators", rgba(g.accent, 0.45), 2);
      g.text("생산자", b.x + 12, b.y + 18, { color: g.accent }); g.text("초식", b.x + 82, b.y + 18, { color: g.ink }); g.text("포식", b.x + 132, b.y + 18, { color: rgba(g.accent, 0.65) }); return;
    }
    if (view === "pyramid") {
      const levels = [{ name: "생산자", energy: r.finalPlants }, { name: "초식동물", energy: r.finalHerbivores }, { name: "포식자", energy: r.finalPredators }]; const max = Math.max(...levels.map((level) => level.energy), 1);
      levels.forEach((level, index) => { const w = map(level.energy / max, 0, 1, 80, g.width * 0.68); const y = g.height - 110 - index * 100; g.rect((g.width - w) / 2, y, w, 72, rgba(g.accent, 0.22 + index * 0.16), g.accent, 2); g.text(`${level.name} · ${level.energy.toFixed(0)}`, g.width / 2, y + 42, { align: "center", color: g.ink, weight: 700 }); }); return;
    }
    const nodes = [{ x: 0.18, y: 0.62, label: "풀", type: "producer" }, { x: 0.43, y: 0.4, label: "토끼", type: "consumer" }, { x: 0.7, y: 0.29, label: "여우", type: "predator" }, { x: 0.72, y: 0.72, label: "분해자", type: "decomposer" }];
    [[0, 1], [1, 2], [0, 3], [1, 3], [2, 3]].forEach(([a, b]) => g.arrow(nodes[a].x * g.width, nodes[a].y * g.height, nodes[b].x * g.width, nodes[b].y * g.height, rgba(g.accent, 0.65), 2));
    nodes.forEach((node) => { g.circle(node.x * g.width, node.y * g.height, 36, rgba(g.accent, 0.14), g.accent, 2); g.text(node.label, node.x * g.width, node.y * g.height + 5, { align: "center", color: g.ink, weight: 700 }); });
  },
  chart(v, r) { const max = Math.max(...r.series.flatMap((p) => [p.plants, p.herbivores, p.predators]), 1); return { xLabel: "시간 (일)", yLabel: "정규화 개체량", yDomain: [0, 1.05], series: [{ points: r.series.map((p) => ({ x: p.day, y: p.plants / max })) }, { points: r.series.map((p) => ({ x: p.day, y: p.herbivores / max })), opacity: 0.58 }, { points: r.series.map((p) => ({ x: p.day, y: p.predators / max })), opacity: 0.34 }] }; },
  caption(r, v, view) { return view === "sandbox" ? `현재 그물은 종 ${r.network?.species || 0}개, 에너지 경로 ${r.network?.links || 0}개입니다.` : `120일 뒤 생산자 ${r.finalPlants.toFixed(0)}, 초식 ${r.finalHerbivores.toFixed(0)}, 포식 ${r.finalPredators.toFixed(0)} · 균등도 ${r.diversity.toFixed(3)}.`; },
  sandbox: {
    view: "sandbox", title: "자유 먹이그물", instructions: "먹이가 되는 종을 먼저, 소비자를 다음에 선택해 화살표를 연결하세요. 태양→생산자, 사체/생물→분해자 경로도 시험할 수 있습니다.",
    parts: [
      { type: "sun", label: "태양", icon: "☼", max: 1 }, { type: "grass", label: "풀", icon: "⌇", max: 3 }, { type: "algae", label: "조류", icon: "≈", max: 3 },
      { type: "rabbit", label: "토끼", icon: "R", max: 3 }, { type: "insect", label: "곤충", icon: "i", max: 4 }, { type: "frog", label: "개구리", icon: "F", max: 3 },
      { type: "fox", label: "여우", icon: "X", max: 3 }, { type: "hawk", label: "매", icon: "H", max: 3 }, { type: "decomposer", label: "분해자", icon: "D", max: 2 },
    ],
    initial: [{ type: "sun", x: 0.18, y: 0.24 }, { type: "grass", x: 0.3, y: 0.62 }, { type: "rabbit", x: 0.5, y: 0.47 }, { type: "fox", x: 0.7, y: 0.3 }, { type: "decomposer", x: 0.72, y: 0.7 }],
    canLink(from, to) { return from?.id !== to?.id && to?.type !== "sun"; },
    evaluate(sandbox) { const producers = sandbox.items.filter((item) => ["grass", "algae"].includes(item.type)); const consumers = sandbox.items.filter((item) => !["sun", "grass", "algae"].includes(item.type)); const connected = new Set(sandbox.links.flatMap((link) => [link.from, link.to])); const isolated = sandbox.items.filter((item) => item.type !== "sun" && !connected.has(item.id)).length; return { valid: producers.length > 0 && consumers.length > 0 && isolated === 0, summary: isolated ? `고립된 종 ${isolated}개 · 에너지 경로를 연결하세요.` : `종 ${sandbox.items.length - sandbox.items.filter((item) => item.type === "sun").length}개 · 경로 ${sandbox.links.length}개` }; },
    draw(g, sandbox, result, time, ui) { const byId = new Map(sandbox.items.map((item) => [item.id, item])); sandbox.links.forEach((link) => { const a = byId.get(link.from); const b = byId.get(link.to); if (a && b) g.arrow(a.x * g.width, a.y * g.height, b.x * g.width, b.y * g.height, rgba(g.accent, 0.75), 2, 9); }); sandbox.items.forEach((item) => { const x = item.x * g.width; const y = item.y * g.height; const selected = item.id === ui.selected; const producer = ["grass", "algae"].includes(item.type); g.circle(x, y, 30, rgba(g.accent, producer ? 0.25 : 0.1), selected ? g.ink : g.accent, selected ? 4 : 2); g.text(item.label, x, y + 5, { align: "center", color: g.ink, weight: 700, size: 11 }); }); },
  },
  limit: "세 집단의 평균적인 Lotka–Volterra형 관계를 사용합니다. 연령구조, 공간 이동, 유전적 적응, 질병, 계절성과 실제 종별 매개변수는 생략되므로 특정 지역의 관리 수치를 예측하는 도구가 아닙니다.",
};

export const moonLab = {
  id: "moon-phase-lab",
  title: "달의 위상·관측 시각 실험실",
  subtitle: "달의 밝은 부분, 지구에서 보이는 모양, 뜨고 지는 시각과 식 조건을 하나의 공간 배치로 연결합니다.",
  theme: { primary: "#12172B", secondary: "#C2D7FF" },
  duration: 12,
  views: [
    { id: "space", label: "우주에서", hint: "달의 절반은 거의 항상 태양빛을 받고 관측 방향만 바뀝니다." },
    { id: "observer", label: "지구 관측자", hint: "보이는 밝은 반구의 비율이 위상을 만듭니다." },
    { id: "sky", label: "하루 하늘", hint: "위상에 따라 태양과의 각거리가 달라져 뜨는 시각도 달라집니다." },
  ],
  variables: [
    { key: "age", label: "삭 이후 날짜", shortLabel: "달나이", unit: "일", min: 0, max: 29.5, step: 0.5, default: 7.5, digits: 1 },
    { key: "latitude", label: "관측자 위도", shortLabel: "위도", unit: "°", min: -60, max: 60, step: 5, default: 37.5, digits: 1 },
    { key: "inclination", label: "달 궤도 기울기", shortLabel: "궤도경사", unit: "°", min: 0, max: 10, step: 0.5, default: 5.1, digits: 1 },
    { key: "nodeOffset", label: "교점과의 각거리", shortLabel: "교점거리", unit: "°", min: -30, max: 30, step: 1, default: 12, digits: 0, depth: "H1" },
    { key: "distance", label: "달 거리", unit: "천 km", min: 356, max: 406, step: 2, default: 384, digits: 0, depth: "H1" },
  ],
  outputs: [
    { key: "illumination", label: "밝게 보이는 비율", shortLabel: "밝기비", unit: "%", digits: 1, classMetric: true },
    { key: "elongation", label: "태양과의 각거리", unit: "°", digits: 1 },
    { key: "riseTime", label: "대략 뜨는 시각", unit: "시", digits: 1 },
    { key: "angularSize", label: "겉보기 지름", unit: "′", digits: 1 },
    { key: "eclipseChance", label: "식 정렬도", unit: "%", digits: 1, depth: "H1" },
  ],
  prediction: { question: "달의 몇 %가 밝게 보일까?", min: 0, max: 100, step: 5, unit: "%", default: 50, digits: 0 },
  missions: [
    { id: "evening", title: "저녁 8시에 보이는 달", question: "저녁 8시 남쪽 하늘에서 오래 보일 가능성이 큰 위상과 달나이를 찾으세요.", preset: { age: 7.5, latitude: 37.5, inclination: 5.1, nodeOffset: 12, distance: 384 }, view: "sky" },
    { id: "dark", title: "초승달의 어두운 면도 보인다", question: "지구조가 없다는 모형의 한계를 구분하며 밝은 부분 방향을 설명하세요.", preset: { age: 2, latitude: 37.5, inclination: 5.1, nodeOffset: 15, distance: 384 }, view: "observer" },
    { id: "eclipse", title: "보름마다 월식이 아닌 이유", question: "보름 조건과 궤도 교점 조건을 각각 바꾸어 월식 정렬도를 비교하세요.", preset: { age: 14.75, latitude: 37.5, inclination: 5.1, nodeOffset: 18, distance: 384 }, view: "space" },
    { id: "supermoon", title: "슈퍼문은 얼마나 커 보일까", question: "근지점과 원지점의 겉보기 지름 비율을 A/B로 구해 체감과 수치를 비교하세요.", preset: { age: 14.75, latitude: 37.5, inclination: 5.1, nodeOffset: 3, distance: 356 }, view: "observer" },
  ],
  theory: [
    { id: "half", title: "달의 절반은 늘 밝다", summary: "태양은 달의 한쪽 반구를 비춥니다. 달이 스스로 모양을 바꾸는 것이 아니라 지구에서 그 밝은 반구를 보는 비율이 변합니다.", formula: "밝게 보이는 비율 = (1 − cos ε)/2", points: ["삭에서 달의 밝은 쪽은 지구 반대 방향이라 거의 보이지 않습니다.", "보름에서 지구는 달의 밝은 반구 쪽을 바라봅니다."], example: "공 하나와 손전등만으로도 관측자 위치를 고정해 위상 변화를 재현할 수 있습니다." },
    { id: "time", title: "위상은 관측 시각표다", summary: "태양과 달의 각거리는 두 천체가 하늘에서 몇 시간 떨어져 움직이는지 알려줍니다. 15°가 약 1시간입니다.", formula: "뜨는 시각 ≈ 6시 + ε/15°", points: ["상현달은 정오 무렵 떠서 저녁에 높고, 보름달은 해 질 무렵 뜹니다.", "실제 시각은 계절·위도·궤도 기울기로 달라집니다."], depth: "M2" },
    { id: "eclipse", title: "식에는 교점 정렬이 더 필요하다", summary: "달 궤도면이 지구 공전면에 약 5° 기울어 매달 삭·보름 때 대부분 위나 아래로 빗나갑니다.", formula: "삭/보름 조건 + 궤도 교점 근처 = 일식/월식 가능", points: ["위상 정렬과 궤도면 정렬은 서로 다른 조건입니다.", "식의 실제 경로는 달 거리와 지구 그림자 크기도 좌우합니다."], depth: "H1" },
  ],
  compute(v, time) {
    const phase = Number(v.age) / 29.5 * TAU; const elongation = Number(v.age) / 29.5 * 360; const illumination = (1 - Math.cos(phase)) / 2 * 100;
    const riseTime = (6 + elongation / 15) % 24; const angularSize = 31.1 * 384 / Number(v.distance);
    const phaseAlignment = Math.max(Math.cos(phase) ** 8, 0); const nodeAlignment = Math.exp(-((Number(v.nodeOffset) / Math.max(1, 5 + Number(v.inclination))) ** 2)); const eclipseChance = phaseAlignment * nodeAlignment * 100;
    const phaseName = illumination < 3 ? "삭" : Number(v.age) < 7.4 ? "초승" : Number(v.age) < 8.2 ? "상현" : Number(v.age) < 14.3 ? "차는 달" : Number(v.age) < 15.2 ? "보름" : Number(v.age) < 22 ? "기우는 달" : Number(v.age) < 23 ? "하현" : "그믐";
    return { phase, elongation, illumination, riseTime, angularSize, eclipseChance, phaseName };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(52);
    if (view === "space") {
      const earthX = g.width * 0.5; const earthY = g.height * 0.52; const orbitR = Math.min(g.width, g.height) * 0.31; const moonX = earthX + Math.cos(r.phase + Math.PI) * orbitR; const moonY = earthY + Math.sin(r.phase + Math.PI) * orbitR * 0.55;
      g.circle(earthX, earthY, 46, rgba(g.accent, 0.18), g.accent, 2); g.circle(earthX, earthY, orbitR, null, rgba(g.ink, 0.18), 1); g.circle(moonX, moonY, 18, g.ink, g.accent, 2);
      for (let y = 80; y < g.height - 70; y += 45) g.arrow(40, y, 125, y, g.accent, 2); g.text("태양빛", 40, 54, { color: g.accent });
      g.line(earthX, earthY, moonX, moonY, g.muted, 1, [5, 5]); g.text(r.phaseName, moonX, moonY - 28, { align: "center", color: g.accent, weight: 700 }); return;
    }
    if (view === "sky") {
      const horizon = g.height * 0.78; g.line(35, horizon, g.width - 35, horizon, g.ink, 2); const hour = (time / 12 * 24 + 6) % 24; const moonHourAngle = (hour - r.riseTime) / 12 * Math.PI; const altitude = Math.sin(clamp(moonHourAngle, 0, Math.PI)) * g.height * 0.55; const x = map(clamp(moonHourAngle, 0, Math.PI), 0, Math.PI, 55, g.width - 55); const y = horizon - altitude;
      g.polyline(points(0, Math.PI, 80, (a) => [map(a, 0, Math.PI, 55, g.width - 55), horizon - Math.sin(a) * g.height * 0.55]), rgba(g.ink, 0.22), 1); g.circle(x, y, 24, g.ink, g.accent, 2); g.text(`${hour.toFixed(1)}시`, x, y - 36, { align: "center", color: g.accent }); g.text(`뜨는 시각 ≈ ${r.riseTime.toFixed(1)}시`, g.width / 2, horizon + 38, { align: "center", color: g.ink }); return;
    }
    const cx = g.width / 2; const cy = g.height * 0.5; const radius = Math.min(g.width, g.height) * 0.25; g.circle(cx, cy, radius, g.ink, g.accent, 2);
    const litWidth = radius * 2 * r.illumination / 100; g.ctx.save(); g.ctx.beginPath(); g.ctx.arc(cx, cy, radius, 0, TAU); g.ctx.clip(); g.ctx.fillStyle = g.accent; g.ctx.fillRect(r.phase < Math.PI ? cx + radius - litWidth : cx - radius, cy - radius, litWidth, radius * 2); g.ctx.restore(); g.text(`${r.phaseName} · ${r.illumination.toFixed(1)}%`, cx, cy + radius + 40, { align: "center", color: g.accent, size: 19, weight: 700 });
  },
  chart(v) { return { xLabel: "삭 이후 날짜", yLabel: "밝게 보이는 비율 (%)", xDomain: [0, 29.5], yDomain: [0, 100], series: [{ points: points(0, 29.5, 120, (age) => ({ x: age, y: (1 - Math.cos(age / 29.5 * TAU)) / 2 * 100 })) }] }; },
  caption(r) { return `${r.phaseName} · 태양과 ${r.elongation.toFixed(1)}° 떨어져 있고 약 ${r.riseTime.toFixed(1)}시에 뜹니다. 밝은 비율은 ${r.illumination.toFixed(1)}%입니다.`; },
  limit: "원궤도와 평균 삭망월을 사용한 개념 모형입니다. 실제 달의 적경·적위, 대기 굴절, 지형, 시간대와 정확한 식 경로 계산은 포함하지 않습니다.",
};

function genotypeGametes(genotype) { return genotype === "AA" ? ["A"] : genotype === "aa" ? ["a"] : ["A", "a"]; }

export const geneticsLab = {
  id: "genetics-meiosis-lab",
  title: "유전·감수분열·표본 실험실",
  subtitle: "부모의 대립유전자가 생식세포로 분리되고, 확률이 실제 자손 표본에서 흔들리는 과정을 추적합니다.",
  theme: { primary: "#14231D", secondary: "#79E0A8" },
  duration: 8,
  views: [
    { id: "punnett", label: "교배 격자", hint: "각 칸은 가능한 수정 사건이며 실제 한 가족이 네 칸을 하나씩 낳는다는 뜻이 아닙니다." },
    { id: "meiosis", label: "감수분열", hint: "한 쌍의 대립유전자가 서로 다른 생식세포로 분리됩니다." },
    { id: "samples", label: "자손 표본", hint: "확률은 장기 비율이며 작은 표본은 예측 비율과 다를 수 있습니다." },
    { id: "sandbox", label: "자유 가계도", hint: "유전자형 개체를 놓고 부모→자손 관계를 연결해 가능한 가계를 검사합니다." },
  ],
  variables: [
    { key: "parent1", label: "부모 1 유전자형", shortLabel: "부모1", default: "Aa", options: [{ value: "AA", label: "AA" }, { value: "Aa", label: "Aa" }, { value: "aa", label: "aa" }] },
    { key: "parent2", label: "부모 2 유전자형", shortLabel: "부모2", default: "Aa", options: [{ value: "AA", label: "AA" }, { value: "Aa", label: "Aa" }, { value: "aa", label: "aa" }] },
    { key: "inheritance", label: "표현형 규칙", shortLabel: "유전양식", default: "dominant", options: [{ value: "dominant", label: "A 완전 우성" }, { value: "incomplete", label: "불완전 우성" }, { value: "codominant", label: "공동 우성" }] },
    { key: "offspring", label: "관찰 자손 수", shortLabel: "표본수", unit: "명", min: 4, max: 400, step: 4, default: 40, digits: 0 },
    { key: "seed", label: "표본 추첨 번호", shortLabel: "추첨", unit: "", min: 1, max: 99, step: 1, default: 17, digits: 0 },
    { key: "mutation", label: "생식세포 돌연변이율", shortLabel: "돌연변이", unit: "%", min: 0, max: 10, step: 0.5, default: 0, digits: 1, depth: "H2" },
  ],
  outputs: [
    { key: "recessiveProbability", label: "aa 이론 확률", shortLabel: "aa확률", unit: "%", digits: 1, classMetric: true },
    { key: "observedRecessive", label: "표본의 aa 비율", unit: "%", digits: 1 },
    { key: "heterozygous", label: "Aa 이론 확률", unit: "%", digits: 1 },
    { key: "samplingError", label: "aa 표본 오차", unit: "%p", digits: 1 },
    { key: "standardError", label: "예상 표준오차", unit: "%p", digits: 2, depth: "H1" },
  ],
  prediction: { question: "aa 자손은 몇 %일까?", min: 0, max: 100, step: 5, unit: "%", default: 25, digits: 0 },
  missions: [
    { id: "siblings", title: "같은 부모, 다른 형제 비율", question: "Aa×Aa 가족의 자녀가 4명일 때 매번 정확히 1명이 aa일까요? 추첨 번호를 바꾸세요.", preset: { parent1: "Aa", parent2: "Aa", inheritance: "dominant", offspring: 4, seed: 17, mutation: 0 }, view: "samples" },
    { id: "carrier", title: "보인자 확률 추적", question: "열성 표현형이 아닌 자손 중 Aa 보인자일 조건부 확률을 격자에서 설명하세요.", preset: { parent1: "Aa", parent2: "Aa", inheritance: "dominant", offspring: 100, seed: 31, mutation: 0 }, view: "punnett" },
    { id: "flower", title: "분홍 꽃의 자손", question: "불완전 우성에서는 Aa가 별도 표현형일 때 1:2:1이 어떻게 보이는지 비교하세요.", preset: { parent1: "Aa", parent2: "Aa", inheritance: "incomplete", offspring: 80, seed: 42, mutation: 0 }, view: "samples" },
    { id: "pedigree", title: "모순 없는 가계도 만들기", question: "aa 자녀가 가능한 부모 조합과 불가능한 조합을 자유 가계도에서 만들어 검사하세요.", preset: { parent1: "Aa", parent2: "Aa", inheritance: "dominant", offspring: 40, seed: 17, mutation: 0 }, view: "sandbox" },
  ],
  theory: [
    { id: "segregation", title: "대립유전자의 분리", summary: "한 개체의 상동염색체에 있는 두 대립유전자는 감수분열 때 갈라져 각각 다른 생식세포에 들어갑니다.", formula: "Aa → A 생식세포 1/2 + a 생식세포 1/2", points: ["퍼넷 격자는 각 부모 생식세포 확률을 곱한 가능한 수정 사건입니다.", "자손의 각 출생은 앞선 형제의 유전자형과 독립이라고 보는 기본 모형입니다."], example: "동전 두 개 결과와 마찬가지로 4번 시행에서 매번 1:2:1이 정확히 나오지는 않습니다." },
    { id: "phenotype", title: "유전자형과 표현형은 다르다", summary: "완전 우성에서는 AA와 Aa가 같은 표현형일 수 있지만 유전자형과 다음 세대 전달 확률은 다릅니다.", formula: "유전자형 → 환경과 상호작용 → 표현형", points: ["우성은 더 흔하거나 더 좋은 형질이라는 뜻이 아닙니다.", "불완전 우성·공동 우성·다유전자 형질은 단순 우열 규칙을 확장합니다."], depth: "M2" },
    { id: "sample", title: "확률과 실제 표본의 흔들림", summary: "이론 확률 p가 같아도 n명이 만드는 관측 비율은 표본마다 다릅니다. 표본 수가 커지면 흔들림의 전형적 크기가 줄어듭니다.", formula: "비율의 표준오차 ≈ √(p(1−p)/n)", points: ["작은 가족의 결과가 이론비와 다르다고 멘델 법칙이 틀린 것은 아닙니다.", "실제 유전 연구는 생존 편향, 연관, 침투도와 모집단 구조도 고려합니다."], depth: "H1" },
  ],
  compute(v, time, view, depth, sandbox) {
    const g1 = genotypeGametes(v.parent1); const g2 = genotypeGametes(v.parent2); const combos = g1.flatMap((a) => g2.map((b) => [a, b].sort((x, y) => y.localeCompare(x)).join("")));
    const probabilities = { AA: 0, Aa: 0, aa: 0 }; combos.forEach((genotype) => { probabilities[genotype] += 1 / combos.length; });
    const random = math.seeded(Number(v.seed) * 997 + Number(v.offspring)); const observed = { AA: 0, Aa: 0, aa: 0 };
    for (let i = 0; i < Number(v.offspring); i += 1) { const value = random(); const genotype = value < probabilities.AA ? "AA" : value < probabilities.AA + probabilities.Aa ? "Aa" : "aa"; observed[genotype] += 1; }
    const observedRecessive = observed.aa / Number(v.offspring) * 100; const recessiveProbability = probabilities.aa * 100; const standardError = Math.sqrt(probabilities.aa * (1 - probabilities.aa) / Number(v.offspring)) * 100;
    let pedigreeViolations = 0; if (sandbox) { const byId = new Map(sandbox.items.map((item) => [item.id, item])); sandbox.items.forEach((child) => { const parents = sandbox.links.filter((link) => link.to === child.id).map((link) => byId.get(link.from)).filter(Boolean); if (parents.length >= 2) { const possible = genotypeGametes(parents[0].genotype).flatMap((a) => genotypeGametes(parents[1].genotype).map((b) => [a, b].sort((x, y) => y.localeCompare(x)).join(""))); if (!possible.includes(child.genotype)) pedigreeViolations += 1; } }); }
    return { recessiveProbability, observedRecessive, heterozygous: probabilities.Aa * 100, samplingError: observedRecessive - recessiveProbability, standardError, probabilities, observed, combos, pedigreeViolations };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(50); if (view === "sandbox") return;
    if (view === "punnett") {
      const size = Math.min(280, g.height * 0.56); const x = (g.width - size) / 2; const y = (g.height - size) / 2; const cell = size / 2; const g1 = genotypeGametes(v.parent1); const g2 = genotypeGametes(v.parent2);
      for (let row = 0; row < 2; row += 1) for (let col = 0; col < 2; col += 1) { const a = g1[col % g1.length]; const b = g2[row % g2.length]; const genotype = [a, b].sort((m, n) => n.localeCompare(m)).join(""); g.rect(x + col * cell, y + row * cell, cell, cell, rgba(g.accent, genotype === "aa" ? 0.36 : genotype === "Aa" ? 0.2 : 0.08), g.accent, 1); g.text(genotype, x + (col + 0.5) * cell, y + (row + 0.5) * cell + 8, { align: "center", color: g.ink, size: 25, weight: 800 }); }
      [0, 1].forEach((i) => { g.text(g1[i % g1.length], x + (i + 0.5) * cell, y - 20, { align: "center", color: g.accent }); g.text(g2[i % g2.length], x - 25, y + (i + 0.5) * cell + 5, { align: "center", color: g.accent }); }); return;
    }
    if (view === "meiosis") {
      const cx = g.width / 2; const cy = g.height / 2; g.circle(cx, cy - 120, 70, rgba(g.accent, 0.08), g.accent, 2); g.text(v.parent1, cx, cy - 112, { align: "center", color: g.ink, size: 24, weight: 800 });
      const gametes = genotypeGametes(v.parent1); [-1, 1].forEach((side, i) => { g.arrow(cx, cy - 45, cx + side * 150, cy + 90, g.accent, 2); g.circle(cx + side * 150, cy + 115, 52, rgba(g.accent, 0.15), g.accent, 2); g.text(gametes[i % gametes.length], cx + side * 150, cy + 123, { align: "center", color: g.ink, size: 25, weight: 800 }); }); return;
    }
    const total = Number(v.offspring); const columns = Math.ceil(Math.sqrt(total)); const gap = Math.min(23, (g.width - 100) / columns); const startX = (g.width - (columns - 1) * gap) / 2; const random = math.seeded(Number(v.seed) * 997 + total);
    for (let i = 0; i < total; i += 1) { const value = random(); const genotype = value < r.probabilities.AA ? "AA" : value < r.probabilities.AA + r.probabilities.Aa ? "Aa" : "aa"; const x = startX + (i % columns) * gap; const y = 85 + Math.floor(i / columns) * gap; g.circle(x, y, Math.max(3, gap * 0.3), genotype === "aa" ? g.accent : genotype === "Aa" ? rgba(g.accent, 0.5) : g.ink); }
    g.text(`표본 aa ${r.observedRecessive.toFixed(1)}% · 이론 ${r.recessiveProbability.toFixed(1)}%`, g.width / 2, g.height - 40, { align: "center", color: g.accent, size: 17, weight: 700 });
  },
  chart(v, r) { return { xLabel: "유전자형 (AA, Aa, aa)", yLabel: "비율 (%)", xDomain: [0, 4], yDomain: [0, 100], series: [{ type: "bars", points: [{ x: 1, y: r.observed.AA / Number(v.offspring) * 100 }, { x: 2, y: r.observed.Aa / Number(v.offspring) * 100 }, { x: 3, y: r.observed.aa / Number(v.offspring) * 100 }] }, { type: "scatter", points: [{ x: 1, y: r.probabilities.AA * 100 }, { x: 2, y: r.probabilities.Aa * 100 }, { x: 3, y: r.probabilities.aa * 100 }], radius: 5 }] }; },
  caption(r, v, view) { return view === "sandbox" ? `가계도 유전 규칙 위반 ${r.pedigreeViolations}건. 연결 방향은 부모에서 자손입니다.` : `aa 이론 확률 ${r.recessiveProbability.toFixed(1)}%, ${v.offspring}명 표본에서는 ${r.observedRecessive.toFixed(1)}% · 오차 ${r.samplingError.toFixed(1)}%p.`; },
  sandbox: {
    view: "sandbox", title: "자유 가계도", instructions: "부모를 먼저, 자손을 다음에 선택해 연결하세요. 자손에 부모 두 명이 연결되면 그 유전자형이 가능한지 검사합니다.",
    parts: [{ type: "AA", label: "AA 개체", icon: "AA", max: 12, defaults: { genotype: "AA" } }, { type: "Aa", label: "Aa 개체", icon: "Aa", max: 12, defaults: { genotype: "Aa" } }, { type: "aa", label: "aa 개체", icon: "aa", max: 12, defaults: { genotype: "aa" } }],
    initial: [{ type: "Aa", genotype: "Aa", x: 0.35, y: 0.32 }, { type: "Aa", genotype: "Aa", x: 0.65, y: 0.32 }, { type: "aa", genotype: "aa", x: 0.5, y: 0.68 }],
    canLink(from, to, sandbox) { return from?.id !== to?.id && sandbox.links.filter((link) => link.to === to.id).length < 2; },
    evaluate(sandbox) { const children = new Set(sandbox.links.map((link) => link.to)); const complete = [...children].filter((id) => sandbox.links.filter((link) => link.to === id).length === 2).length; return { valid: complete > 0, summary: complete ? `부모가 둘 연결된 자손 ${complete}명 · 실행 결과에서 모순 검사` : "자손 한 명에 부모 두 명을 연결하세요." }; },
    draw(g, sandbox, result, time, ui) { const byId = new Map(sandbox.items.map((item) => [item.id, item])); sandbox.links.forEach((link) => { const a = byId.get(link.from); const b = byId.get(link.to); if (a && b) g.arrow(a.x * g.width, a.y * g.height, b.x * g.width, b.y * g.height, rgba(g.accent, 0.6), 2); }); sandbox.items.forEach((item) => { const x = item.x * g.width; const y = item.y * g.height; const selected = item.id === ui.selected; g.rect(x - 28, y - 28, 56, 56, rgba(g.accent, item.genotype === "aa" ? 0.32 : 0.1), selected ? g.ink : g.accent, selected ? 4 : 2); g.text(item.genotype, x, y + 6, { align: "center", color: g.ink, weight: 800, size: 16 }); }); g.text(result.pedigreeViolations ? `유전 규칙 모순 ${result.pedigreeViolations}건` : "현재 검사된 관계에 모순 없음", g.width / 2, g.height - 40, { align: "center", color: result.pedigreeViolations ? g.ink : g.accent, size: 15, weight: 700 }); },
  },
  limit: "단일 유전자좌, 이배체, 무작위 수정과 완전한 생존을 기본 가정으로 둡니다. 연관·교차·침투도·후성유전·다유전자·환경 효과와 실제 가족의 개인정보는 다루지 않습니다.",
};

export const seasonsLab = {
  id: "seasons-solar-altitude-lab",
  title: "계절·태양고도·일조 실험실",
  subtitle: "지구-태양 거리가 아니라 자전축 기울기가 태양고도와 낮 길이를 함께 바꾸는 과정을 검증합니다.",
  theme: { primary: "#1C2133", secondary: "#FFBF69" },
  duration: 12,
  views: [
    { id: "globe", label: "지구 기울기", hint: "자전축은 공전 중 거의 같은 공간 방향을 유지합니다." },
    { id: "sunpath", label: "하루 태양길", hint: "태양고도와 지평선 위 경로 길이가 들어오는 에너지를 함께 바꿉니다." },
    { id: "orbit", label: "공전궤도", hint: "거리 효과와 자전축 기울기 효과를 분리해 비교합니다." },
  ],
  variables: [
    { key: "day", label: "연중 날짜 번호", shortLabel: "날짜", unit: "일", min: 1, max: 365, step: 1, default: 172, digits: 0 },
    { key: "latitude", label: "관측 위도", shortLabel: "위도", unit: "°", min: -66, max: 66, step: 1, default: 37, digits: 0 },
    { key: "tilt", label: "자전축 기울기", shortLabel: "기울기", unit: "°", min: 0, max: 35, step: 0.5, default: 23.5, digits: 1 },
    { key: "eccentricity", label: "궤도 이심률", shortLabel: "이심률", unit: "", min: 0, max: 0.08, step: 0.005, default: 0.0167, digits: 3, depth: "H1" },
    { key: "albedo", label: "지표 반사율", shortLabel: "반사율", unit: "%", min: 5, max: 80, step: 5, default: 30, digits: 0, depth: "H1" },
  ],
  outputs: [
    { key: "noonAltitude", label: "정오 태양고도", shortLabel: "태양고도", unit: "°", digits: 1, classMetric: true },
    { key: "dayLength", label: "낮 길이", unit: "h", digits: 2 },
    { key: "declination", label: "태양 적위", unit: "°", digits: 1 },
    { key: "relativeEnergy", label: "하루 상대 일사량", unit: "%", digits: 1 },
    { key: "distance", label: "태양 거리", unit: "AU", digits: 4, depth: "H1" },
  ],
  prediction: { question: "정오 태양고도는 몇 도일까?", min: 0, max: 90, step: 5, unit: "°", default: 75, digits: 0 },
  missions: [
    { id: "summer", title: "여름이 더운 두 가지 이유", question: "서울 여름에는 태양고도와 낮 길이가 동시에 어떻게 바뀌는지 겨울과 A/B 비교하세요.", preset: { day: 172, latitude: 37, tilt: 23.5, eccentricity: 0.0167, albedo: 30 }, view: "sunpath" },
    { id: "distance", title: "태양이 가까워서 여름일까", question: "북반구가 태양에 더 가까운 1월에도 겨울인 사실을 거리·기울기 효과로 분리하세요.", preset: { day: 3, latitude: 37, tilt: 23.5, eccentricity: 0.0167, albedo: 30 }, view: "orbit" },
    { id: "noTilt", title: "기울기 0° 지구", question: "자전축을 세우면 모든 위도에서 계절과 낮 길이는 어떻게 달라질까요?", preset: { day: 172, latitude: 50, tilt: 0, eccentricity: 0.0167, albedo: 30 }, view: "globe" },
    { id: "hemisphere", title: "두 반구의 계절 바꾸기", question: "같은 날짜 +37°와 −37°의 태양고도·낮 길이를 학급 표본으로 비교하세요.", preset: { day: 172, latitude: -37, tilt: 23.5, eccentricity: 0.0167, albedo: 30 }, view: "sunpath" },
  ],
  theory: [
    { id: "tilt", title: "축이 같은 방향을 가리킨다", summary: "지구 자전축은 공전하는 동안 거의 같은 별 방향을 가리킵니다. 어느 반구가 태양 쪽으로 기울어졌는지가 계절을 정합니다.", formula: "태양 적위 δ ≈ ε sin(연주기 위상)", points: ["두 반구의 계절은 반대입니다.", "기울기 0°라면 거리 효과만 남고 현재와 같은 강한 계절은 없습니다."], example: "북반구 여름에는 북극 쪽이 태양을 향해 기울어 백야 영역이 생깁니다." },
    { id: "angle", title: "같은 빛이 퍼지는 면적", summary: "태양고도가 낮으면 같은 광선 묶음이 더 넓은 지면에 퍼지고 대기를 더 길게 통과합니다. 낮 길이도 짧아 하루 에너지 합이 줄어듭니다.", formula: "정오고도 h = 90° − |위도 φ − 적위 δ|", points: ["고도 효과와 일조시간 효과가 같은 방향으로 작용합니다.", "정오고도가 가장 높은 날과 기온이 가장 높은 날은 열용량 때문에 일치하지 않습니다."], depth: "M2" },
    { id: "orbit", title: "거리 효과는 역제곱", summary: "받는 복사 에너지는 태양 거리 제곱에 반비례하지만 현재 지구의 이심률은 작고 두 반구 계절을 설명하지 못합니다.", formula: "복사 세기 ∝ 1/r²", points: ["지구는 현재 1월 초 근일점, 7월 초 원일점에 가깝습니다.", "반사율·구름·해류·육지와 바다의 열용량이 실제 지역 기후를 크게 바꿉니다."], depth: "H1" },
  ],
  compute(v, time) {
    const phase = TAU * (Number(v.day) - 80) / 365; const declination = Number(v.tilt) * Math.sin(phase); const latitude = Number(v.latitude); const noonAltitude = clamp(90 - Math.abs(latitude - declination), 0, 90);
    const latRad = latitude * Math.PI / 180; const decRad = declination * Math.PI / 180; const cosH = clamp(-Math.tan(latRad) * Math.tan(decRad), -1, 1); const hourAngle = Math.acos(cosH); const dayLength = 24 * hourAngle / Math.PI;
    const eccentricity = Number(v.eccentricity); const distance = (1 - eccentricity ** 2) / (1 + eccentricity * Math.cos(TAU * (Number(v.day) - 3) / 365)); const solarFactor = 1 / distance ** 2;
    const relativeEnergy = clamp(Math.sin(noonAltitude * Math.PI / 180) * dayLength / 12 * solarFactor * (1 - Number(v.albedo) / 100) / 0.7 * 100, 0, 180);
    return { phase, declination, noonAltitude, dayLength, distance, relativeEnergy, hourAngle };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(52);
    if (view === "sunpath") {
      const horizon = g.height * 0.8; g.line(45, horizon, g.width - 45, horizon, g.ink, 2); const maxAlt = r.noonAltitude; const path = points(0, Math.PI, 100, (a) => [map(a, 0, Math.PI, 55, g.width - 55), horizon - Math.sin(a) * map(maxAlt, 0, 90, 10, g.height * 0.65)]); g.polyline(path, g.accent, 3);
      const a = clamp(time / 12, 0, 1) * Math.PI; const x = map(a, 0, Math.PI, 55, g.width - 55); const y = horizon - Math.sin(a) * map(maxAlt, 0, 90, 10, g.height * 0.65); g.circle(x, y, 18, g.accent); g.text(`정오 ${maxAlt.toFixed(1)}°`, g.width / 2, horizon - map(maxAlt, 0, 90, 10, g.height * 0.65) - 18, { align: "center", color: g.accent }); g.text(`낮 ${r.dayLength.toFixed(2)} h`, g.width / 2, horizon + 38, { align: "center", color: g.ink, size: 15 }); return;
    }
    if (view === "orbit") {
      const sunX = g.width * 0.5; const sunY = g.height * 0.5; const a = Math.min(g.width * 0.35, g.height * 0.36); const b = a * Math.sqrt(1 - Number(v.eccentricity) ** 2); g.circle(sunX, sunY, 28, g.accent); g.ctx.save(); g.ctx.strokeStyle = rgba(g.ink, 0.35); g.ctx.beginPath(); g.ctx.ellipse(sunX, sunY, a, b, 0, 0, TAU); g.ctx.stroke(); g.ctx.restore(); const angle = TAU * (Number(v.day) - 3) / 365; const x = sunX + a * Math.cos(angle); const y = sunY + b * Math.sin(angle); g.circle(x, y, 16, g.ink, g.accent, 2); g.line(x, y - 32, x + Math.sin(Number(v.tilt) * Math.PI / 180) * 60, y + 32, g.accent, 3); g.text(`${r.distance.toFixed(4)} AU`, x, y + 48, { align: "center", color: g.accent }); return;
    }
    const cx = g.width * 0.55; const cy = g.height * 0.52; const radius = Math.min(g.width, g.height) * 0.24; for (let y = 80; y < g.height - 60; y += 44) g.arrow(35, y, 145, y, g.accent, 2); g.circle(cx, cy, radius, rgba(g.ink, 0.2), g.accent, 2); const tilt = Number(v.tilt) * Math.PI / 180; g.line(cx - Math.sin(tilt) * radius * 1.35, cy + Math.cos(tilt) * radius * 1.35, cx + Math.sin(tilt) * radius * 1.35, cy - Math.cos(tilt) * radius * 1.35, g.accent, 3); g.text(`축 기울기 ${v.tilt}°`, cx, cy + radius + 36, { align: "center", color: g.accent, size: 15 });
  },
  chart(v) { return { xLabel: "날짜 번호", yLabel: "정오 태양고도 (°)", xDomain: [1, 365], yDomain: [0, 90], series: [{ points: points(1, 365, 183, (day) => ({ x: day, y: seasonsLab.compute({ ...v, day }).noonAltitude })) }] }; },
  caption(r, v) { return `위도 ${v.latitude}° · 태양 적위 ${r.declination.toFixed(1)}° · 정오고도 ${r.noonAltitude.toFixed(1)}° · 낮 길이 ${r.dayLength.toFixed(2)}시간.`; },
  limit: "원형에 가까운 궤도와 평평한 지평선, 대기 굴절 없는 평균 태양을 사용합니다. 구름·해류·지형·도시열섬과 실제 기온 예측은 포함하지 않습니다.",
};
