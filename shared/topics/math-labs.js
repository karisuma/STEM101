import { math } from "../lab-runtime.js";

const { clamp, lerp, map, TAU } = math;
const points = (start, end, count, fn) => Array.from({ length: count }, (_, index) => { const x = lerp(start, end, index / Math.max(1, count - 1)); return fn(x, index); });
function rgba(hex, alpha) { const raw = hex.replace("#", ""); const value = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw; const n = Number.parseInt(value, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; }

function bernoulliSample(probability, count, seed) {
  const random = math.seeded(seed); const values = Array.from({ length: count }, () => random() < probability ? 1 : 0); let longest = 0; let current = 0;
  values.forEach((value) => { current = value ? current + 1 : 0; longest = Math.max(longest, current); });
  return { values, successes: values.reduce((sum, value) => sum + value, 0), longest };
}

export const probabilityLab = {
  id: "probability-statistics-lab",
  title: "확률·표본·추론 실험실",
  subtitle: "이론 확률 하나가 실제 작은 표본에서 얼마나 흔들리는지 반복 시행과 학급 분포로 판단합니다.",
  theme: { primary: "#25142D", secondary: "#51DCC0" },
  duration: 10,
  views: [
    { id: "sequence", label: "시행 열", hint: "무작위 결과에는 군집과 연속 성공이 자연스럽게 나타납니다." },
    { id: "convergence", label: "누적 비율", hint: "시행 수가 늘수록 흔들림의 폭이 줄지만 매끈하게 접근하지는 않습니다." },
    { id: "sampling", label: "표본분포", hint: "같은 크기의 표본을 많이 뽑으면 표본비율 자체도 하나의 분포를 만듭니다." },
  ],
  variables: [
    { key: "scenario", label: "실험 맥락", shortLabel: "맥락", default: "loot", options: [{ value: "coin", label: "편향 동전" }, { value: "loot", label: "게임 희귀 아이템" }, { value: "test", label: "검사 양성" }, { value: "defect", label: "제품 불량" }] },
    { key: "probability", label: "실제 성공확률 p", shortLabel: "실제p", unit: "%", min: 1, max: 99, step: 1, default: 10, digits: 0 },
    { key: "sampleSize", label: "한 표본의 시행 수 n", shortLabel: "표본수", unit: "회", min: 5, max: 500, step: 5, default: 50, digits: 0 },
    { key: "repetitions", label: "반복 표본 수", shortLabel: "반복", unit: "개", min: 20, max: 500, step: 20, default: 200, digits: 0 },
    { key: "seed", label: "무작위 추첨 번호", shortLabel: "추첨", unit: "", min: 1, max: 999, step: 1, default: 101, digits: 0 },
    { key: "confidence", label: "신뢰수준", shortLabel: "신뢰", default: "0.95", options: [{ value: "0.90", label: "90%" }, { value: "0.95", label: "95%" }, { value: "0.99", label: "99%" }], depth: "H1" },
  ],
  outputs: [
    { key: "observed", label: "관측 성공비율", shortLabel: "관측비율", unit: "%", digits: 1, classMetric: true },
    { key: "successes", label: "성공 횟수", unit: "회", digits: 0 },
    { key: "error", label: "실제확률과 오차", unit: "%p", digits: 1 },
    { key: "longestRun", label: "최장 연속 성공", unit: "회", digits: 0 },
    { key: "margin", label: "근사 오차한계", unit: "%p", digits: 2, depth: "H1" },
  ],
  prediction: { question: "이 표본에서 성공은 몇 %일까?", min: 0, max: 100, step: 5, unit: "%", default: 10, digits: 0 },
  missions: [
    { id: "loot", title: "10% 뽑기 10번이면 반드시?", question: "성공확률 10%를 10번 시도하면 반드시 한 번 나온다는 주장을 여러 추첨 번호로 반박하세요.", preset: { scenario: "loot", probability: 10, sampleSize: 10, repetitions: 300, seed: 101, confidence: "0.95" }, view: "sequence" },
    { id: "fair", title: "스트리머의 동전은 조작됐나", question: "60번 중 앞면 39번만으로 p=50%를 의심할 충분한 증거인지 표본분포에서 판단하세요.", preset: { scenario: "coin", probability: 50, sampleSize: 60, repetitions: 400, seed: 327, confidence: "0.95" }, view: "sampling" },
    { id: "quality", title: "불량률 2% 공정 검사", question: "표본 50개와 500개가 만드는 관측 불량률의 흔들림을 A/B로 비교하세요.", preset: { scenario: "defect", probability: 2, sampleSize: 50, repetitions: 400, seed: 61, confidence: "0.95" }, view: "sampling" },
    { id: "streak", title: "연속 성공은 조작의 증거일까", question: "공정한 동전에서도 긴 연속 앞면이 얼마나 자주 나오는지 시행 수를 늘려 관찰하세요.", preset: { scenario: "coin", probability: 50, sampleSize: 200, repetitions: 200, seed: 77, confidence: "0.95" }, view: "sequence" },
  ],
  theory: [
    { id: "random", title: "무작위는 고르게 번갈아가 아니다", summary: "독립 시행에서는 다음 결과를 예측할 규칙이 없다는 뜻이지 짧은 구간이 항상 정확한 비율을 갖는다는 뜻이 아닙니다.", formula: "P(성공)=p, 각 시행은 독립", points: ["앞면이 여러 번 나왔다고 다음에 뒷면이 더 나올 의무는 없습니다.", "군집과 긴 연속은 무작위 자료에서도 자연스럽습니다."], example: "게임 뽑기에서 10%를 10번 시도해 한 번 이상 성공할 확률은 100%가 아니라 1−0.9¹⁰입니다." },
    { id: "large", title: "큰 수의 법칙", summary: "누적 시행 수가 커질수록 관측비율은 실제 확률 근처에 머무는 경향이 강해집니다. 중간 경로는 계속 위아래로 흔들립니다.", formula: "표본비율 p̂ = 성공수/n → p", points: ["큰 수의 법칙은 다음 한 번을 맞힌다는 법칙이 아닙니다.", "희귀 사건은 큰 표본에서도 성공 횟수가 적어 상대 오차가 클 수 있습니다."], depth: "M2" },
    { id: "inference", title: "표본오차의 전형적 크기", summary: "표본비율의 표준오차는 n의 제곱근에 반비례합니다. 오차를 절반으로 줄이려면 표본이 대략 4배 필요합니다.", formula: "SE(p̂)=√(p(1−p)/n)", points: ["신뢰구간은 한 번 만든 특정 구간에 확률 95%로 p가 있다는 단순 문장과 다릅니다.", "무작위 표집이 아니면 표본 수가 커도 편향은 사라지지 않습니다."], depth: "H1" },
  ],
  compute(v) {
    const p = Number(v.probability) / 100; const n = Number(v.sampleSize); const sample = bernoulliSample(p, n, Number(v.seed)); const observed = sample.successes / n * 100;
    const z = Number(v.confidence) === 0.9 ? 1.645 : Number(v.confidence) === 0.99 ? 2.576 : 1.96; const margin = z * Math.sqrt(Math.max(1e-9, observed / 100 * (1 - observed / 100)) / n) * 100;
    const distribution = []; const randomBase = Number(v.seed) * 7919;
    for (let i = 0; i < Number(v.repetitions); i += 1) { const s = bernoulliSample(p, n, randomBase + i * 17); distribution.push(s.successes / n * 100); }
    return { observed, successes: sample.successes, error: observed - p * 100, longestRun: sample.longest, margin, sample: sample.values, distribution, p: p * 100 };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(50);
    if (view === "sequence") {
      const count = r.sample.length; const columns = Math.min(30, Math.ceil(Math.sqrt(count * 1.7))); const gap = Math.min(24, (g.width - 100) / columns); const rows = Math.ceil(count / columns); const startX = (g.width - (columns - 1) * gap) / 2; const startY = Math.max(80, (g.height - (rows - 1) * gap) / 2);
      r.sample.forEach((value, index) => { const x = startX + (index % columns) * gap; const y = startY + Math.floor(index / columns) * gap; g.circle(x, y, Math.max(3, gap * 0.31), value ? g.accent : rgba(g.ink, 0.35)); });
      g.text(`성공 ${r.successes}/${v.sampleSize} · 최장 연속 ${r.longestRun}`, g.width / 2, g.height - 42, { align: "center", color: g.accent, size: 17, weight: 700 }); return;
    }
    if (view === "convergence") {
      const b = { x: 66, y: 60, w: g.width - 120, h: g.height - 135 }; g.axes(b, { x: "누적 시행", y: "성공 비율" }); let sum = 0; const curve = r.sample.map((value, index) => { sum += value; return [b.x + index / Math.max(1, r.sample.length - 1) * b.w, b.y + b.h - (sum / (index + 1)) * b.h]; }); g.polyline(curve, g.accent, 3); g.line(b.x, b.y + b.h * (1 - r.p / 100), b.x + b.w, b.y + b.h * (1 - r.p / 100), g.ink, 1, [6, 5]); g.text(`실제 p=${r.p}%`, b.x + b.w, b.y + b.h * (1 - r.p / 100) - 9, { align: "right", color: g.ink }); return;
    }
    const b = { x: 66, y: 60, w: g.width - 120, h: g.height - 135 }; g.axes(b, { x: "표본 성공비율", y: "빈도" }); const bins = 20; const counts = Array(bins).fill(0); r.distribution.forEach((value) => { const index = clamp(Math.floor(value / 100 * bins), 0, bins - 1); counts[index] += 1; }); const max = Math.max(...counts, 1); counts.forEach((count, index) => { const w = b.w / bins - 2; const h = count / max * b.h; g.rect(b.x + index / bins * b.w + 1, b.y + b.h - h, w, h, rgba(g.accent, 0.62), null); }); const px = b.x + r.observed / 100 * b.w; g.line(px, b.y, px, b.y + b.h, g.ink, 3); g.text(`내 표본 ${r.observed.toFixed(1)}%`, px, b.y - 10, { align: "center", color: g.accent });
  },
  chart(v, r, view) { if (view === "sampling") { const bins = 20; const counts = Array(bins).fill(0); r.distribution.forEach((value) => { counts[clamp(Math.floor(value / 100 * bins), 0, bins - 1)] += 1; }); return { xLabel: "표본비율 (%)", yLabel: "표본 수", xDomain: [0, 100], series: [{ type: "bars", points: counts.map((y, i) => ({ x: (i + 0.5) / bins * 100, y })) }] }; } let sum = 0; return { xLabel: "누적 시행", yLabel: "성공비율 (%)", yDomain: [0, 100], series: [{ points: r.sample.map((value, index) => { sum += value; return { x: index + 1, y: sum / (index + 1) * 100 }; }) }] }; },
  caption(r, v) { return `실제 p=${v.probability}% · 이번 ${v.sampleSize}회 표본은 ${r.observed.toFixed(1)}% · 오차 ${r.error.toFixed(1)}%p. 추첨 번호를 바꾸면 같은 확률의 다른 표본이 됩니다.`; },
  limit: "각 시행이 동일한 확률을 갖고 서로 독립이며 표본이 무작위라는 베르누이 모형을 사용합니다. 실제 게임·검사·공정의 확률 변화, 선택 편향, 다중검정과 인과관계는 별도 분석이 필요합니다.",
};

function standardFunction(v, x) {
  const a = Number(v.a); const h = Number(v.h); const k = Number(v.k); const b = Number(v.b);
  if (v.family === "quadratic") return a * (x - h) ** 2 + k;
  if (v.family === "exponential") return a * (Math.max(0.1, b) ** (x - h)) + k;
  if (v.family === "sine") return a * Math.sin(b * (x - h)) + k;
  return a * (x - h) + k;
}

function sandboxPipeline(sandbox) {
  if (!sandbox?.items?.length) return { valid: false, fn: (x) => x, expression: "x", chain: [] };
  const input = sandbox.items.find((item) => item.type === "input"); const output = sandbox.items.find((item) => item.type === "output"); if (!input || !output) return { valid: false, fn: (x) => x, expression: "x", chain: [] };
  const outgoing = new Map(); sandbox.links.forEach((link) => { if (!outgoing.has(link.from)) outgoing.set(link.from, []); outgoing.get(link.from).push(link.to); });
  const byId = new Map(sandbox.items.map((item) => [item.id, item])); const chain = []; const visited = new Set(); let current = input;
  while (current && current.id !== output.id && !visited.has(current.id) && chain.length < 12) { visited.add(current.id); const nextId = outgoing.get(current.id)?.[0]; current = byId.get(nextId); if (current && current.id !== output.id) chain.push(current); }
  const valid = current?.id === output.id; const operations = { square: { fn: (x) => x ** 2, text: (e) => `(${e})²` }, sin: { fn: (x) => Math.sin(x), text: (e) => `sin(${e})` }, abs: { fn: (x) => Math.abs(x), text: (e) => `|${e}|` }, scale2: { fn: (x) => 2 * x, text: (e) => `2(${e})` }, shift1: { fn: (x) => x + 1, text: (e) => `(${e})+1` }, negate: { fn: (x) => -x, text: (e) => `−(${e})` } };
  const fn = (x) => chain.reduce((value, item) => operations[item.type]?.fn(value) ?? value, x); const expression = chain.reduce((text, item) => operations[item.type]?.text(text) ?? text, "x"); return { valid, fn, expression, chain };
}

export const functionLab = {
  id: "function-transformation-lab",
  title: "함수·변환·모델링 실험실",
  subtitle: "식의 매개변수 하나가 그래프·표·변화율·역함수 가능성에 어떤 흔적을 남기는지 연결합니다.",
  theme: { primary: "#24132F", secondary: "#E58BFF" },
  duration: 10,
  views: [
    { id: "graph", label: "그래프", hint: "입력 x마다 출력 y 하나를 대응시키고 모양의 변화를 봅니다." },
    { id: "table", label: "값·차분표", hint: "같은 간격 입력에서 1차·2차 차분과 비율을 비교합니다." },
    { id: "tangent", label: "변화율", hint: "한 점 주변의 아주 작은 변화 비율을 접선 기울기로 읽습니다." },
    { id: "sandbox", label: "함수 기계 제작", hint: "입력·연산 블록·출력을 연결해 합성함수를 자유롭게 만듭니다." },
  ],
  variables: [
    { key: "family", label: "함수 가족", shortLabel: "함수", default: "quadratic", options: [{ value: "linear", label: "일차함수" }, { value: "quadratic", label: "이차함수" }, { value: "exponential", label: "지수함수" }, { value: "sine", label: "사인함수" }] },
    { key: "a", label: "세로 확대·방향 a", shortLabel: "a", unit: "", min: -5, max: 5, step: 0.25, default: 1, digits: 2 },
    { key: "b", label: "밑/주파수 b", shortLabel: "b", unit: "", min: 0.25, max: 4, step: 0.25, default: 2, digits: 2 },
    { key: "h", label: "가로 이동 h", shortLabel: "h", unit: "", min: -5, max: 5, step: 0.25, default: 0, digits: 2 },
    { key: "k", label: "세로 이동 k", shortLabel: "k", unit: "", min: -8, max: 8, step: 0.5, default: 0, digits: 1 },
    { key: "probeX", label: "관찰 입력 x", shortLabel: "x", unit: "", min: -5, max: 5, step: 0.1, default: 1, digits: 1 },
  ],
  outputs: [
    { key: "y", label: "현재 함숫값 f(x)", shortLabel: "f(x)", unit: "", digits: 3, classMetric: true },
    { key: "slope", label: "현재 순간변화율", unit: "", digits: 3 },
    { key: "intercept", label: "y절편", unit: "", digits: 3 },
    { key: "rootCount", label: "관찰범위 근의 수", unit: "개", digits: 0 },
    { key: "oneToOne", label: "관찰범위 일대일", unit: "", format: (value) => value ? "가능" : "아님", depth: "H1" },
  ],
  prediction: { question: "선택한 x에서 f(x)는?", min: -20, max: 20, step: 1, unit: "", default: 1, digits: 0 },
  missions: [
    { id: "basket", title: "농구공 높이 데이터 맞추기", question: "아래로 열린 이차함수의 꼭짓점과 근을 바꿔 0초·착지·최고점 조건을 만족시키세요.", preset: { family: "quadratic", a: -1, b: 2, h: 2, k: 5, probeX: 1 }, view: "graph" },
    { id: "viral", title: "조회수 폭증과 한계", question: "지수함수의 일정한 차이가 아니라 일정한 비율을 표에서 찾고 장기 외삽의 위험을 설명하세요.", preset: { family: "exponential", a: 1, b: 1.5, h: 0, k: 0, probeX: 3 }, view: "table" },
    { id: "sound", title: "소리 파형 튜닝", question: "진폭·주파수·위상 이동이 파형에 남기는 서로 다른 흔적을 A/B로 비교하세요.", preset: { family: "sine", a: 3, b: 2, h: 0, k: 0, probeX: 1 }, view: "tangent" },
    { id: "machine", title: "같은 블록, 다른 순서", question: "제곱 뒤 +1과 +1 뒤 제곱이 같은지 함수 기계를 두 가지 순서로 만들어 비교하세요.", preset: { family: "quadratic", a: 1, b: 2, h: 0, k: 0, probeX: 2 }, view: "sandbox" },
  ],
  theory: [
    { id: "mapping", title: "함수는 입력-출력 규칙", summary: "함수는 허용된 각 입력에 정확히 하나의 출력을 대응시킵니다. 같은 출력에 여러 입력이 가는 것은 허용되지만 역함수에는 제한이 됩니다.", formula: "x ↦ f(x)", points: ["그래프·표·식은 같은 대응 규칙을 보는 서로 다른 표현입니다.", "정의역을 제한하면 원래 일대일이 아니던 함수도 역함수를 가질 수 있습니다."], example: "온도를 넣어 센서 전압을 내는 보정식은 실제 장치의 함수 모형입니다." },
    { id: "transform", title: "식의 바깥과 안쪽 변화", summary: "f(x−h)+k에서 h는 그래프를 오른쪽으로, k는 위로 이동합니다. 괄호 안 부호가 직관과 반대처럼 보이는 이유는 같은 내부 입력을 만들 x가 바뀌기 때문입니다.", formula: "y = a·f(b(x−h)) + k", points: ["a의 부호는 x축 대칭, 절댓값은 세로 크기를 바꿉니다.", "b는 사인함수 주기나 일반 그래프의 가로 압축을 바꿉니다."], depth: "M2" },
    { id: "rate", title: "변화율과 접선", summary: "평균변화율은 두 점을 잇는 할선 기울기이고 순간변화율은 간격을 0에 가깝게 할 때의 극한입니다.", formula: "f′(x) = lim[Δx→0] (f(x+Δx)−f(x))/Δx", points: ["함숫값이 0인 것과 기울기가 0인 것은 다른 조건입니다.", "자료에 잘 맞는 함수라도 관측 범위 밖 예측은 모형 가정이 유지되는지 검토해야 합니다."], depth: "H1" },
  ],
  compute(v, time, view, depth, sandbox) {
    const pipeline = sandboxPipeline(sandbox); const fn = view === "sandbox" && pipeline.valid ? pipeline.fn : (x) => standardFunction(v, x); const x = Number(v.probeX); const y = fn(x); const dx = 0.0005; const slope = (fn(x + dx) - fn(x - dx)) / (2 * dx); const intercept = fn(0);
    const samples = points(-6, 6, 241, (value) => ({ x: value, y: fn(value) })); let roots = 0; let monotonicUp = true; let monotonicDown = true;
    for (let i = 1; i < samples.length; i += 1) { if (samples[i - 1].y === 0 || samples[i - 1].y * samples[i].y < 0) roots += 1; if (samples[i].y <= samples[i - 1].y) monotonicUp = false; if (samples[i].y >= samples[i - 1].y) monotonicDown = false; }
    return { y, slope, intercept, rootCount: roots, oneToOne: monotonicUp || monotonicDown, samples, pipeline };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(48); if (view === "sandbox") return; const b = { x: 58, y: 48, w: g.width - 105, h: g.height - 105 }; const xTo = (x) => b.x + (x + 6) / 12 * b.w; const yTo = (y) => b.y + b.h - (clamp(y, -12, 12) + 12) / 24 * b.h;
    g.line(xTo(-6), yTo(0), xTo(6), yTo(0), g.ink, 1); g.line(xTo(0), yTo(-12), xTo(0), yTo(12), g.ink, 1);
    if (view === "table") {
      const xs = [-3, -2, -1, 0, 1, 2, 3]; const rows = xs.map((x, index) => ({ x, y: standardFunction(v, x), d1: index ? standardFunction(v, x) - standardFunction(v, xs[index - 1]) : null })); const startX = g.width * 0.2; const rowH = 48; g.text("x", startX, 70, { color: g.accent, weight: 700 }); g.text("f(x)", startX + 150, 70, { color: g.accent, weight: 700 }); g.text("1차 차분", startX + 300, 70, { color: g.accent, weight: 700 }); rows.forEach((row, index) => { const y = 105 + index * rowH; g.line(startX - 20, y + 14, g.width - startX + 20, y + 14, g.hairline, 1); g.text(row.x, startX, y, { color: g.ink }); g.text(row.y.toFixed(2), startX + 150, y, { color: g.ink }); g.text(row.d1 == null ? "—" : row.d1.toFixed(2), startX + 300, y, { color: g.ink }); }); return;
    }
    const curve = r.samples.filter((p) => Number.isFinite(p.y) && Math.abs(p.y) <= 40).map((p) => [xTo(p.x), yTo(p.y)]); g.polyline(curve, g.accent, 3); const px = xTo(Number(v.probeX)); const py = yTo(r.y); g.circle(px, py, 7, g.accent, g.ink, 2);
    if (view === "tangent") { const span = 2; g.line(xTo(Number(v.probeX) - span), yTo(r.y - r.slope * span), xTo(Number(v.probeX) + span), yTo(r.y + r.slope * span), g.ink, 2); g.text(`기울기 ${r.slope.toFixed(3)}`, px + 12, py - 16, { color: g.accent }); }
  },
  chart(v, r) { return { xLabel: "x", yLabel: "f(x)", xDomain: [-6, 6], yDomain: [-12, 12], series: [{ points: r.samples.map((p) => ({ x: p.x, y: clamp(p.y, -12, 12) })) }] }; },
  caption(r, v, view) { return view === "sandbox" ? `${r.pipeline.valid ? `f(x) = ${r.pipeline.expression}` : "입력에서 출력까지 연산 블록을 한 방향으로 연결하세요."} · x=${v.probeX}에서 ${Number(r.y).toFixed(3)}` : `x=${v.probeX}에서 f(x)=${Number(r.y).toFixed(3)}, 순간변화율 ${Number(r.slope).toFixed(3)}. 함숫값과 기울기는 서로 다른 정보입니다.`; },
  sandbox: {
    view: "sandbox", title: "함수 기계 제작대", instructions: "입력 x를 시작으로 연산 블록을 원하는 순서로 연결하고 마지막에 출력을 연결하세요. 한 블록에서 첫 번째로 나가는 연결을 계산 경로로 사용합니다.",
    parts: [
      { type: "input", label: "입력 x", icon: "x", max: 1 }, { type: "square", label: "제곱", icon: "□²", max: 4 }, { type: "sin", label: "sin", icon: "∿", max: 4 },
      { type: "abs", label: "절댓값", icon: "| |", max: 4 }, { type: "scale2", label: "×2", icon: "×2", max: 4 }, { type: "shift1", label: "+1", icon: "+1", max: 4 },
      { type: "negate", label: "부호반전", icon: "−", max: 4 }, { type: "output", label: "출력 y", icon: "y", max: 1 },
    ],
    initial: [{ type: "input", x: 0.2, y: 0.52 }, { type: "shift1", x: 0.42, y: 0.52 }, { type: "square", x: 0.62, y: 0.52 }, { type: "output", x: 0.82, y: 0.52 }],
    canLink(from, to, sandbox) { return from?.id !== to?.id && from?.type !== "output" && to?.type !== "input" && !sandbox.links.some((link) => link.from === from.id); },
    evaluate(sandbox) { const pipeline = sandboxPipeline(sandbox); return { valid: pipeline.valid, summary: pipeline.valid ? `완성 함수 · f(x)=${pipeline.expression}` : "입력 x에서 출력 y까지 끊기지 않는 단방향 경로를 만드세요." }; },
    draw(g, sandbox, result, time, ui) {
      const byId = new Map(sandbox.items.map((item) => [item.id, item])); sandbox.links.forEach((link) => { const a = byId.get(link.from); const b = byId.get(link.to); if (a && b) g.arrow(a.x * g.width, a.y * g.height, b.x * g.width, b.y * g.height, rgba(g.accent, 0.72), 2); });
      sandbox.items.forEach((item) => { const x = item.x * g.width; const y = item.y * g.height; const selected = item.id === ui.selected; g.rect(x - 42, y - 24, 84, 48, rgba(g.accent, 0.1), selected ? g.ink : g.accent, selected ? 4 : 2); g.text(item.label, x, y + 5, { align: "center", color: g.ink, weight: 700, size: 12 }); });
      const b = { x: g.width * 0.15, y: g.height * 0.72, w: g.width * 0.7, h: g.height * 0.2 }; g.line(b.x, b.y + b.h / 2, b.x + b.w, b.y + b.h / 2, g.muted, 1); g.line(b.x + b.w / 2, b.y, b.x + b.w / 2, b.y + b.h, g.muted, 1); if (result.pipeline.valid) { const curve = points(-4, 4, 100, (x) => [b.x + (x + 4) / 8 * b.w, b.y + b.h / 2 - clamp(result.pipeline.fn(x), -5, 5) / 10 * b.h]); g.polyline(curve, g.accent, 2); g.text(`f(x)=${result.pipeline.expression}`, b.x + b.w, b.y - 8, { align: "right", color: g.accent }); }
    },
  },
  limit: "그래프는 제한된 x·y 관찰창과 수치 미분을 사용합니다. 불연속점, 복소수, 정의역 제약과 큰 값의 오버플로는 단순화되며 자료에 맞춘 식이 곧 인과모형임을 뜻하지 않습니다.",
};
