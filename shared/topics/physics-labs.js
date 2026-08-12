import { math } from "../lab-runtime.js";

const { clamp, lerp, map, TAU } = math;

function points(start, end, count, fn) {
  return Array.from({ length: count }, (_, index) => {
    const x = lerp(start, end, index / Math.max(1, count - 1));
    return fn(x, index);
  });
}

function rgba(hex, alpha) {
  const raw = hex.replace("#", "");
  const value = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;
  const number = Number.parseInt(value, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function groundScene(g, baseline) {
  g.grid(48);
  g.line(0, baseline, g.width, baseline, g.muted, 1);
  for (let x = 20; x < g.width; x += 44) g.line(x, baseline, x + 16, baseline + 8, g.hairline, 1);
}

export const motionLab = {
  id: "motion-lab",
  title: "운동·벡터 궤적 실험실",
  subtitle: "발사 순간의 벡터가 매 순간의 위치·속도·에너지로 어떻게 이어지는지 추적합니다.",
  theme: { primary: "#131A2E", secondary: "#FF9E42" },
  defaultDepth: "M2",
  duration: 8,
  views: [
    { id: "trajectory", label: "궤적", hint: "같은 시간 간격의 위치점을 연결해 운동을 읽습니다." },
    { id: "vectors", label: "속도 벡터", hint: "수평 성분은 유지되고 수직 성분은 중력 때문에 변합니다." },
    { id: "energy", label: "에너지", hint: "위치에너지와 운동에너지의 교환을 막대 높이로 비교합니다." },
  ],
  variables: [
    { key: "speed", label: "발사 속력", shortLabel: "속력", unit: "m/s", min: 4, max: 38, step: 1, default: 18, digits: 0 },
    { key: "angle", label: "발사각", shortLabel: "각도", unit: "°", min: 5, max: 85, step: 1, default: 45, digits: 0 },
    { key: "height", label: "발사 높이", unit: "m", min: 0, max: 20, step: 1, default: 2, digits: 0 },
    { key: "gravity", label: "천체의 중력가속도", shortLabel: "중력", unit: "m/s²", default: "9.81", options: [
      { value: "1.62", label: "달 · 1.62 m/s²" }, { value: "3.71", label: "화성 · 3.71 m/s²" },
      { value: "9.81", label: "지구 · 9.81 m/s²" }, { value: "24.79", label: "목성 · 24.79 m/s²" },
    ] },
    { key: "drag", label: "공기저항 계수(교육 모형)", shortLabel: "저항", unit: "s⁻¹", min: 0, max: 0.12, step: 0.01, default: 0, digits: 2, depth: "H1" },
  ],
  outputs: [
    { key: "range", label: "수평 도달거리", shortLabel: "거리", unit: "m", digits: 1, classMetric: true },
    { key: "flight", label: "비행 시간", unit: "s", digits: 2 },
    { key: "apex", label: "최고 높이", unit: "m", digits: 1 },
    { key: "currentSpeed", label: "현재 속력", unit: "m/s", digits: 1 },
    { key: "energy", label: "역학적 에너지(1 kg)", unit: "J", digits: 1, depth: "H1" },
  ],
  prediction: { question: "공은 수평으로 얼마나 멀리 갈까?", min: 0, max: 160, step: 5, unit: "m", default: 35, digits: 0 },
  missions: [
    { id: "basket", title: "버저비터를 설계하라", question: "7.2 m 앞, 3.05 m 높이의 골대에 가장 느린 속도로 공을 통과시킬 수 있을까요?", preset: { speed: 10, angle: 52, height: 2, gravity: "9.81", drag: 0 }, view: "trajectory" },
    { id: "mars", title: "화성 보급품 투하", question: "같은 발사 장치가 지구와 화성에서 만드는 도달거리 차이를 A/B로 검증하세요.", preset: { speed: 18, angle: 40, height: 4, gravity: "3.71", drag: 0.01 }, view: "vectors" },
    { id: "twins", title: "서로 다른 두 각도의 비밀", question: "공기저항이 없을 때 합이 90°인 두 발사각은 정말 같은 거리에 도달할까요?", preset: { speed: 20, angle: 30, height: 0, gravity: "9.81", drag: 0 }, view: "trajectory" },
    { id: "stunt", title: "스턴트 점프 안전구역", question: "최고 높이는 12 m 이하이면서 45 m를 넘는 조건을 찾아 학급 분포에서 비교하세요.", preset: { speed: 24, angle: 35, height: 1, gravity: "9.81", drag: 0.02 }, view: "energy" },
  ],
  theory: [
    { id: "split", title: "벡터를 두 방향으로", summary: "발사 속도는 수평과 수직으로 나누어 생각할 수 있습니다. 두 성분은 동시에 존재하지만 서로 다른 원인에 반응합니다.", formula: "vₓ = v₀ cos θ   ·   vᵧ = v₀ sin θ", points: ["수평 방향에 힘이 없다면 vₓ는 일정합니다.", "수직 방향에는 매초 g만큼 속도를 줄이는 중력이 작용합니다."], example: "농구 슛을 옆에서 촬영한 슬로모션에서 같은 시간 간격의 수평 이동은 거의 일정합니다." },
    { id: "position", title: "위치는 시간의 결과", summary: "속도는 위치가 얼마나 빠르게 변하는지를 뜻합니다. 수직 위치식의 t² 항은 중력이 계속 누적된 흔적입니다.", formula: "x = v₀ cosθ · t   ·   y = h + v₀ sinθ · t − ½gt²", points: ["최고점에서도 수직 속도만 0이고 수평 속도는 남아 있습니다.", "높은 곳에서 발사하면 올라가는 시간보다 내려오는 시간이 길어집니다."], depth: "M2" },
    { id: "energy", title: "에너지로 같은 운동 읽기", summary: "공기저항이 없으면 운동에너지와 중력 위치에너지의 합은 일정합니다. 최고점은 속력이 0인 점이 아니라 수직 속도만 0인 점입니다.", formula: "½mv² + mgy = 일정", points: ["공기저항을 켜면 일부 역학적 에너지가 공기와 물체의 내부에너지로 이동합니다.", "모형의 drag는 실제 항력의 복잡한 속도 제곱 관계를 단순화합니다."], depth: "H1" },
  ],
  compute(v, time) {
    const speed = Number(v.speed); const angle = Number(v.angle) * Math.PI / 180;
    const gravity = Number(v.gravity); const drag = Number(v.drag || 0);
    const vx0 = speed * Math.cos(angle); const vy0 = speed * Math.sin(angle);
    const idealFlight = (vy0 + Math.sqrt(vy0 ** 2 + 2 * gravity * Number(v.height))) / gravity;
    const flight = idealFlight * (1 + drag * 1.8);
    const sample = (t) => {
      const decay = drag ? Math.exp(-drag * t) : 1;
      const x = drag ? (vx0 / drag) * (1 - decay) : vx0 * t;
      const y = Number(v.height) + (drag ? ((vy0 + gravity / drag) * (1 - decay) / drag - gravity * t / drag) : vy0 * t - 0.5 * gravity * t ** 2);
      const vx = vx0 * decay;
      const vy = drag ? (vy0 + gravity / drag) * decay - gravity / drag : vy0 - gravity * t;
      return { x, y: Math.max(0, y), vx, vy, speed: Math.hypot(vx, vy) };
    };
    const end = sample(flight);
    const now = sample(Math.min(time, flight));
    const apexTime = drag ? Math.log(1 + drag * vy0 / gravity) / drag : vy0 / gravity;
    const apex = sample(Math.max(0, apexTime)).y;
    return { ...now, range: end.x, flight, apex, currentSpeed: now.speed, energy: 0.5 * now.speed ** 2 + gravity * now.y, vx0, vy0, gravity, drag, sample };
  },
  draw(g, v, r, time, view) {
    const baseline = g.height * 0.82; groundScene(g, baseline);
    const xScale = (g.width - 110) / Math.max(20, r.range * 1.08);
    const yScale = (baseline - 70) / Math.max(12, r.apex * 1.25);
    const sx = (x) => 54 + x * xScale; const sy = (y) => baseline - y * yScale;
    const path = points(0, r.flight, 80, (t) => { const p = r.sample(t); return [sx(p.x), sy(p.y)]; });
    g.polyline(path, rgba(g.accent, 0.45), 2);
    for (let marker = 0; marker <= r.flight; marker += Math.max(0.5, r.flight / 10)) {
      const p = r.sample(marker); g.circle(sx(p.x), sy(p.y), 3, g.muted);
    }
    const p = r.sample(Math.min(time, r.flight));
    g.circle(sx(p.x), sy(p.y), 10, g.accent, g.ink, 1);
    g.text(`${p.x.toFixed(1)} m`, sx(p.x), sy(p.y) - 18, { align: "center", color: g.accent, size: 11 });
    if (view === "vectors") {
      const scale = 4.2;
      g.arrow(sx(p.x), sy(p.y), sx(p.x) + p.vx * scale, sy(p.y), g.ink, 2);
      g.arrow(sx(p.x) + p.vx * scale, sy(p.y), sx(p.x) + p.vx * scale, sy(p.y) - p.vy * scale, g.accent, 2);
      g.text("vₓ", sx(p.x) + p.vx * scale / 2, sy(p.y) + 18, { align: "center", color: g.ink });
      g.text("vᵧ", sx(p.x) + p.vx * scale + 10, sy(p.y) - p.vy * scale / 2, { color: g.accent });
      g.arrow(g.width - 70, 72, g.width - 70, 128, g.muted, 2); g.text("g", g.width - 55, 104, { color: g.muted });
    } else if (view === "energy") {
      const total = 0.5 * Number(v.speed) ** 2 + r.gravity * Number(v.height);
      const pe = r.gravity * p.y; const ke = 0.5 * p.speed ** 2;
      const bx = g.width - 130; const bh = 180;
      g.rect(bx, 68, 32, bh, null, g.hairline); g.rect(bx + 54, 68, 32, bh, null, g.hairline);
      g.rect(bx, 68 + bh * (1 - pe / total), 32, bh * pe / total, rgba(g.accent, 0.75), null);
      g.rect(bx + 54, 68 + bh * (1 - ke / total), 32, bh * ke / total, rgba(g.ink, 0.56), null);
      g.text("mgy", bx + 16, 267, { align: "center", color: g.accent }); g.text("½mv²", bx + 70, 267, { align: "center", color: g.ink });
    }
    g.line(sx(r.range), baseline - 10, sx(r.range), baseline + 10, g.accent, 2);
    g.text("착지", sx(r.range), baseline + 28, { align: "center", color: g.accent });
  },
  chart(v, r, view) {
    if (view === "energy") {
      const pts = points(0, r.flight, 50, (t) => { const p = r.sample(t); return { x: t, y: 0.5 * p.speed ** 2 }; });
      const pe = points(0, r.flight, 50, (t) => { const p = r.sample(t); return { x: t, y: r.gravity * p.y }; });
      return { xLabel: "시간 (s)", yLabel: "에너지 (J/kg)", series: [{ points: pts }, { points: pe, opacity: 0.52 }] };
    }
    return { xLabel: "수평 위치 x (m)", yLabel: "높이 y (m)", series: [{ points: points(0, r.flight, 70, (t) => { const p = r.sample(t); return { x: p.x, y: p.y }; }) }] };
  },
  caption(r, v, view, time) {
    const phase = time >= r.flight ? "착지" : r.vy > 0 ? "상승" : "하강";
    return `${phase} 구간 · x=${r.x.toFixed(1)} m, y=${r.y.toFixed(1)} m. ${view === "vectors" ? "화살표의 방향과 길이가 순간 속도입니다." : "점 사이 간격은 같은 시간 동안 이동한 거리입니다."}`;
  },
  limit: "질점, 평평한 지면, 일정한 중력을 가정합니다. 공기저항 슬라이더는 경향 비교용 선형 항력이며 실제 공·차량의 회전, 바람, 난류는 포함하지 않습니다.",
};

export const energyLab = {
  id: "energy-machine-lab",
  title: "일·에너지·기계 실험실",
  subtitle: "경사면과 도르래가 힘을 줄이는 대신 무엇을 더 요구하는지 에너지 장부로 확인합니다.",
  theme: { primary: "#211B18", secondary: "#F2C14E" },
  duration: 10,
  views: [
    { id: "incline", label: "경사면", hint: "힘·이동거리·마찰열을 동시에 표시합니다." },
    { id: "ledger", label: "에너지 장부", hint: "입력 에너지가 유용한 일과 손실로 나뉘는 과정을 봅니다." },
    { id: "pulley", label: "도르래", hint: "지지 줄 수가 늘면 필요한 힘은 줄고 당길 거리는 늘어납니다." },
    { id: "sandbox", label: "자유 기계 제작", hint: "고정점·도르래·화물·손잡이를 놓고 직접 줄을 연결합니다." },
  ],
  variables: [
    { key: "mass", label: "화물 질량", shortLabel: "질량", unit: "kg", min: 5, max: 100, step: 5, default: 30, digits: 0 },
    { key: "height", label: "올릴 높이", shortLabel: "높이", unit: "m", min: 0.5, max: 8, step: 0.5, default: 3, digits: 1 },
    { key: "angle", label: "경사면 각도", shortLabel: "각도", unit: "°", min: 10, max: 70, step: 2, default: 28, digits: 0 },
    { key: "friction", label: "운동 마찰계수", shortLabel: "마찰", unit: "", min: 0, max: 0.6, step: 0.02, default: 0.12, digits: 2 },
    { key: "supports", label: "도르래 지지 줄 수", shortLabel: "지지줄", unit: "가닥", min: 1, max: 6, step: 1, default: 2, digits: 0 },
    { key: "efficiency", label: "기계 효율", unit: "%", min: 45, max: 100, step: 1, default: 88, digits: 0, depth: "H1" },
  ],
  outputs: [
    { key: "inputForce", label: "필요한 입력 힘", shortLabel: "입력힘", unit: "N", digits: 1, classMetric: true },
    { key: "distance", label: "당기는 거리", unit: "m", digits: 2 },
    { key: "useful", label: "유용한 위치에너지", unit: "J", digits: 0 },
    { key: "loss", label: "마찰·기계 손실", unit: "J", digits: 0 },
    { key: "actualEfficiency", label: "전체 효율", unit: "%", digits: 1, depth: "H1" },
  ],
  prediction: { question: "화물을 움직이는 데 필요한 힘은?", min: 0, max: 1000, step: 25, unit: "N", default: 200, digits: 0 },
  missions: [
    { id: "rescue", title: "재난 현장 화물 구조", question: "한 사람이 250 N 이하의 힘으로 60 kg 장비를 4 m 올릴 방법을 설계하세요.", preset: { mass: 60, height: 4, angle: 24, friction: 0.12, supports: 3, efficiency: 85 }, view: "incline" },
    { id: "trade", title: "공짜 힘은 없다", question: "지지 줄을 두 배로 늘렸을 때 힘과 당기는 거리의 곱은 어떻게 되는지 A/B로 비교하세요.", preset: { mass: 40, height: 3, angle: 30, friction: 0, supports: 1, efficiency: 100 }, view: "pulley" },
    { id: "warehouse", title: "창고 램프 최적화", question: "램프가 너무 길어지지 않으면서 입력 힘과 마찰손실을 최소화하는 각도를 찾으세요.", preset: { mass: 50, height: 2.5, angle: 20, friction: 0.22, supports: 1, efficiency: 92 }, view: "ledger" },
  ],
  theory: [
    { id: "work", title: "일은 힘만이 아니다", summary: "힘이 물체를 실제로 이동시킬 때 에너지가 전달됩니다. 이동 방향과 나란한 힘 성분만 일에 기여합니다.", formula: "W = Fd cosφ", points: ["같은 화물을 같은 높이로 올리면 이상적인 유용한 일 mgh는 같습니다.", "작은 힘을 쓰는 기계는 그만큼 더 긴 거리를 움직이게 합니다."], example: "계단 대신 긴 경사로를 쓰면 미는 힘은 줄지만 이동거리는 길어집니다." },
    { id: "advantage", title: "기계적 이득의 교환", summary: "이상적인 도르래에서 화물을 지지하는 줄이 n가닥이면 힘은 1/n이 되고 당길 거리는 n배가 됩니다.", formula: "Fᵢₙ ≈ mg/n   ·   dᵢₙ ≈ nh", points: ["힘의 이득과 거리의 손해가 서로 맞바뀝니다.", "실제 장치에서는 축 마찰과 줄 변형 때문에 입력 일이 더 큽니다."], depth: "M2" },
    { id: "efficiency", title: "에너지 장부와 효율", summary: "손실된 에너지는 사라진 것이 아니라 주로 내부에너지와 소리로 이동합니다. 효율은 유용한 출력과 전체 입력의 비입니다.", formula: "η = W useful / W input × 100%", points: ["효율이 100%보다 클 수는 없습니다.", "힘이 가장 작은 설계가 반드시 에너지 소비가 가장 작은 설계는 아닙니다."], depth: "H1" },
  ],
  compute(v, time, view, depth, sandbox) {
    const g = 9.81; const mass = Number(v.mass); const height = Number(v.height); const angle = Number(v.angle) * Math.PI / 180;
    const rampLength = height / Math.sin(angle); const frictionForce = Number(v.friction) * mass * g * Math.cos(angle);
    const rampForce = mass * g * Math.sin(angle) + frictionForce;
    const useful = mass * g * height; const frictionLoss = frictionForce * rampLength;
    let supports = Number(v.supports);
    if (view === "sandbox" && sandbox?.items?.length) {
      const load = sandbox.items.find((item) => item.type === "load");
      const linked = load ? sandbox.links.filter((link) => link.from === load.id || link.to === load.id).length : 0;
      const pulleys = sandbox.items.filter((item) => item.type === "pulley").length;
      supports = clamp(linked + pulleys, 1, 8);
    }
    const machineEfficiency = Number(v.efficiency) / 100;
    const pulleyForce = mass * g / supports / machineEfficiency; const pulleyDistance = height * supports;
    const usePulley = view === "pulley"; const inputForce = usePulley ? pulleyForce : rampForce;
    const distance = usePulley ? pulleyDistance : rampLength;
    const inputWork = usePulley ? useful / machineEfficiency : useful + frictionLoss;
    const loss = inputWork - useful; const progress = clamp(time / 10, 0, 1);
    return { inputForce, distance, useful, loss, inputWork, actualEfficiency: useful / inputWork * 100, rampLength, rampForce, frictionForce, pulleyForce, pulleyDistance, progress };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(52);
    if (view === "sandbox") return;
    if (view === "ledger") {
      const total = Math.max(r.inputWork, 1); const x = g.width * 0.18; const y = 105; const w = g.width * 0.64; const h = 86;
      g.text("입력 에너지", x, y - 26, { color: g.ink, size: 14 });
      g.rect(x, y, w, h, rgba(g.ink, 0.08), g.hairline);
      const usefulW = w * r.useful / total;
      g.rect(x, y, usefulW, h, rgba(g.accent, 0.78), null); g.rect(x + usefulW, y, w - usefulW, h, rgba(g.muted, 0.34), null);
      g.text(`유용한 일 ${r.useful.toFixed(0)} J`, x + usefulW / 2, y + h / 2, { align: "center", baseline: "middle", color: g.surface, weight: 700 });
      if (w - usefulW > 80) g.text(`손실 ${r.loss.toFixed(0)} J`, x + usefulW + (w - usefulW) / 2, y + h / 2, { align: "center", baseline: "middle", color: g.ink });
      g.arrow(x, y + 145, x + w * r.progress, y + 145, g.accent, 4);
      g.text(`전달 진행 ${(r.progress * 100).toFixed(0)}%`, x, y + 178, { color: g.muted });
      return;
    }
    const floor = g.height * 0.82; groundScene(g, floor);
    if (view === "pulley") {
      const top = 92; const cx = g.width * 0.54; const radius = 34; const supports = Number(v.supports);
      g.line(cx - 150, top - 28, cx + 150, top - 28, g.ink, 5);
      g.circle(cx, top + 50, radius, null, g.accent, 3);
      for (let i = 0; i < supports; i += 1) {
        const offset = map(i, 0, Math.max(1, supports - 1), -radius * 0.72, radius * 0.72);
        g.line(cx + offset, top - 28, cx + offset, top + 150 - r.progress * 88, i % 2 ? g.muted : g.accent, 2);
      }
      const boxY = top + 150 - r.progress * 88;
      g.rect(cx - 55, boxY, 110, 74, rgba(g.accent, 0.16), g.accent, 2);
      g.text(`${v.mass} kg`, cx, boxY + 40, { align: "center", color: g.accent, size: 16, weight: 700 });
      g.arrow(cx + 120, top + 14, cx + 120, top + 140, g.accent, 3); g.text(`당김 ${r.pulleyDistance.toFixed(1)} m`, cx + 136, top + 82, { color: g.accent });
      g.text(`지지 줄 ${supports}가닥 → ${r.pulleyForce.toFixed(0)} N`, cx, floor + 34, { align: "center", color: g.ink, size: 14 });
      return;
    }
    const left = 70; const right = g.width - 80; const top = floor - Math.min(g.height * 0.55, Number(v.height) * 52);
    g.polyline([[left, floor], [right, top], [right, floor]], g.ink, 2, true, rgba(g.accent, 0.06));
    const progress = r.progress; const bx = lerp(left + 36, right - 36, progress); const by = lerp(floor - 12, top - 12, progress);
    g.rect(bx - 30, by - 30, 60, 45, rgba(g.accent, 0.22), g.accent, 2);
    g.arrow(bx, by - 12, bx + 82 * Math.cos(-Number(v.angle) * Math.PI / 180), by - 12 - 82 * Math.sin(Number(v.angle) * Math.PI / 180), g.accent, 3);
    g.text(`F ${r.rampForce.toFixed(0)} N`, bx + 42, by - 64, { align: "center", color: g.accent });
    g.arrow(bx, by + 4, bx, by + 86, g.muted, 2); g.text("mg", bx + 10, by + 70, { color: g.muted });
    g.text(`경사로 ${r.rampLength.toFixed(1)} m`, (left + right) / 2, floor + 32, { align: "center", color: g.ink });
  },
  chart(v, r, view) {
    if (view === "pulley" || view === "sandbox") return { xLabel: "지지 줄 수", yLabel: "입력 힘 (N)", series: [{ points: points(1, 6, 6, (n) => ({ x: n, y: Number(v.mass) * 9.81 / n / (Number(v.efficiency) / 100) })), showPoints: true }] };
    return { xLabel: "경사각 (°)", yLabel: "필요한 힘 (N)", series: [{ points: points(10, 70, 61, (angle) => { const a = angle * Math.PI / 180; return { x: angle, y: Number(v.mass) * 9.81 * (Math.sin(a) + Number(v.friction) * Math.cos(a)) }; }) }] };
  },
  caption(r, v, view) { return view === "pulley" ? `필요한 힘은 ${r.pulleyForce.toFixed(1)} N, 대신 줄을 ${r.pulleyDistance.toFixed(1)} m 당겨야 합니다.` : `경사면 힘 ${r.rampForce.toFixed(1)} N 중 마찰을 이기는 데 ${r.frictionForce.toFixed(1)} N이 쓰입니다.`; },
  sandbox: {
    view: "sandbox",
    title: "도르래 장치 제작대",
    instructions: "부품을 놓은 뒤 연결 모드로 줄 경로를 만드세요. 화물에 연결된 지지 경로가 많을수록 힘은 줄고 당기는 거리는 늘어납니다.",
    parts: [
      { type: "anchor", label: "고정점", icon: "◆", max: 4 },
      { type: "pulley", label: "도르래", icon: "○", max: 6 },
      { type: "load", label: "화물", icon: "▣", max: 1 },
      { type: "handle", label: "손잡이", icon: "┐", max: 2 },
    ],
    initial: [
      { type: "anchor", x: 0.32, y: 0.25 }, { type: "pulley", x: 0.48, y: 0.44 },
      { type: "load", x: 0.48, y: 0.67 }, { type: "handle", x: 0.7, y: 0.62 },
    ],
    canLink(from, to) { return from?.type !== "load" || to?.type !== "handle"; },
    evaluate(sandbox) {
      const load = sandbox.items.find((item) => item.type === "load");
      const handle = sandbox.items.find((item) => item.type === "handle");
      const linked = load ? sandbox.links.filter((link) => link.from === load.id || link.to === load.id).length : 0;
      const valid = Boolean(load && handle && linked && sandbox.links.length >= 2);
      return { valid, summary: valid ? `작동 경로 후보 · 화물 지지 ${clamp(linked + sandbox.items.filter((item) => item.type === "pulley").length, 1, 8)}가닥` : "화물과 손잡이를 고정점/도르래를 거쳐 연결하세요." };
    },
    draw(g, sandbox, result, time, ui) {
      const byId = new Map(sandbox.items.map((item) => [item.id, item]));
      sandbox.links.forEach((link) => { const a = byId.get(link.from); const b = byId.get(link.to); if (a && b) g.line(a.x * g.width, a.y * g.height, b.x * g.width, b.y * g.height, g.accent, 3); });
      sandbox.items.forEach((item) => {
        const x = item.x * g.width; const y = item.y * g.height; const selected = item.id === ui.selected;
        if (item.type === "pulley") { g.circle(x, y, 25, rgba(g.accent, 0.12), selected ? g.ink : g.accent, selected ? 4 : 2); g.circle(x, y, 5, g.accent); }
        if (item.type === "anchor") { g.polyline([[x - 20, y - 15], [x + 20, y - 15], [x, y + 18]], selected ? g.ink : g.accent, 2, true, rgba(g.accent, 0.16)); }
        if (item.type === "load") { g.rect(x - 36, y - 27, 72, 54, rgba(g.accent, 0.18), selected ? g.ink : g.accent, selected ? 4 : 2); g.text("화물", x, y + 5, { align: "center", color: g.accent, weight: 700 }); }
        if (item.type === "handle") { g.line(x - 18, y - 20, x - 18, y + 20, selected ? g.ink : g.accent, 4); g.line(x - 18, y, x + 22, y, selected ? g.ink : g.accent, 4); }
      });
      g.text(`현재 계산 힘 ${result.inputForce.toFixed(1)} N · 당김 거리 ${result.distance.toFixed(1)} m`, g.width / 2, g.height - 44, { align: "center", color: g.accent, size: 15, weight: 700 });
    },
  },
  limit: "줄과 도르래의 질량, 줄의 탄성, 축의 회전관성은 생략합니다. 마찰계수는 속도와 온도에 무관한 상수로 두며 사람의 생체역학은 포함하지 않습니다.",
};

export const circuitLab = {
  id: "circuit-lab",
  title: "전기회로·전력 실험실",
  subtitle: "전압은 무엇을 밀고, 전류는 어디서 갈라지며, 에너지는 어느 부품에서 전달되는지 추적합니다.",
  theme: { primary: "#170F2C", secondary: "#A8F04A" },
  duration: 6,
  views: [
    { id: "circuit", label: "회로도", hint: "전류 점의 속도는 전류의 상대적 크기를 나타냅니다." },
    { id: "potential", label: "전위 지도", hint: "전선에서는 거의 변하지 않고 저항에서 전위가 크게 떨어집니다." },
    { id: "power", label: "전력·발열", hint: "같은 시간에 전달되는 에너지의 양을 비교합니다." },
    { id: "sandbox", label: "자유 회로 제작", hint: "전원·저항·전구·스위치를 놓고 연결해 닫힌 경로를 만듭니다." },
  ],
  variables: [
    { key: "voltage", label: "전원 기전력", shortLabel: "전압", unit: "V", min: 1, max: 24, step: 0.5, default: 9, digits: 1 },
    { key: "r1", label: "저항 R₁", unit: "Ω", min: 1, max: 100, step: 1, default: 18, digits: 0 },
    { key: "r2", label: "저항 R₂", unit: "Ω", min: 1, max: 100, step: 1, default: 33, digits: 0 },
    { key: "topology", label: "연결 방식", shortLabel: "연결", default: "parallel", options: [{ value: "series", label: "직렬 연결" }, { value: "parallel", label: "병렬 연결" }] },
    { key: "internal", label: "전원의 내부저항", shortLabel: "내부R", unit: "Ω", min: 0, max: 10, step: 0.2, default: 0.8, digits: 1, depth: "H1" },
    { key: "switchOn", label: "스위치", default: "on", options: [{ value: "on", label: "닫힘 · 전류 흐름" }, { value: "off", label: "열림 · 전류 차단" }] },
  ],
  outputs: [
    { key: "totalCurrent", label: "전체 전류", shortLabel: "전류", unit: "A", digits: 3, classMetric: true },
    { key: "terminalVoltage", label: "단자 전압", unit: "V", digits: 2 },
    { key: "equivalent", label: "합성 저항", unit: "Ω", digits: 2 },
    { key: "totalPower", label: "부하 전력", unit: "W", digits: 2 },
    { key: "efficiency", label: "전원 전달 효율", unit: "%", digits: 1, depth: "H1" },
  ],
  prediction: { question: "전원에서 흐르는 전체 전류는?", min: 0, max: 5, step: 0.1, unit: "A", default: 0.5, digits: 1 },
  missions: [
    { id: "led", title: "LED를 태우지 마라", question: "9 V 전원에서 0.020 A 이하가 흐르도록 저항 조합을 설계하세요.", preset: { voltage: 9, r1: 100, r2: 100, topology: "series", internal: 0.5, switchOn: "on" }, view: "circuit" },
    { id: "blackout", title: "집 한 곳이 꺼져도", question: "한 저항이 매우 커졌을 때 다른 가지 전력은 직렬과 병렬에서 어떻게 달라질까요?", preset: { voltage: 12, r1: 15, r2: 30, topology: "parallel", internal: 0.4, switchOn: "on" }, view: "power" },
    { id: "battery", title: "낡은 배터리의 정체", question: "전원 전압은 같은데 큰 전류에서 단자 전압이 낮아지는 이유를 내부저항으로 설명하세요.", preset: { voltage: 9, r1: 8, r2: 8, topology: "parallel", internal: 3, switchOn: "on" }, view: "potential" },
    { id: "fuse", title: "퓨즈 기준 찾기", question: "전체 전력이 36 W를 넘지 않으면서 두 부하가 가장 밝은 조건을 학급에서 비교하세요.", preset: { voltage: 12, r1: 12, r2: 24, topology: "parallel", internal: 0.6, switchOn: "on" }, view: "power" },
  ],
  theory: [
    { id: "flow", title: "전류는 소모되지 않는다", summary: "전류는 단위 시간에 한 단면을 지나는 전하량입니다. 분기점으로 들어온 전하의 흐름은 나가는 흐름의 합과 같습니다.", formula: "I = ΔQ/Δt   ·   I전체 = I₁ + I₂", points: ["전구가 전류를 먹어 없애는 것이 아니라 전기적 에너지를 다른 형태로 전달합니다.", "병렬 가지의 전류는 저항이 작을수록 큽니다."], example: "가정의 콘센트는 기기가 하나 꺼져도 다른 기기가 작동하도록 병렬로 연결됩니다." },
    { id: "ohm", title: "전압·전류·저항", summary: "전압은 단위 전하당 에너지 차이입니다. 같은 저항에서는 전압 차이가 클수록 전하 흐름이 커집니다.", formula: "V = IR", points: ["직렬 저항에서는 같은 전류가 흐르고 전압 강하가 나뉩니다.", "병렬 저항에는 같은 단자 전압이 걸리고 전류가 나뉩니다."], depth: "M2" },
    { id: "power", title: "전력과 내부저항", summary: "전력은 에너지 전달률입니다. 실제 전원에도 내부저항이 있어 큰 전류에서는 전원 내부 발열과 단자 전압 강하가 생깁니다.", formula: "P = VI = I²R = V²/R   ·   V단자 = ℰ − Ir", points: ["부하 저항을 무작정 작게 하면 외부 전력보다 내부 발열이 커질 수 있습니다.", "회로의 밝기는 전류 하나가 아니라 각 부품의 전력으로 비교해야 합니다."], depth: "H1" },
  ],
  compute(v, time, view, depth, sandbox) {
    let r1 = Number(v.r1); let r2 = Number(v.r2); let emf = Number(v.voltage); const internal = Number(v.internal || 0);
    let topology = v.topology; let closed = v.switchOn === "on";
    if (view === "sandbox" && sandbox?.items?.length) {
      const source = sandbox.items.find((item) => item.type === "battery");
      const loads = sandbox.items.filter((item) => item.resistance);
      const switches = sandbox.items.filter((item) => item.type === "switch");
      const connectedIds = new Set(source ? [source.id] : []); let changed = true;
      while (changed) { changed = false; sandbox.links.forEach((link) => { if (connectedIds.has(link.from) && !connectedIds.has(link.to)) { connectedIds.add(link.to); changed = true; } if (connectedIds.has(link.to) && !connectedIds.has(link.from)) { connectedIds.add(link.from); changed = true; } }); }
      const activeLoads = loads.filter((item) => connectedIds.has(item.id));
      r1 = Number(activeLoads[0]?.resistance || 1000); r2 = Number(activeLoads[1]?.resistance || 1000);
      emf = Number(source?.voltage || v.voltage); const activeNodeCount = sandbox.items.filter((item) => connectedIds.has(item.id)).length;
      const activeEdgeCount = sandbox.links.filter((link) => connectedIds.has(link.from) && connectedIds.has(link.to)).length;
      closed = Boolean(source && activeLoads.length && activeEdgeCount >= activeNodeCount && switches.every((item) => item.closed !== false));
      topology = activeLoads.length > 1 && activeEdgeCount > activeNodeCount ? "parallel" : "series";
      if (activeLoads.length === 1) r2 = topology === "parallel" ? 1e9 : 0.0001;
    }
    const equivalent = topology === "series" ? r1 + r2 : (r1 * r2) / (r1 + r2);
    const totalCurrent = closed ? emf / (equivalent + internal) : 0; const terminalVoltage = closed ? emf - totalCurrent * internal : emf;
    const i1 = closed ? (topology === "series" ? totalCurrent : terminalVoltage / r1) : 0;
    const i2 = closed ? (topology === "series" ? totalCurrent : terminalVoltage / r2) : 0;
    const p1 = i1 ** 2 * r1; const p2 = i2 ** 2 * r2; const totalPower = p1 + p2; const internalPower = totalCurrent ** 2 * internal;
    return { equivalent, totalCurrent, terminalVoltage, i1, i2, p1, p2, totalPower, internalPower, efficiency: totalPower / Math.max(1e-9, totalPower + internalPower) * 100, closed };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(48);
    if (view === "sandbox") return;
    const left = g.width * 0.18; const right = g.width * 0.82; const top = g.height * 0.23; const bottom = g.height * 0.76;
    g.line(left, top, right, top, g.ink, 2); g.line(left, bottom, right, bottom, g.ink, 2); g.line(left, top, left, bottom, g.ink, 2);
    const swx = lerp(left, right, 0.28); g.line(swx - 34, top, swx - 7, top, g.ink, 2);
    g.line(swx + 24, top, swx + 52, top, g.ink, 2); g.line(swx - 7, top, swx + 22, top + (r.closed ? 0 : -24), r.closed ? g.accent : g.muted, 3);
    g.text(r.closed ? "SW 닫힘" : "SW 열림", swx + 8, top - 22, { align: "center", color: r.closed ? g.accent : g.muted });
    const batteryY = (top + bottom) / 2; g.line(left - 14, batteryY - 28, left + 14, batteryY - 28, g.accent, 3); g.line(left - 27, batteryY + 6, left + 27, batteryY + 6, g.accent, 5);
    g.text(`${v.voltage} V`, left - 40, batteryY - 4, { align: "right", color: g.accent, size: 14 });
    if (v.topology === "series") {
      const y = bottom; const r1x = g.width * 0.49; const r2x = g.width * 0.68;
      [[r1x, v.r1, r.p1, "R₁"], [r2x, v.r2, r.p2, "R₂"]].forEach(([x, value, power, name]) => {
        g.rect(x - 38, y - 18, 76, 36, view === "power" ? rgba(g.accent, clamp(Number(power) / Math.max(r.p1, r.p2, 0.1), 0.12, 0.85)) : g.surface, g.accent, 2);
        g.text(`${name} ${value}Ω`, x, y + 5, { align: "center", color: view === "power" ? g.surface : g.accent, weight: 700 });
      });
    } else {
      const branchX1 = g.width * 0.48; const branchX2 = g.width * 0.69;
      [branchX1, branchX2].forEach((x) => { g.line(x, top, x, bottom, g.ink, 2); });
      [[branchX1, v.r1, r.p1, "R₁"], [branchX2, v.r2, r.p2, "R₂"]].forEach(([x, value, power, name]) => {
        const y = (top + bottom) / 2;
        g.rect(x - 38, y - 20, 76, 40, view === "power" ? rgba(g.accent, clamp(Number(power) / Math.max(r.p1, r.p2, 0.1), 0.12, 0.85)) : g.surface, g.accent, 2);
        g.text(`${name} ${value}Ω`, x, y + 5, { align: "center", color: view === "power" ? g.surface : g.accent, weight: 700 });
      });
    }
    if (r.closed) {
      const speed = 0.4 + r.totalCurrent * 1.4;
      for (let i = 0; i < 13; i += 1) {
        const phase = (i / 13 + time * speed / 6) % 1; const x = lerp(left + 18, right - 18, phase);
        g.circle(x, top, 3.5, g.accent);
      }
    }
    if (view === "potential") {
      const plotY = g.height * 0.9; const values = v.topology === "series" ? [Number(v.voltage), r.terminalVoltage, r.terminalVoltage - r.i1 * Number(v.r1), 0] : [Number(v.voltage), r.terminalVoltage, r.terminalVoltage, 0];
      const xs = [left, swx + 50, g.width * 0.62, right];
      g.polyline(values.map((value, i) => [xs[i], plotY - value * 6]), g.accent, 3);
      g.text("전위", left - 10, plotY - Number(v.voltage) * 6, { align: "right", color: g.accent });
    }
    g.text(`${v.topology === "series" ? "직렬" : "병렬"} · I전체 ${r.totalCurrent.toFixed(3)} A`, g.width / 2, 46, { align: "center", color: g.ink, size: 16 });
  },
  chart(v, r, view) {
    if (view === "power") return { xLabel: "부품", yLabel: "전력 (W)", xDomain: [0, 3], yDomain: [0, Math.max(1, r.p1, r.p2, r.internalPower) * 1.2], series: [{ type: "bars", points: [{ x: 0.75, y: r.p1 }, { x: 1.5, y: r.p2 }, { x: 2.25, y: r.internalPower }] }] };
    return { xLabel: "부하 합성저항 (Ω)", yLabel: "전체 전류 (A)", series: [{ points: points(1, 150, 80, (resistance) => ({ x: resistance, y: Number(v.voltage) / (resistance + Number(v.internal)) })) }] };
  },
  caption(r, v, view) { return view === "power" ? `R₁ ${r.p1.toFixed(2)} W · R₂ ${r.p2.toFixed(2)} W · 전원 내부 ${r.internalPower.toFixed(2)} W` : `합성저항 ${r.equivalent.toFixed(2)} Ω, 단자전압 ${r.terminalVoltage.toFixed(2)} V. 전류 점은 전자가 실제로 빠르게 달리는 모습을 뜻하지 않습니다.`; },
  sandbox: {
    view: "sandbox",
    title: "회로 제작 보드",
    instructions: "부품을 놓고 연결 모드로 닫힌 고리를 만드세요. 잘못된 연결도 허용되며, 단락은 매우 큰 전류 경고로 관찰합니다.",
    parts: [
      { type: "battery", label: "9 V 전원", icon: "╫", max: 1, defaults: { voltage: 9 } },
      { type: "resistor10", label: "10 Ω", icon: "⌁", max: 5, defaults: { resistance: 10 } },
      { type: "resistor47", label: "47 Ω", icon: "⌁", max: 5, defaults: { resistance: 47 } },
      { type: "lamp", label: "전구 24 Ω", icon: "⊗", max: 4, defaults: { resistance: 24 } },
      { type: "switch", label: "스위치", icon: "／", max: 3, defaults: { closed: true } },
      { type: "junction", label: "접속점", icon: "●", max: 8 },
    ],
    initial: [
      { type: "battery", x: 0.25, y: 0.52 }, { type: "resistor10", x: 0.5, y: 0.32 },
      { type: "lamp", x: 0.7, y: 0.52 }, { type: "switch", x: 0.5, y: 0.72 },
    ],
    evaluate(sandbox) {
      const source = sandbox.items.find((item) => item.type === "battery"); const loads = sandbox.items.filter((item) => item.resistance);
      const closedCandidate = Boolean(source && loads.length && sandbox.links.length >= sandbox.items.length);
      return { valid: closedCandidate, summary: closedCandidate ? `닫힌 경로 후보 · 부하 ${loads.length}개 · 연결 ${sandbox.links.length}개` : "전원과 부하를 포함해 시작점으로 돌아오는 닫힌 고리를 만드세요." };
    },
    draw(g, sandbox, result, time, ui) {
      const byId = new Map(sandbox.items.map((item) => [item.id, item]));
      sandbox.links.forEach((link) => { const a = byId.get(link.from); const b = byId.get(link.to); if (!a || !b) return; g.line(a.x * g.width, a.y * g.height, b.x * g.width, b.y * g.height, result.closed ? g.accent : g.muted, result.closed ? 3 : 2); });
      sandbox.items.forEach((item) => {
        const x = item.x * g.width; const y = item.y * g.height; const selected = item.id === ui.selected; const color = selected ? g.ink : g.accent;
        if (item.type === "battery") { g.line(x - 16, y - 24, x - 16, y + 24, color, 3); g.line(x + 10, y - 36, x + 10, y + 36, color, 6); }
        else if (item.type === "lamp") { g.circle(x, y, 25, rgba(g.accent, result.closed ? 0.55 : 0.08), color, selected ? 4 : 2); g.line(x - 13, y - 13, x + 13, y + 13, color, 2); g.line(x + 13, y - 13, x - 13, y + 13, color, 2); }
        else if (item.type === "switch") { g.circle(x - 24, y, 4, color); g.circle(x + 24, y, 4, color); g.line(x - 20, y, x + 20, y - 15, color, 3); }
        else if (item.type === "junction") g.circle(x, y, 8, color);
        else { g.rect(x - 34, y - 15, 68, 30, rgba(g.accent, 0.08), color, selected ? 4 : 2); g.text(`${item.resistance}Ω`, x, y + 4, { align: "center", color }); }
        g.text(item.label, x, y + 48, { align: "center", color: g.muted, size: 10 });
      });
      if (result.closed) {
        sandbox.links.forEach((link, index) => { const a = byId.get(link.from); const b = byId.get(link.to); if (!a || !b) return; const phase = (time * Math.min(2, result.totalCurrent + 0.2) + index * 0.17) % 1; g.circle(lerp(a.x, b.x, phase) * g.width, lerp(a.y, b.y, phase) * g.height, 4, g.ink); });
      }
      g.text(result.closed ? `I = ${result.totalCurrent.toFixed(3)} A · P = ${result.totalPower.toFixed(2)} W` : "열린 회로 · 전류 0 A", g.width / 2, g.height - 38, { align: "center", color: result.closed ? g.accent : g.muted, size: 15, weight: 700 });
    },
  },
  limit: "저항은 옴 법칙을 정확히 따르고 온도에 따라 변하지 않는다고 가정합니다. 전선 저항, 과도현상, 교류, 반도체의 비선형 특성은 별도 심화 모형이 필요합니다.",
};

export const gravityLab = {
  id: "gravity-orbit-lab",
  title: "행성 중력·궤도 실험실",
  subtitle: "떨어지는 것과 공전하는 것이 같은 중력 현상이라는 사실을 속도·에너지·궤도로 연결합니다.",
  theme: { primary: "#0A1430", secondary: "#8FD3FF" },
  duration: 12,
  views: [
    { id: "orbit", label: "궤도", hint: "옆으로 충분히 빠르게 떨어지면 천체 표면을 계속 빗나갑니다." },
    { id: "vectors", label: "힘·속도", hint: "속도는 접선 방향, 중력가속도는 중심 방향입니다." },
    { id: "well", label: "에너지 우물", hint: "총에너지의 부호가 속박 궤도와 탈출을 구분합니다." },
  ],
  variables: [
    { key: "body", label: "중심 천체", shortLabel: "천체", default: "earth", options: [{ value: "moon", label: "달" }, { value: "earth", label: "지구" }, { value: "mars", label: "화성" }, { value: "jupiter", label: "목성" }] },
    { key: "altitude", label: "표면 위 고도", shortLabel: "고도", unit: "km", min: 100, max: 50000, step: 100, default: 400, digits: 0 },
    { key: "speedFactor", label: "원궤도 속도 대비", shortLabel: "속도비", unit: "배", min: 0.3, max: 1.55, step: 0.01, default: 1, digits: 2 },
    { key: "mass", label: "위성 질량", unit: "kg", min: 100, max: 5000, step: 100, default: 500, digits: 0 },
    { key: "direction", label: "발사 방향 오차", unit: "°", min: -20, max: 20, step: 1, default: 0, digits: 0, depth: "H1" },
  ],
  outputs: [
    { key: "speed", label: "초기 속력", shortLabel: "속력", unit: "km/s", digits: 2, classMetric: true },
    { key: "gravity", label: "해당 고도 중력", unit: "m/s²", digits: 3 },
    { key: "period", label: "원궤도 기준 주기", unit: "h", digits: 2 },
    { key: "escapeSpeed", label: "탈출 속력", unit: "km/s", digits: 2 },
    { key: "specificEnergy", label: "비에너지", unit: "MJ/kg", digits: 2, depth: "H1" },
  ],
  prediction: { question: "필요한 초기 속력은?", min: 0, max: 30, step: 0.5, unit: "km/s", default: 8, digits: 1 },
  missions: [
    { id: "iss", title: "ISS가 떨어지지 않는 이유", question: "고도 400 km에서 지구 중력이 얼마나 남아 있는지 확인하고 원궤도 속도를 찾으세요.", preset: { body: "earth", altitude: 400, speedFactor: 1, mass: 500, direction: 0 }, view: "vectors" },
    { id: "escape", title: "탈출과 공전의 경계", question: "속도를 조금씩 높여 총에너지가 0이 되는 경계를 학급 표본으로 좁히세요.", preset: { body: "earth", altitude: 1000, speedFactor: 1.35, mass: 800, direction: 0 }, view: "well" },
    { id: "jupiter", title: "목성 탐사선 구조 작전", question: "같은 고도에서 지구와 목성의 원궤도·탈출 속도는 왜 크게 다를까요?", preset: { body: "jupiter", altitude: 5000, speedFactor: 1, mass: 1200, direction: 0 }, view: "orbit" },
    { id: "mass", title: "무거운 위성이 더 빨라야 할까", question: "위성 질량을 10배 바꿔도 원궤도 속도가 바뀌는지 A/B로 검증하세요.", preset: { body: "earth", altitude: 600, speedFactor: 1, mass: 200, direction: 0 }, view: "vectors" },
  ],
  theory: [
    { id: "inverse", title: "거리 제곱에 반비례", summary: "구형 천체 바깥의 중력은 중심에 모든 질량이 모인 것처럼 계산할 수 있습니다. 거리가 두 배면 중력은 1/4입니다.", formula: "g(r) = GM/r²", points: ["고도 400 km에서도 지구 중력은 지표의 약 90%입니다.", "우주정거장의 무중력은 중력이 없어서가 아니라 모든 것이 함께 자유낙하하기 때문입니다."], example: "우주비행사와 우주정거장이 같은 가속도로 지구를 향해 계속 떨어집니다." },
    { id: "orbit", title: "공전은 계속 빗나가는 낙하", summary: "원운동에 필요한 중심가속도 v²/r를 중력이 제공할 때 원궤도가 됩니다. 위성 질량은 양쪽에서 약분됩니다.", formula: "v원 = √(GM/r)   ·   T = 2π√(r³/GM)", points: ["더 높은 원궤도는 속력은 느리지만 한 바퀴 도는 시간은 깁니다.", "질량이 큰 위성도 같은 위치에서는 같은 원궤도 속도가 필요합니다."], depth: "M2" },
    { id: "energy", title: "탈출은 에너지 조건", summary: "운동에너지와 음의 중력 위치에너지의 합이 0 이상이면 무한히 멀리 갈 가능성이 생깁니다.", formula: "ε = v²/2 − GM/r   ·   v탈출 = √(2GM/r)", points: ["탈출 속도는 같은 위치 원궤도 속도의 √2배입니다.", "방향이 나쁘면 같은 속력이어도 천체와 충돌할 수 있습니다."], depth: "H1" },
  ],
  compute(v, time) {
    const bodies = { moon: { mu: 4.9049e12, radius: 1.7374e6, name: "달" }, earth: { mu: 3.986e14, radius: 6.371e6, name: "지구" }, mars: { mu: 4.2828e13, radius: 3.3895e6, name: "화성" }, jupiter: { mu: 1.2669e17, radius: 6.9911e7, name: "목성" } };
    const body = bodies[v.body]; const radius = body.radius + Number(v.altitude) * 1000;
    const circular = Math.sqrt(body.mu / radius); const speed = circular * Number(v.speedFactor); const escape = Math.sqrt(2 * body.mu / radius);
    const gravity = body.mu / radius ** 2; const period = TAU * Math.sqrt(radius ** 3 / body.mu);
    const specificEnergy = speed ** 2 / 2 - body.mu / radius;
    const ratio = Number(v.speedFactor); const eccentricity = Math.abs(ratio ** 2 - 1);
    const escaped = specificEnergy >= 0; const crashed = ratio < 0.72 || Math.abs(Number(v.direction)) > 14;
    return { body, radius, circular, speed: speed / 1000, gravity, period: period / 3600, escapeSpeed: escape / 1000, specificEnergy: specificEnergy / 1e6, eccentricity, escaped, crashed, phase: (time / Math.max(2, Math.min(12, period / 3600))) * TAU };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(56); const cx = g.width * 0.48; const cy = g.height * 0.5; const planetR = Math.min(g.width, g.height) * 0.13;
    if (view === "well") {
      const mid = g.height * 0.46; const left = 70; const right = g.width - 60;
      const curve = points(0.08, 1, 100, (fraction) => [lerp(left, right, fraction), mid + 155 / (fraction * 4 + 0.2) - 42]);
      g.polyline(curve, g.accent, 3); g.line(left, mid, right, mid, g.muted, 1, [6, 5]);
      const energyY = mid - r.specificEnergy * 8; g.line(left, energyY, right, energyY, r.escaped ? g.accent : g.ink, 3);
      g.text(r.escaped ? "총에너지 ≥ 0 · 탈출 가능" : "총에너지 < 0 · 중력에 속박", right, energyY - 12, { align: "right", color: r.escaped ? g.accent : g.ink, size: 14 });
      g.text("중력 위치에너지 우물", left, mid + 135, { color: g.muted }); return;
    }
    const ratio = Number(v.speedFactor); const orbitA = planetR * (2.4 + Math.min(1.6, r.eccentricity * 1.6)); const orbitB = orbitA * clamp(1 - r.eccentricity * 0.65, 0.32, 1);
    g.circle(cx, cy, planetR, rgba(g.accent, 0.18), g.accent, 2);
    g.circle(cx - orbitA * r.eccentricity * 0.35, cy, orbitA, null, rgba(g.ink, 0.26), 1);
    const sx = cx + orbitA * Math.cos(r.phase); const sy = cy + orbitB * Math.sin(r.phase);
    g.circle(sx, sy, 8, g.ink, g.accent, 2);
    if (r.escaped) {
      g.polyline([[sx, sy], [sx + 95, sy - 50], [sx + 190, sy - 76]], g.accent, 2);
      g.text("열린 경로", sx + 175, sy - 88, { color: g.accent });
    }
    if (view === "vectors") {
      const dx = cx - sx; const dy = cy - sy; const len = Math.hypot(dx, dy);
      g.arrow(sx, sy, sx + (-dy / len) * 90 * ratio, sy + (dx / len) * 90 * ratio, g.accent, 3); g.text("v", sx + (-dy / len) * 100 * ratio, sy + (dx / len) * 100 * ratio, { color: g.accent });
      g.arrow(sx, sy, sx + dx / len * 75, sy + dy / len * 75, g.ink, 2); g.text("g", sx + dx / len * 84, sy + dy / len * 84, { color: g.ink });
    }
    g.text(`${r.body.name} · 고도 ${Number(v.altitude).toLocaleString()} km`, cx, cy + 5, { align: "center", color: g.ink, weight: 700 });
    g.text(`${r.speed.toFixed(2)} km/s`, sx, sy - 18, { align: "center", color: g.accent });
  },
  chart(v, r, view) {
    if (view === "well") return { xLabel: "원궤도 속도 대비", yLabel: "비에너지 (MJ/kg)", series: [{ points: points(0.3, 1.55, 100, (factor) => ({ x: factor, y: ((r.circular * factor) ** 2 / 2 - r.body.mu / r.radius) / 1e6 })) }] };
    return { xLabel: "고도 (km)", yLabel: "원궤도 속력 (km/s)", series: [{ points: points(100, 50000, 100, (altitude) => ({ x: altitude, y: Math.sqrt(r.body.mu / (r.body.radius + altitude * 1000)) / 1000 })) }] };
  },
  caption(r) { return `${r.body.name} 고도에서 중력 ${r.gravity.toFixed(3)} m/s² · ${r.escaped ? "총에너지가 0 이상이라 열린 경로가 가능합니다." : r.crashed ? "속도나 방향 때문에 표면과 만날 가능성이 큽니다." : "중력에 묶인 궤도입니다."}`; },
  limit: "중심 천체를 완전한 구형 점질량으로 보고 대기저항, 자전, 다른 천체의 섭동과 추력을 생략합니다. 화면 궤도는 개념 판별용이며 정밀 궤도 적분기가 아닙니다.",
};

export const thermalLab = {
  id: "thermal-equilibrium-lab",
  title: "열전달·열평형 실험실",
  subtitle: "온도와 열을 구분하고, 물질·질량·단열 조건이 평형 온도와 도달 시간을 어떻게 바꾸는지 측정합니다.",
  theme: { primary: "#2B1514", secondary: "#FF7A45" },
  duration: 20,
  views: [
    { id: "particles", label: "입자 운동", hint: "온도는 입자들의 무질서한 운동에너지 분포와 관련됩니다." },
    { id: "calorimeter", label: "열량계", hint: "뜨거운 쪽이 잃은 에너지와 차가운 쪽이 얻은 에너지를 비교합니다." },
    { id: "curve", label: "냉각 곡선", hint: "온도 차가 클수록 처음의 열전달률이 큽니다." },
  ],
  variables: [
    { key: "hotTemp", label: "뜨거운 물체 초기온도", shortLabel: "뜨거운T", unit: "°C", min: 20, max: 180, step: 5, default: 90, digits: 0 },
    { key: "coldTemp", label: "차가운 물체 초기온도", shortLabel: "차가운T", unit: "°C", min: -20, max: 60, step: 5, default: 20, digits: 0 },
    { key: "hotMass", label: "뜨거운 물체 질량", shortLabel: "뜨거운m", unit: "g", min: 50, max: 1000, step: 50, default: 300, digits: 0 },
    { key: "coldMass", label: "차가운 물체 질량", shortLabel: "차가운m", unit: "g", min: 50, max: 1000, step: 50, default: 500, digits: 0 },
    { key: "hotMaterial", label: "뜨거운 물체 재료", default: "water", options: [{ value: "water", label: "물 · 4.18 J/(g·K)" }, { value: "aluminum", label: "알루미늄 · 0.90" }, { value: "copper", label: "구리 · 0.385" }, { value: "oil", label: "식용유 · 1.97" }] },
    { key: "coldMaterial", label: "차가운 물체 재료", default: "water", options: [{ value: "water", label: "물 · 4.18 J/(g·K)" }, { value: "aluminum", label: "알루미늄 · 0.90" }, { value: "copper", label: "구리 · 0.385" }, { value: "oil", label: "식용유 · 1.97" }] },
    { key: "conductance", label: "열접촉 세기", shortLabel: "접촉", unit: "W/K", min: 2, max: 80, step: 2, default: 24, digits: 0, depth: "H1" },
    { key: "ambientLoss", label: "주변으로의 열손실", shortLabel: "외부손실", unit: "%", min: 0, max: 30, step: 1, default: 0, digits: 0, depth: "H2" },
  ],
  outputs: [
    { key: "equilibrium", label: "이상적 평형온도", shortLabel: "평형T", unit: "°C", digits: 1, classMetric: true },
    { key: "hotNow", label: "뜨거운 쪽 현재온도", unit: "°C", digits: 1 },
    { key: "coldNow", label: "차가운 쪽 현재온도", unit: "°C", digits: 1 },
    { key: "heatMoved", label: "이동한 열에너지", unit: "kJ", digits: 2 },
    { key: "timeConstant", label: "평형 접근 시간상수", unit: "s", digits: 1, depth: "H1" },
  ],
  prediction: { question: "두 물체가 도달할 평형 온도는?", min: -20, max: 180, step: 5, unit: "°C", default: 60, digits: 0 },
  missions: [
    { id: "coffee", title: "커피를 언제 섞을까", question: "뜨거운 커피에 찬 우유을 지금 넣는 것과 나중에 넣는 상황을 열평형 관점에서 토론하세요.", preset: { hotTemp: 85, coldTemp: 5, hotMass: 300, coldMass: 80, hotMaterial: "water", coldMaterial: "water", conductance: 32, ambientLoss: 8 }, view: "curve" },
    { id: "metal", title: "가짜 금속 감별", question: "같은 질량·온도의 구리와 알루미늄을 물에 넣어 평형온도로 재료를 구별하세요.", preset: { hotTemp: 120, coldTemp: 20, hotMass: 200, coldMass: 500, hotMaterial: "copper", coldMaterial: "water", conductance: 40, ambientLoss: 0 }, view: "calorimeter" },
    { id: "survival", title: "저체온 구조팩 설계", question: "총질량 700 g 안에서 35~42 °C의 안전한 평형온도를 만드는 조합을 찾으세요.", preset: { hotTemp: 95, coldTemp: 10, hotMass: 250, coldMass: 450, hotMaterial: "water", coldMaterial: "water", conductance: 18, ambientLoss: 5 }, view: "particles" },
  ],
  theory: [
    { id: "temp", title: "온도는 에너지의 양이 아니다", summary: "온도는 입자 운동의 평균적 세기와 관계되지만 전체 열에너지는 질량과 물질의 비열에도 좌우됩니다.", formula: "Q = mcΔT", points: ["작은 뜨거운 금속보다 큰 미지근한 물이 더 많은 에너지를 가질 수 있습니다.", "비열이 큰 물질은 같은 에너지를 받아도 온도가 덜 변합니다."], example: "바다는 낮 동안 많은 에너지를 받아도 육지보다 천천히 데워집니다." },
    { id: "balance", title: "열평형의 에너지 보존", summary: "고립된 두 물체가 접촉하면 뜨거운 쪽이 잃은 에너지와 차가운 쪽이 얻은 에너지가 같습니다.", formula: "mₕcₕ(Tₕ−Tₑ) = m𝚌c𝚌(Tₑ−T𝚌)", points: ["평형온도는 두 초기온도의 단순 평균이 아닐 수 있습니다.", "열은 온도가 높은 곳에서 낮은 곳으로 자발적으로 이동합니다."], depth: "M2" },
    { id: "rate", title: "평형값과 속도는 다르다", summary: "열접촉 세기는 평형에 도달하는 속도를 바꾸지만, 외부 손실이 없다면 이상적 평형온도 자체는 바꾸지 않습니다.", formula: "dQ/dt ≈ K(Tₕ−T𝚌)", points: ["처음 온도 차가 클 때 변화가 빠르고 평형에 가까워질수록 느려집니다.", "주변과 에너지를 주고받으면 닫힌계 에너지 보존식만으로는 충분하지 않습니다."], depth: "H1" },
  ],
  compute(v, time) {
    const c = { water: 4.18, aluminum: 0.9, copper: 0.385, oil: 1.97 };
    const ch = c[v.hotMaterial]; const cc = c[v.coldMaterial]; const Ch = Number(v.hotMass) * ch; const Cc = Number(v.coldMass) * cc;
    const idealEq = (Ch * Number(v.hotTemp) + Cc * Number(v.coldTemp)) / (Ch + Cc);
    const lossFraction = Number(v.ambientLoss || 0) / 100; const equilibrium = idealEq - lossFraction * Math.max(0, idealEq - 20);
    const conductance = Number(v.conductance || 24); const timeConstant = (Ch * Cc / (Ch + Cc)) / conductance;
    const factor = 1 - Math.exp(-time / Math.max(0.4, timeConstant));
    const hotNow = Number(v.hotTemp) + (equilibrium - Number(v.hotTemp)) * factor;
    const coldNow = Number(v.coldTemp) + (equilibrium - Number(v.coldTemp)) * factor;
    const heatMoved = Math.abs(Ch * (hotNow - Number(v.hotTemp))) / 1000;
    return { equilibrium, idealEq, hotNow, coldNow, heatMoved, timeConstant, factor, Ch, Cc };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(52);
    if (view === "curve") {
      const b = { x: 68, y: 70, w: g.width - 120, h: g.height - 150 }; g.axes(b, { x: "시간", y: "온도" });
      const minT = Math.min(Number(v.coldTemp), r.equilibrium) - 10; const maxT = Math.max(Number(v.hotTemp), r.equilibrium) + 10;
      const lineFor = (hot) => points(0, 20, 80, (t) => { const rr = thermalLab.compute(v, t); const temp = hot ? rr.hotNow : rr.coldNow; return [b.x + t / 20 * b.w, b.y + b.h - (temp - minT) / (maxT - minT) * b.h]; });
      g.polyline(lineFor(true), g.accent, 3); g.polyline(lineFor(false), g.ink, 3);
      g.line(b.x, b.y + b.h - (r.equilibrium - minT) / (maxT - minT) * b.h, b.x + b.w, b.y + b.h - (r.equilibrium - minT) / (maxT - minT) * b.h, g.muted, 1, [6, 5]);
      g.text("뜨거운 쪽", b.x + 18, b.y + 18, { color: g.accent }); g.text("차가운 쪽", b.x + 18, b.y + 40, { color: g.ink }); return;
    }
    const gap = 28; const vesselW = Math.min(240, (g.width - 130) / 2); const x1 = g.width / 2 - vesselW - gap / 2; const x2 = g.width / 2 + gap / 2; const y = 110; const h = 260;
    [[x1, r.hotNow, Number(v.hotMass), true], [x2, r.coldNow, Number(v.coldMass), false]].forEach(([x, temp, mass, hot], side) => {
      g.rect(x, y, vesselW, h, rgba(hot ? g.accent : g.ink, 0.07), hot ? g.accent : g.ink, 2);
      const fillH = map(Number(mass), 50, 1000, h * 0.25, h * 0.86);
      g.rect(x + 8, y + h - fillH - 8, vesselW - 16, fillH, rgba(hot ? g.accent : g.ink, hot ? 0.3 : 0.18), null);
      g.text(`${Number(temp).toFixed(1)} °C`, x + vesselW / 2, y + 34, { align: "center", color: hot ? g.accent : g.ink, size: 18, weight: 700 });
      if (view === "particles") {
        const random = math.seeded(side + 71);
        for (let i = 0; i < 28; i += 1) {
          const px = x + 18 + random() * (vesselW - 36); const py = y + h - fillH + 8 + random() * (fillH - 28);
          const jitter = (time * (0.4 + Math.max(0, Number(temp)) / 80) + i) % 1;
          g.circle(px + Math.sin(jitter * TAU) * 5, py + Math.cos(jitter * TAU) * 5, 3, hot ? g.accent : g.ink);
        }
      }
    });
    g.arrow(x1 + vesselW + 3, y + h / 2, x2 - 3, y + h / 2, r.hotNow > r.coldNow + 0.2 ? g.accent : g.muted, 3);
    g.text(`${r.heatMoved.toFixed(2)} kJ 이동`, g.width / 2, y + h / 2 - 18, { align: "center", color: g.accent });
  },
  chart(v) {
    return { xLabel: "시간 (s)", yLabel: "온도 (°C)", series: [
      { points: points(0, 20, 81, (t) => ({ x: t, y: thermalLab.compute(v, t).hotNow })) },
      { points: points(0, 20, 81, (t) => ({ x: t, y: thermalLab.compute(v, t).coldNow })), opacity: 0.52 },
    ] };
  },
  caption(r) { return `현재 온도 차 ${(r.hotNow - r.coldNow).toFixed(1)} °C · 이상적 평형 ${r.idealEq.toFixed(1)} °C. 접촉 세기는 도달 속도를 바꾸며 외부 손실은 최종값도 바꿉니다.`; },
  limit: "각 물체의 온도가 내부에서 균일하다고 보고 비열을 상수로 둡니다. 상변화, 증발, 복사와 용기의 열용량은 기본 모형에서 생략합니다.",
};

export const opticsLab = {
  id: "optics-wave-lab",
  title: "빛·파동·영상 실험실",
  subtitle: "광선 모형과 파동 모형을 오가며 렌즈의 상과 이중슬릿 무늬가 언제 필요한지 비교합니다.",
  theme: { primary: "#101B27", secondary: "#80E8FF" },
  duration: 8,
  views: [
    { id: "lens", label: "렌즈 광선", hint: "대표 광선의 교점이 스크린에 맺히는 상의 위치를 예측합니다." },
    { id: "wave", label: "파면", hint: "렌즈를 지난 파면이 모이거나 퍼지는 과정을 봅니다." },
    { id: "interference", label: "이중슬릿", hint: "두 경로의 위상차가 밝고 어두운 무늬를 만듭니다." },
    { id: "sandbox", label: "자유 광학 벤치", hint: "광원·렌즈·거울·스크린을 놓아 빛의 경로를 직접 설계합니다." },
  ],
  variables: [
    { key: "focal", label: "렌즈 초점거리", shortLabel: "초점", unit: "cm", min: -30, max: 30, step: 1, default: 12, digits: 0 },
    { key: "objectDistance", label: "물체 거리", shortLabel: "물체d", unit: "cm", min: 3, max: 80, step: 1, default: 28, digits: 0 },
    { key: "objectHeight", label: "물체 높이", unit: "cm", min: 1, max: 12, step: 0.5, default: 6, digits: 1 },
    { key: "wavelength", label: "빛의 파장", shortLabel: "파장", unit: "nm", min: 400, max: 700, step: 10, default: 540, digits: 0 },
    { key: "slitGap", label: "슬릿 사이 간격", shortLabel: "슬릿d", unit: "mm", min: 0.05, max: 0.6, step: 0.01, default: 0.18, digits: 2 },
    { key: "screenDistance", label: "스크린 거리", shortLabel: "스크린L", unit: "m", min: 0.5, max: 5, step: 0.1, default: 2, digits: 1 },
  ],
  outputs: [
    { key: "imageDistance", label: "상의 거리", shortLabel: "상거리", unit: "cm", digits: 1, classMetric: true },
    { key: "magnification", label: "배율", unit: "배", digits: 2 },
    { key: "imageHeight", label: "상의 높이", unit: "cm", digits: 1 },
    { key: "fringeSpacing", label: "간섭무늬 간격", shortLabel: "무늬간격", unit: "mm", digits: 2 },
    { key: "opticalPower", label: "렌즈 굴절력", unit: "D", digits: 2, depth: "H1" },
  ],
  prediction: { question: "스크린/상까지의 거리는?", min: -100, max: 120, step: 5, unit: "cm", default: 20, digits: 0 },
  missions: [
    { id: "camera", title: "스마트폰 카메라 초점", question: "멀리 있는 물체와 가까운 물체를 선명하게 만들 때 센서는 어느 방향으로 움직여야 할까요?", preset: { focal: 8, objectDistance: 60, objectHeight: 6, wavelength: 540, slitGap: 0.18, screenDistance: 2 }, view: "lens" },
    { id: "projector", title: "교실 프로젝터 크게 만들기", question: "정립/도립과 확대 조건을 고려해 벽에 3배 이상 큰 실상을 만드는 거리 조합을 찾으세요.", preset: { focal: 12, objectDistance: 17, objectHeight: 5, wavelength: 540, slitGap: 0.18, screenDistance: 2 }, view: "wave" },
    { id: "hair", title: "레이저로 머리카락 굵기 재기", question: "무늬 간격과 스크린 거리로 매우 작은 간격을 역추론하는 방법을 설계하세요.", preset: { focal: 12, objectDistance: 28, objectHeight: 6, wavelength: 650, slitGap: 0.08, screenDistance: 3 }, view: "interference" },
    { id: "color", title: "색에 따라 무늬가 이동할까", question: "빨강과 보라의 간섭무늬 간격을 A/B로 비교하고 비율을 설명하세요.", preset: { focal: 12, objectDistance: 28, objectHeight: 6, wavelength: 400, slitGap: 0.2, screenDistance: 2 }, view: "interference" },
  ],
  theory: [
    { id: "rays", title: "광선은 진행 방향의 모형", summary: "빛의 파장이 장치보다 훨씬 작을 때 직선과 굴절 광선으로 상 형성을 편리하게 설명할 수 있습니다.", formula: "1/f = 1/dₒ + 1/dᵢ", points: ["볼록렌즈에서 물체가 초점 밖에 있으면 반대편에 실상이 생깁니다.", "초점 안에 있으면 dᵢ가 음수가 되어 물체와 같은 쪽의 허상을 뜻합니다."], example: "카메라 센서는 빛이 실제로 모이는 실상 위치에 놓여야 합니다." },
    { id: "magnify", title: "배율의 부호까지 읽기", summary: "상의 크기는 거리비로 결정됩니다. 음의 배율은 상이 뒤집혔음을, 양의 배율은 바로 섰음을 뜻합니다.", formula: "m = hᵢ/hₒ = −dᵢ/dₒ", points: ["배율의 절댓값이 1보다 크면 확대입니다.", "렌즈식의 부호 규칙을 바꾸면 모든 거리 부호를 일관되게 바꿔야 합니다."], depth: "M2" },
    { id: "wave", title: "겹친 빛의 위상", summary: "슬릿 두 곳에서 나온 파동이 같은 위상으로 만나면 밝아지고 반대 위상으로 만나면 어두워집니다.", formula: "Δy ≈ λL/d", points: ["파장이 길거나 스크린이 멀수록 무늬 간격이 넓어집니다.", "슬릿 간격이 넓을수록 경로차가 빨리 변해 무늬가 촘촘해집니다."], depth: "H1", example: "CD 표면의 미세한 홈도 파장별로 다른 방향의 보강간섭을 만들어 무지개를 보입니다." },
  ],
  compute(v, time, view, depth, sandbox) {
    let f = Number(v.focal); let objectDistance = Number(v.objectDistance);
    if (view === "sandbox" && sandbox?.items?.length) {
      const source = sandbox.items.find((item) => item.type === "source"); const lens = sandbox.items.find((item) => item.type === "convex" || item.type === "concave");
      if (source && lens) { objectDistance = Math.max(2, (lens.x - source.x) * 100); f = lens.focal * (lens.type === "concave" ? -1 : 1); }
    }
    const denominator = 1 / f - 1 / objectDistance;
    const imageDistance = Math.abs(denominator) < 1e-6 ? 999 : 1 / denominator; const magnification = -imageDistance / objectDistance;
    const imageHeight = magnification * Number(v.objectHeight); const fringeSpacing = Number(v.wavelength) * 1e-9 * Number(v.screenDistance) / (Number(v.slitGap) * 1e-3) * 1000;
    return { imageDistance, magnification, imageHeight, fringeSpacing, opticalPower: 100 / f, real: imageDistance > 0, converging: f > 0 };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(50); const axisY = g.height / 2;
    if (view === "sandbox") return;
    if (view === "interference") {
      const barrierX = g.width * 0.28; const screenX = g.width * 0.8; const slitSep = map(Number(v.slitGap), 0.05, 0.6, 20, 90);
      g.line(barrierX, 45, barrierX, axisY - slitSep / 2 - 7, g.ink, 5); g.line(barrierX, axisY - slitSep / 2 + 7, barrierX, axisY + slitSep / 2 - 7, g.ink, 5); g.line(barrierX, axisY + slitSep / 2 + 7, barrierX, g.height - 45, g.ink, 5);
      g.line(screenX, 45, screenX, g.height - 45, g.ink, 3);
      for (let band = -7; band <= 7; band += 1) {
        const y = axisY + band * map(r.fringeSpacing, 1, 30, 7, 28); const intensity = 0.25 + 0.65 * Math.exp(-Math.abs(band) / 9);
        g.rect(screenX - 8, y - 4, 18, 8, rgba(g.accent, intensity), null);
        g.line(barrierX, axisY - slitSep / 2, screenX - 8, y, rgba(g.accent, 0.15), 1);
        g.line(barrierX, axisY + slitSep / 2, screenX - 8, y, rgba(g.accent, 0.15), 1);
      }
      for (let radius = 16; radius < screenX - barrierX; radius += 24) { g.circle(barrierX, axisY - slitSep / 2, radius + (time * 30) % 24, null, rgba(g.accent, 0.18)); g.circle(barrierX, axisY + slitSep / 2, radius + (time * 30) % 24, null, rgba(g.accent, 0.18)); }
      g.text(`Δy ${r.fringeSpacing.toFixed(2)} mm`, screenX, 30, { align: "center", color: g.accent, size: 15 }); return;
    }
    const lensX = g.width * 0.52; const scale = Math.min(6, (g.width * 0.42) / Math.max(40, Number(v.objectDistance), Math.min(100, Math.abs(r.imageDistance))));
    const objectX = lensX - Number(v.objectDistance) * scale; const objectTop = axisY - Number(v.objectHeight) * scale;
    g.line(30, axisY, g.width - 30, axisY, g.muted, 1); g.line(lensX, 70, lensX, g.height - 70, g.accent, 4);
    const fOffset = Math.abs(Number(v.focal)) * scale; [lensX - fOffset, lensX + fOffset].forEach((x) => { g.line(x, axisY - 7, x, axisY + 7, g.accent, 2); g.text("F", x, axisY + 25, { align: "center", color: g.accent }); });
    g.arrow(objectX, axisY, objectX, objectTop, g.ink, 3); g.text("물체", objectX, axisY + 28, { align: "center", color: g.ink });
    const cappedImage = clamp(r.imageDistance, -100, 100); const imageX = lensX + cappedImage * scale; const imageTop = axisY - clamp(r.imageHeight, -24, 24) * scale;
    if (view === "wave") {
      for (let offset = -90; offset <= 90; offset += 30) {
        const startY = axisY + offset; g.line(objectTop, objectX, lensX, startY, rgba(g.accent, 0.32), 1); g.line(lensX, startY, imageX, imageTop, rgba(g.accent, 0.58), 1);
      }
    } else {
      g.polyline([[objectX, objectTop], [lensX, objectTop], [imageX, imageTop]], g.accent, 2);
      g.polyline([[objectX, objectTop], [lensX, axisY], [imageX, imageTop]], g.ink, 2);
    }
    g.arrow(imageX, axisY, imageX, imageTop, r.real ? g.accent : g.muted, 3); g.text(r.real ? "실상" : "허상", imageX, axisY + 28, { align: "center", color: r.real ? g.accent : g.muted });
  },
  chart(v, r, view) {
    if (view === "interference") return { xLabel: "스크린 위치 (mm)", yLabel: "상대 밝기", xDomain: [-20, 20], yDomain: [0, 1.1], series: [{ points: points(-20, 20, 180, (y) => ({ x: y, y: Math.cos(Math.PI * y / Math.max(0.1, r.fringeSpacing)) ** 2 })) }] };
    return { xLabel: "물체 거리 dₒ (cm)", yLabel: "상 거리 dᵢ (cm)", yDomain: [-100, 100], series: [{ points: points(3, 80, 160, (distance) => ({ x: distance, y: clamp(1 / (1 / Number(v.focal) - 1 / distance), -100, 100) })) }] };
  },
  caption(r, v, view) { return view === "interference" ? `파장 ${v.wavelength} nm에서 중앙 이웃 밝은 무늬 간격은 약 ${r.fringeSpacing.toFixed(2)} mm입니다.` : `${r.real ? "렌즈 반대편에 맺히는 실상" : "물체 쪽에서 보이는 허상"} · 배율 ${r.magnification.toFixed(2)}배, ${r.magnification < 0 ? "도립" : "정립"}.`; },
  sandbox: {
    view: "sandbox",
    title: "자유 광학 벤치",
    instructions: "광원 왼쪽부터 렌즈와 스크린을 배치하세요. 부품 위치가 광학축 거리이며 스크린과 계산된 상 위치의 오차를 줄이는 것이 목표입니다.",
    parts: [
      { type: "source", label: "화살표 광원", icon: "↑", max: 1 },
      { type: "convex", label: "볼록렌즈 +12", icon: ")(", max: 3, defaults: { focal: 12 } },
      { type: "concave", label: "오목렌즈 −10", icon: "()", max: 3, defaults: { focal: 10 } },
      { type: "mirror", label: "평면거울", icon: "▌", max: 3 },
      { type: "screen", label: "스크린", icon: "│", max: 2 },
    ],
    initial: [{ type: "source", x: 0.2, y: 0.55 }, { type: "convex", x: 0.48, y: 0.5, focal: 12 }, { type: "screen", x: 0.75, y: 0.5 }],
    canLink() { return false; },
    evaluate(sandbox) {
      const source = sandbox.items.find((item) => item.type === "source"); const lens = sandbox.items.find((item) => /convex|concave/.test(item.type)); const screen = sandbox.items.find((item) => item.type === "screen");
      if (!source || !lens || !screen) return { valid: false, summary: "광원·렌즈·스크린을 각각 하나 이상 놓으세요." };
      const objectDistance = Math.max(2, (lens.x - source.x) * 100); const f = lens.focal * (lens.type === "concave" ? -1 : 1); const imageDistance = 1 / (1 / f - 1 / objectDistance);
      const target = lens.x + imageDistance / 100; const error = Math.abs(screen.x - target) * 100;
      return { valid: error < 3 && imageDistance > 0, summary: imageDistance > 0 ? `스크린 초점 오차 ${error.toFixed(1)} cm${error < 3 ? " · 선명한 실상" : ""}` : "이 배치에서는 스크린에 맺히는 실상이 없습니다." };
    },
    draw(g, sandbox, result, time, ui) {
      const axisY = g.height * 0.56; g.line(40, axisY, g.width - 40, axisY, g.muted, 1);
      const source = sandbox.items.find((item) => item.type === "source"); const lenses = sandbox.items.filter((item) => /convex|concave/.test(item.type)).sort((a, b) => a.x - b.x);
      if (source && lenses[0]) {
        const lens = lenses[0]; const sx = source.x * g.width; const lx = lens.x * g.width; const objectTop = axisY - 70; const imageX = lx + result.imageDistance / 100 * g.width;
        [[objectTop, objectTop], [objectTop, axisY]].forEach(([startY, lensY]) => { g.polyline([[sx, startY], [lx, lensY], [imageX, axisY + (lensY - objectTop) * 1.2]], rgba(g.accent, 0.7), 2); });
      }
      sandbox.items.forEach((item) => {
        const x = item.x * g.width; const selected = item.id === ui.selected; const color = selected ? g.ink : g.accent;
        if (item.type === "source") { g.arrow(x, axisY, x, axisY - 70, color, 3); }
        else if (item.type === "convex") { g.polyline([[x - 9, axisY - 82], [x + 9, axisY - 62], [x + 9, axisY + 62], [x - 9, axisY + 82]], color, selected ? 4 : 2); }
        else if (item.type === "concave") { g.polyline([[x + 9, axisY - 82], [x - 9, axisY - 62], [x - 9, axisY + 62], [x + 9, axisY + 82]], color, selected ? 4 : 2); }
        else if (item.type === "mirror") { g.line(x, axisY - 90, x, axisY + 90, color, selected ? 6 : 3); }
        else if (item.type === "screen") { g.line(x, axisY - 100, x, axisY + 100, color, selected ? 6 : 3); g.text("스크린", x, axisY + 120, { align: "center", color: g.muted }); }
        g.text(item.label, x, axisY - 100, { align: "center", color: g.muted, size: 10 });
      });
    },
  },
  limit: "얇은 렌즈, 근축광선, 단색광과 매우 좁은 슬릿을 가정합니다. 실제 렌즈의 수차, 회절 한계, 광원 폭, 편광과 센서 해상도는 생략합니다.",
};

export const gasLab = {
  id: "gas-particle-lab",
  title: "기체 입자·상태 실험실",
  subtitle: "보이지 않는 입자 충돌을 압력·온도·분포라는 관측량과 연결합니다.",
  theme: { primary: "#152035", secondary: "#B8A1FF" },
  duration: 10,
  views: [
    { id: "box", label: "입자 상자", hint: "벽과 충돌할 때 운동량 변화가 압력을 만듭니다." },
    { id: "piston", label: "피스톤", hint: "부피를 줄이면 같은 입자들이 더 자주 벽과 충돌합니다." },
    { id: "distribution", label: "속력 분포", hint: "온도는 모든 입자의 같은 속력이 아니라 분포의 변화입니다." },
  ],
  variables: [
    { key: "temperature", label: "절대온도", shortLabel: "온도", unit: "K", min: 100, max: 900, step: 20, default: 300, digits: 0 },
    { key: "volume", label: "용기 부피", shortLabel: "부피", unit: "L", min: 1, max: 20, step: 0.5, default: 8, digits: 1 },
    { key: "amount", label: "기체 양", shortLabel: "물질량", unit: "mol", min: 0.05, max: 2, step: 0.05, default: 0.4, digits: 2 },
    { key: "molarMass", label: "분자 종류", shortLabel: "분자", default: "0.028", options: [{ value: "0.004", label: "헬륨 He" }, { value: "0.028", label: "질소 N₂" }, { value: "0.032", label: "산소 O₂" }, { value: "0.044", label: "이산화탄소 CO₂" }] },
    { key: "realGas", label: "분자 간 인력 보정", shortLabel: "인력", unit: "%", min: 0, max: 35, step: 1, default: 0, digits: 0, depth: "H2" },
  ],
  outputs: [
    { key: "pressure", label: "압력", shortLabel: "압력", unit: "kPa", digits: 1, classMetric: true },
    { key: "rmsSpeed", label: "제곱평균제곱근 속력", shortLabel: "vᵣₘₛ", unit: "m/s", digits: 0 },
    { key: "density", label: "질량 밀도", unit: "g/L", digits: 2 },
    { key: "collisions", label: "상대 충돌 빈도", unit: "회/s", digits: 0 },
    { key: "compressibility", label: "압축성 계수 Z", unit: "", digits: 3, depth: "H2" },
  ],
  prediction: { question: "용기 압력은 얼마일까?", min: 0, max: 1000, step: 25, unit: "kPa", default: 125, digits: 0 },
  missions: [
    { id: "tire", title: "여름 타이어 압력 경보", question: "부피와 기체 양이 고정일 때 290 K에서 340 K로 오르면 압력이 몇 % 변할까요?", preset: { temperature: 290, volume: 8, amount: 0.4, molarMass: "0.028", realGas: 0 }, view: "box" },
    { id: "syringe", title: "막힌 주사기 밀기", question: "온도를 일정하게 두고 부피를 절반으로 하면 압력은 정확히 두 배일까요?", preset: { temperature: 300, volume: 12, amount: 0.2, molarMass: "0.028", realGas: 0 }, view: "piston" },
    { id: "escape", title: "가벼운 기체는 왜 잘 탈출할까", question: "같은 온도에서 헬륨과 이산화탄소의 속력 분포를 A/B로 비교하세요.", preset: { temperature: 500, volume: 10, amount: 0.3, molarMass: "0.004", realGas: 0 }, view: "distribution" },
    { id: "habitat", title: "화성 기지 공기 설계", question: "부피 15 L 실험 모형에서 80~120 kPa를 만들며 입자 수를 최소화하세요.", preset: { temperature: 295, volume: 15, amount: 0.5, molarMass: "0.032", realGas: 5 }, view: "box" },
  ],
  theory: [
    { id: "pressure", title: "압력은 충돌의 집단 결과", summary: "기체 입자가 벽에 부딪혀 방향을 바꿀 때 벽에 운동량을 전달합니다. 매우 많은 충돌의 평균이 압력입니다.", formula: "P = F/A", points: ["입자 하나의 경로는 불규칙하지만 전체 압력은 안정적으로 측정됩니다.", "입자가 많거나 빠르고, 공간이 작을수록 단위 시간 충돌이 늘어납니다."], example: "공기주입기 손잡이가 뜨거워지는 것은 압축하며 기체에 일을 했기 때문입니다." },
    { id: "ideal", title: "상태방정식의 비례", summary: "충분히 묽은 기체는 종류와 무관하게 압력·부피·물질량·절대온도의 간단한 관계를 따릅니다.", formula: "PV = nRT", points: ["온도 비례식에는 섭씨가 아니라 절대온도 K를 써야 합니다.", "한 변수의 효과를 보려면 다른 두 상태 변수를 고정해야 합니다."], depth: "M2" },
    { id: "distribution", title: "온도는 속력의 분포", summary: "같은 온도에서도 분자 속력은 다양합니다. 온도가 높으면 분포가 넓고 빠른 쪽으로 이동하며, 무거운 분자는 같은 온도에서 더 느립니다.", formula: "vᵣₘₛ = √(3RT/M)", points: ["온도 2배가 속력 2배를 뜻하지 않고 √2배를 뜻합니다.", "고밀도·저온에서는 분자 크기와 인력을 무시한 이상기체 모형이 어긋납니다."], depth: "H1" },
  ],
  compute(v) {
    const R = 8.314; const T = Number(v.temperature); const V = Number(v.volume) / 1000; const n = Number(v.amount); const M = Number(v.molarMass);
    const idealPressure = n * R * T / V / 1000; const attraction = Number(v.realGas || 0) / 100; const compressibility = 1 - attraction * clamp(n / Number(v.volume), 0, 1.5) * 0.45;
    const pressure = idealPressure * compressibility; const rmsSpeed = Math.sqrt(3 * R * T / M); const density = n * M * 1000 / Number(v.volume);
    const collisions = n * 1000 * rmsSpeed / Math.cbrt(Number(v.volume)) * 0.013;
    return { pressure, idealPressure, rmsSpeed, density, collisions, compressibility };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(52);
    if (view === "distribution") {
      const b = { x: 62, y: 62, w: g.width - 110, h: g.height - 135 }; g.axes(b, { x: "분자 속력", y: "분자 비율" });
      const peak = r.rmsSpeed * Math.sqrt(2 / 3); const curve = points(0, r.rmsSpeed * 2.6, 130, (speed) => { const shape = speed ** 2 * Math.exp(-1.5 * speed ** 2 / r.rmsSpeed ** 2); return [b.x + speed / (r.rmsSpeed * 2.6) * b.w, b.y + b.h - shape / (peak ** 2 * Math.exp(-1.5 * peak ** 2 / r.rmsSpeed ** 2)) * b.h * 0.72]; });
      g.polyline(curve, g.accent, 3); g.line(b.x + r.rmsSpeed / (r.rmsSpeed * 2.6) * b.w, b.y, b.x + r.rmsSpeed / (r.rmsSpeed * 2.6) * b.w, b.y + b.h, g.muted, 1, [5, 4]);
      g.text(`vᵣₘₛ ${r.rmsSpeed.toFixed(0)} m/s`, b.x + b.w * 0.385, b.y + 20, { color: g.accent }); return;
    }
    const fraction = map(Number(v.volume), 1, 20, 0.28, 0.82); const boxW = g.width * fraction; const x = (g.width - boxW) / 2; const top = 80; const bottom = g.height - 90;
    g.rect(x, top, boxW, bottom - top, rgba(g.accent, 0.04), g.accent, 2);
    if (view === "piston") { g.rect(x - 16, top - 12, boxW + 32, 22, rgba(g.ink, 0.18), g.ink, 2); g.arrow(g.width / 2, 30, g.width / 2, top - 16, g.accent, 3); }
    const count = clamp(Math.round(Number(v.amount) * 42), 8, 80); const random = math.seeded(938);
    for (let i = 0; i < count; i += 1) {
      const baseX = random(); const baseY = random(); const phase = time * (0.6 + r.rmsSpeed / 800) + i * 2.37;
      const px = x + 12 + ((baseX + Math.sin(phase) * 0.08 + 2) % 1) * (boxW - 24); const py = top + 12 + ((baseY + Math.cos(phase * 1.13) * 0.1 + 2) % 1) * (bottom - top - 24);
      g.circle(px, py, 3.5, g.accent);
    }
    g.text(`${r.pressure.toFixed(1)} kPa`, g.width / 2, bottom + 38, { align: "center", color: g.accent, size: 19, weight: 700 });
    g.text(`${v.temperature} K · ${v.amount} mol`, g.width / 2, 50, { align: "center", color: g.ink, size: 14 });
  },
  chart(v, r, view) {
    if (view === "distribution") {
      return { xLabel: "속력 (m/s)", yLabel: "상대 빈도", series: [{ points: points(0, r.rmsSpeed * 2.6, 130, (speed) => ({ x: speed, y: speed ** 2 * Math.exp(-1.5 * speed ** 2 / r.rmsSpeed ** 2) })) }] };
    }
    return { xLabel: "부피 (L)", yLabel: "압력 (kPa)", series: [{ points: points(1, 20, 100, (volume) => ({ x: volume, y: Number(v.amount) * 8.314 * Number(v.temperature) / (volume / 1000) / 1000 })) }] };
  },
  caption(r, v, view) { return view === "distribution" ? `평균 하나가 아니라 넓은 속력 분포가 존재합니다. 현재 vᵣₘₛ는 ${r.rmsSpeed.toFixed(0)} m/s입니다.` : `압력 ${r.pressure.toFixed(1)} kPa는 수많은 벽 충돌의 평균입니다. 입자 그림의 개수와 크기는 실제 축척이 아닙니다.`; },
  limit: "기본 계산은 입자 부피와 인력을 무시한 이상기체를 사용합니다. 인력 보정은 경향 학습용이며 실제 반데르발스 상수나 액화·화학반응을 재현하지 않습니다.",
};
