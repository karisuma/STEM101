import { math } from "../lab-runtime.js";

const { clamp, lerp, map, TAU } = math;
const points = (start, end, count, fn) => Array.from({ length: count }, (_, index) => { const x = lerp(start, end, index / Math.max(1, count - 1)); return fn(x, index); });
function rgba(hex, alpha) { const raw = hex.replace("#", ""); const value = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw; const n = Number.parseInt(value, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; }

const ELEMENTS = [
  null,
  { symbol: "H", name: "수소", mass: 1 }, { symbol: "He", name: "헬륨", mass: 4 }, { symbol: "Li", name: "리튬", mass: 7 },
  { symbol: "Be", name: "베릴륨", mass: 9 }, { symbol: "B", name: "붕소", mass: 11 }, { symbol: "C", name: "탄소", mass: 12 },
  { symbol: "N", name: "질소", mass: 14 }, { symbol: "O", name: "산소", mass: 16 }, { symbol: "F", name: "플루오린", mass: 19 },
  { symbol: "Ne", name: "네온", mass: 20 }, { symbol: "Na", name: "나트륨", mass: 23 }, { symbol: "Mg", name: "마그네슘", mass: 24 },
  { symbol: "Al", name: "알루미늄", mass: 27 }, { symbol: "Si", name: "규소", mass: 28 }, { symbol: "P", name: "인", mass: 31 },
  { symbol: "S", name: "황", mass: 32 }, { symbol: "Cl", name: "염소", mass: 35 }, { symbol: "Ar", name: "아르곤", mass: 40 },
];

function electronShells(electrons) {
  const capacities = [2, 8, 8]; let left = Math.max(0, electrons);
  return capacities.map((capacity) => { const value = Math.min(capacity, left); left -= value; return value; });
}

export const atomLab = {
  id: "atom-model-lab",
  title: "원자·이온·스펙트럼 실험실",
  subtitle: "양성자·중성자·전자의 역할을 분리하고, 같은 원소의 동위원소와 이온을 직접 조립합니다.",
  theme: { primary: "#0B2226", secondary: "#F4C95D" },
  duration: 8,
  views: [
    { id: "shells", label: "전자껍질", hint: "전자 배치는 화학적 성질의 반복과 이온 형성을 설명하는 첫 모형입니다." },
    { id: "nucleus", label: "원자핵", hint: "원소 정체성은 양성자 수, 동위원소는 중성자 수로 구분됩니다." },
    { id: "spectrum", label: "빛 스펙트럼", hint: "전자 에너지 차이가 특정 파장의 빛으로 관측됩니다." },
    { id: "sandbox", label: "자유 원자 조립", hint: "양성자·중성자·전자를 원하는 수만큼 놓아 원자·이온·동위원소를 만듭니다." },
  ],
  variables: [
    { key: "atomicNumber", label: "양성자 수(원자번호)", shortLabel: "양성자", unit: "개", min: 1, max: 18, step: 1, default: 8, digits: 0 },
    { key: "massNumber", label: "질량수", shortLabel: "질량수", unit: "", min: 1, max: 40, step: 1, default: 16, digits: 0 },
    { key: "charge", label: "전하", shortLabel: "전하", unit: "e", min: -3, max: 3, step: 1, default: 0, digits: 0 },
    { key: "transition", label: "전자 전이", shortLabel: "전이", default: "3-2", options: [{ value: "2-1", label: "n=2 → 1" }, { value: "3-2", label: "n=3 → 2" }, { value: "4-2", label: "n=4 → 2" }, { value: "4-3", label: "n=4 → 3" }] },
    { key: "field", label: "외부 전기장(개념)", unit: "%", min: 0, max: 100, step: 5, default: 0, digits: 0, depth: "H2" },
  ],
  outputs: [
    { key: "electrons", label: "전자 수", shortLabel: "전자", unit: "개", digits: 0, classMetric: true },
    { key: "neutrons", label: "중성자 수", unit: "개", digits: 0 },
    { key: "netCharge", label: "알짜 전하", unit: "e", digits: 0 },
    { key: "wavelength", label: "방출 파장(수소형)", shortLabel: "파장", unit: "nm", digits: 1 },
    { key: "binding", label: "바깥전자 결합 경향", unit: "상대값", digits: 2, depth: "H1" },
  ],
  prediction: { question: "이 입자에서 전자는 몇 개일까?", min: 0, max: 21, step: 1, unit: "개", default: 10, digits: 0 },
  missions: [
    { id: "ion", title: "미스터리 이온의 정체", question: "양성자 11개, 전자 10개인 입자의 이름과 전하를 조립으로 증명하세요.", preset: { atomicNumber: 11, massNumber: 23, charge: 1, transition: "3-2", field: 0 }, view: "sandbox" },
    { id: "isotope", title: "같은 탄소, 다른 시계", question: "탄소-12와 탄소-14는 무엇이 같고 무엇이 다른지 A/B로 비교하세요.", preset: { atomicNumber: 6, massNumber: 12, charge: 0, transition: "3-2", field: 0 }, view: "nucleus" },
    { id: "firework", title: "불꽃색의 지문", question: "에너지 전이가 연속된 모든 색이 아니라 특정 파장을 내는 이유를 스펙트럼으로 설명하세요.", preset: { atomicNumber: 1, massNumber: 1, charge: 0, transition: "3-2", field: 0 }, view: "spectrum" },
    { id: "noble", title: "안정한 껍질 만들기", question: "1~18번 원소 중 전자를 잃거나 얻어 바깥껍질을 채우는 가장 작은 변화를 찾으세요.", preset: { atomicNumber: 17, massNumber: 35, charge: -1, transition: "3-2", field: 0 }, view: "shells" },
  ],
  theory: [
    { id: "identity", title: "원소의 주민등록번호", summary: "양성자 수가 원소를 결정합니다. 중성자 수가 달라도 원소는 같지만 질량수와 핵의 안정성이 달라질 수 있습니다.", formula: "원자번호 Z = p   ·   질량수 A = p + n", points: ["탄소-12와 탄소-14는 모두 양성자 6개입니다.", "전자를 바꾸어도 원소가 바뀌지 않고 이온이 됩니다."], example: "방사성 동위원소의 일정한 붕괴 확률은 유물의 연대를 추정하는 시계가 됩니다." },
    { id: "ions", title: "이온의 전하 장부", summary: "양성자는 +e, 전자는 −e 전하를 가집니다. 전하수는 양성자 수에서 전자 수를 뺀 값입니다.", formula: "전하수 = p − e", points: ["양이온은 전자를 잃은 입자이고 음이온은 전자를 얻은 입자입니다.", "질량 대부분은 원자핵에 있어 전자 증감은 질량수에 포함하지 않습니다."], depth: "M2" },
    { id: "quantum", title: "허용된 에너지와 선 스펙트럼", summary: "전자는 임의의 에너지가 아니라 허용된 상태에 있으며, 상태 사이 에너지 차이에 해당하는 광자를 흡수하거나 방출합니다.", formula: "ΔE = hf = hc/λ", points: ["보어 궤도 그림은 위치가 고정된 행성 궤도가 아니라 에너지 준위를 익히는 과도기적 모형입니다.", "다전자 원자의 실제 스펙트럼은 전자 간 상호작용 때문에 수소식보다 복잡합니다."], depth: "H1" },
  ],
  compute(v, time, view, depth, sandbox) {
    let protons = Number(v.atomicNumber); let neutrons = Math.max(0, Number(v.massNumber) - protons); let electrons = Math.max(0, protons - Number(v.charge));
    if (view === "sandbox" && sandbox) {
      protons = sandbox.items.filter((item) => item.type === "proton").length;
      neutrons = sandbox.items.filter((item) => item.type === "neutron").length;
      electrons = sandbox.items.filter((item) => item.type === "electron").length;
    }
    const element = ELEMENTS[protons] || { symbol: "?", name: protons ? "미등록 원소" : "원자핵 없음", mass: protons + neutrons };
    const netCharge = protons - electrons; const shells = electronShells(electrons);
    const [upper, lower] = String(v.transition).split("-").map(Number); const rydberg = 1.097373e7;
    const wavelength = 1e9 / (rydberg * Math.max(1e-9, 1 / lower ** 2 - 1 / upper ** 2));
    const valence = shells.filter(Boolean).at(-1) || 0; const binding = clamp((8 - Math.abs(8 - valence)) / 8 + protons / 100, 0, 1.5);
    const stableHint = neutrons >= Math.floor(protons * 0.8) && neutrons <= Math.ceil(protons * 1.35);
    return { protons, neutrons, electrons, netCharge, shells, element, wavelength, binding, stableHint, massNumber: protons + neutrons };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(50); const cx = g.width * 0.5; const cy = g.height * 0.51;
    if (view === "sandbox") return;
    if (view === "spectrum") {
      const x1 = 70; const x2 = g.width - 70; const y = g.height * 0.55;
      g.line(x1, y, x2, y, g.ink, 16);
      const spectralLines = [410.2, 434.0, 486.1, 656.3];
      spectralLines.forEach((wavelength) => { const x = map(wavelength, 380, 720, x1, x2); const active = Math.abs(wavelength - r.wavelength) < 5; g.line(x, y - (active ? 80 : 48), x, y + (active ? 80 : 48), active ? g.accent : rgba(g.accent, 0.35), active ? 5 : 2); g.text(`${wavelength}`, x, y + 105, { align: "center", color: active ? g.accent : g.muted, size: 10 }); });
      g.text(`${v.transition} 전이 · λ≈${r.wavelength.toFixed(1)} nm`, cx, 72, { align: "center", color: g.accent, size: 18, weight: 700 }); return;
    }
    if (view === "nucleus") {
      const count = r.protons + r.neutrons; const random = math.seeded(811 + count);
      for (let i = 0; i < count; i += 1) { const radius = Math.sqrt(random()) * Math.min(150, 20 + count * 6); const angle = random() * TAU; const proton = i < r.protons; g.circle(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 10, proton ? g.accent : g.ink, g.surface, 1); if (proton) g.text("+", cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius + 4, { align: "center", color: g.surface, weight: 700 }); }
      g.text(`${r.element.name}-${r.massNumber}`, cx, 64, { align: "center", color: g.accent, size: 21, weight: 700 }); return;
    }
    const radii = [68, 122, 176]; r.shells.forEach((count, shellIndex) => {
      if (!count) return; const radius = radii[shellIndex]; g.circle(cx, cy, radius, null, rgba(g.ink, 0.28), 1);
      for (let i = 0; i < count; i += 1) { const angle = i / count * TAU + time * (0.26 - shellIndex * 0.05); g.circle(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 6, g.accent); }
    });
    g.circle(cx, cy, 34, rgba(g.accent, 0.3), g.accent, 2); g.text(r.element.symbol, cx, cy + 7, { align: "center", color: g.accent, size: 22, weight: 800 });
    g.text(`${r.netCharge === 0 ? "중성 원자" : r.netCharge > 0 ? `${r.netCharge}+ 양이온` : `${Math.abs(r.netCharge)}− 음이온`}`, cx, 54, { align: "center", color: g.ink, size: 16 });
  },
  chart(v, r, view) {
    if (view === "spectrum") return { xLabel: "파장 (nm)", yLabel: "상대 세기", xDomain: [380, 720], yDomain: [0, 1.1], series: [{ type: "bars", points: [410.2, 434, 486.1, 656.3].map((x) => ({ x, y: Math.abs(x - r.wavelength) < 5 ? 1 : 0.42 })) }] };
    return { xLabel: "전자껍질 번호 n", yLabel: "전자 수", xDomain: [0.5, 3.5], yDomain: [0, 9], series: [{ type: "bars", points: r.shells.map((y, index) => ({ x: index + 1, y })) }] };
  },
  caption(r, v, view) { return view === "sandbox" ? `${r.protons ? r.element.name : "아직 원소가 아님"} · p ${r.protons}, n ${r.neutrons}, e ${r.electrons}, 전하 ${r.netCharge}` : `${r.element.name}-${r.massNumber} · 양성자 ${r.protons}, 중성자 ${r.neutrons}, 전자 ${r.electrons}. 원소는 양성자 수로 정해집니다.`; },
  sandbox: {
    view: "sandbox",
    title: "원자 조립대",
    instructions: "양성자와 중성자는 중심에, 전자는 바깥에 자유롭게 놓으세요. 위치가 완벽하지 않아도 개수 장부가 원소·동위원소·이온을 판정합니다.",
    parts: [
      { type: "proton", label: "양성자 +", icon: "+", max: 18 },
      { type: "neutron", label: "중성자 0", icon: "0", max: 22 },
      { type: "electron", label: "전자 −", icon: "−", max: 21 },
    ],
    initial: [{ type: "proton", x: 0.46, y: 0.52 }, { type: "proton", x: 0.51, y: 0.48 }, { type: "neutron", x: 0.53, y: 0.54 }, { type: "electron", x: 0.34, y: 0.38 }, { type: "electron", x: 0.68, y: 0.66 }],
    canLink() { return false; },
    evaluate(sandbox) { const p = sandbox.items.filter((item) => item.type === "proton").length; const e = sandbox.items.filter((item) => item.type === "electron").length; return { valid: p > 0, summary: p ? `${ELEMENTS[p]?.name || "미등록 원소"} · ${p - e === 0 ? "중성" : `전하 ${p - e}`}` : "양성자를 하나 이상 놓아 원소를 만드세요." }; },
    draw(g, sandbox, result, time, ui) {
      const cx = g.width / 2; const cy = g.height * 0.53; [80, 145, 210].forEach((radius) => g.circle(cx, cy, radius, null, rgba(g.ink, 0.16), 1));
      sandbox.items.forEach((item) => { const x = item.x * g.width; const y = item.y * g.height; const selected = item.id === ui.selected; const color = item.type === "proton" ? g.accent : item.type === "neutron" ? g.ink : rgba(g.accent, 0.8); const radius = item.type === "electron" ? 7 : 12; g.circle(x, y, radius, color, selected ? g.ink : g.surface, selected ? 4 : 1); g.text(item.type === "proton" ? "+" : item.type === "electron" ? "−" : "0", x, y + 4, { align: "center", color: item.type === "neutron" ? g.surface : g.surface, weight: 800, size: 10 }); });
      g.text(`${result.element.name} ${result.massNumber || ""} · 전하 ${result.netCharge}`, cx, g.height - 38, { align: "center", color: g.accent, size: 16, weight: 700 });
    },
  },
  limit: "껍질 그림은 전자의 정확한 궤도를 뜻하지 않습니다. 핵력, 오비탈 모양, 전자 스핀과 다전자 에너지 보정은 생략하며 스펙트럼 식은 수소 원자에 가장 정확합니다.",
};

export const acidBaseLab = {
  id: "acid-base-lab",
  title: "산·염기·완충 실험실",
  subtitle: "pH 숫자를 외우는 대신 H⁺ 장부, 중화 반응, 로그척도와 완충 구간을 함께 관찰합니다.",
  theme: { primary: "#0D2523", secondary: "#FFD45C" },
  duration: 14,
  views: [
    { id: "titration", label: "적정 곡선", hint: "염기를 조금씩 넣을 때 pH가 언제 급격히 바뀌는지 봅니다." },
    { id: "particles", label: "이온 장부", hint: "중화 전후 남는 H⁺ 또는 OH⁻의 상대 수를 봅니다." },
    { id: "indicator", label: "지시약", hint: "지시약은 한 pH에서 갑자기 바뀌지 않고 전이 범위를 가집니다." },
  ],
  variables: [
    { key: "acidVolume", label: "산 용액 부피", shortLabel: "산부피", unit: "mL", min: 10, max: 100, step: 5, default: 50, digits: 0 },
    { key: "acidConcentration", label: "산 농도", shortLabel: "산농도", unit: "mol/L", min: 0.01, max: 1, step: 0.01, default: 0.1, digits: 2 },
    { key: "acidType", label: "산의 종류", shortLabel: "산종류", default: "strong", options: [{ value: "strong", label: "강산" }, { value: "weak", label: "약산 · pKₐ 4.76" }] },
    { key: "baseVolume", label: "넣은 염기 부피", shortLabel: "염기부피", unit: "mL", min: 0, max: 150, step: 1, default: 25, digits: 0 },
    { key: "baseConcentration", label: "염기 농도", shortLabel: "염기농도", unit: "mol/L", min: 0.01, max: 1, step: 0.01, default: 0.1, digits: 2 },
    { key: "indicator", label: "지시약", default: "btb", options: [{ value: "methyl", label: "메틸오렌지 · 3.1~4.4" }, { value: "btb", label: "BTB · 6.0~7.6" }, { value: "phenol", label: "페놀프탈레인 · 8.2~10.0" }] },
  ],
  outputs: [
    { key: "pH", label: "현재 pH", shortLabel: "pH", unit: "", digits: 2, classMetric: true },
    { key: "equivalenceVolume", label: "당량점 염기 부피", unit: "mL", digits: 1 },
    { key: "excessMmol", label: "남는 산/염기 양", unit: "mmol", digits: 2 },
    { key: "ionFraction", label: "중화 진행률", unit: "%", digits: 1 },
    { key: "bufferCapacity", label: "완충 상대용량", unit: "상대값", digits: 2, depth: "H1" },
  ],
  prediction: { question: "혼합 뒤 pH는 얼마일까?", min: 0, max: 14, step: 0.5, unit: "", default: 7, digits: 1 },
  missions: [
    { id: "antacid", title: "제산제 투입량 찾기", question: "강산 0.10 mol/L 50 mL를 pH 6~8로 만들 최소 염기량을 찾으세요.", preset: { acidVolume: 50, acidConcentration: 0.1, acidType: "strong", baseVolume: 45, baseConcentration: 0.1, indicator: "btb" }, view: "particles" },
    { id: "unknown", title: "미지의 산 감별", question: "같은 농도 강산과 약산의 시작 pH, 반당량점, 당량점 모양을 A/B로 비교하세요.", preset: { acidVolume: 50, acidConcentration: 0.1, acidType: "weak", baseVolume: 25, baseConcentration: 0.1, indicator: "phenol" }, view: "titration" },
    { id: "indicator", title: "당량점과 종말점은 같을까", question: "산 종류에 맞지 않는 지시약을 고르면 색 변화 시점과 당량점 사이에 어떤 오차가 생길까요?", preset: { acidVolume: 50, acidConcentration: 0.1, acidType: "weak", baseVolume: 50, baseConcentration: 0.1, indicator: "methyl" }, view: "indicator" },
    { id: "ocean", title: "바다는 왜 pH가 덜 변할까", question: "약산/짝염기 혼합 구간에서 같은 1 mL 첨가가 pH를 얼마나 바꾸는지 비교하세요.", preset: { acidVolume: 80, acidConcentration: 0.08, acidType: "weak", baseVolume: 40, baseConcentration: 0.08, indicator: "btb" }, view: "titration" },
  ],
  theory: [
    { id: "log", title: "pH는 로그 눈금", summary: "pH가 1 차이면 H⁺ 농도는 10배 차이입니다. 3과 6의 산성 세기를 단순히 두 배로 비교할 수 없습니다.", formula: "pH = −log₁₀[H⁺]", points: ["pH 2 용액은 pH 4 용액보다 H⁺ 농도가 100배입니다.", "매우 묽은 용액에서는 물 자체의 이온화도 고려해야 합니다."], example: "위산 pH의 작은 변화도 H⁺ 농도로 바꾸면 큰 비율 변화가 됩니다." },
    { id: "neutralize", title: "중화는 입자 수 장부", summary: "강산과 강염기에서는 H⁺와 OH⁻가 1:1로 물을 만듭니다. 당량점은 산과 염기의 반응 몰수가 맞는 지점입니다.", formula: "n(H⁺) = n(OH⁻)   ·   H⁺ + OH⁻ → H₂O", points: ["중성 pH와 당량점은 같은 말이 아닙니다. 약산 적정의 당량점은 보통 pH 7보다 큽니다.", "부피가 늘면서 농도가 희석되는 효과도 함께 계산해야 합니다."], depth: "M2" },
    { id: "buffer", title: "완충 구간의 비율", summary: "약산과 짝염기가 함께 있으면 넣은 H⁺나 OH⁻를 일부 받아내 pH 변화를 줄입니다. 반당량점에서는 두 종의 양이 같아 pH=pKₐ입니다.", formula: "pH = pKₐ + log₁₀([A⁻]/[HA])", points: ["완충은 pH를 완전히 고정하는 것이 아니며 용량을 넘으면 급격히 변합니다.", "생체액은 여러 약산·염기 쌍과 호흡·신장 조절이 함께 작동합니다."], depth: "H1" },
  ],
  compute(v) {
    const acid = Number(v.acidVolume) / 1000 * Number(v.acidConcentration); const base = Number(v.baseVolume) / 1000 * Number(v.baseConcentration); const totalV = (Number(v.acidVolume) + Number(v.baseVolume)) / 1000;
    const equivalenceVolume = acid / Number(v.baseConcentration) * 1000; let pH; const pKa = 4.76;
    if (v.acidType === "strong") {
      const excess = acid - base; if (Math.abs(excess) < 1e-10) pH = 7; else if (excess > 0) pH = -Math.log10(excess / totalV); else pH = 14 + Math.log10(-excess / totalV);
    } else if (base <= 0) {
      const Ka = 10 ** -pKa; const concentration = Number(v.acidConcentration); pH = -Math.log10((-Ka + Math.sqrt(Ka ** 2 + 4 * Ka * concentration)) / 2);
    } else if (base < acid) pH = pKa + Math.log10(base / (acid - base));
    else if (Math.abs(base - acid) < 1e-10) { const Kb = 1e-14 / 10 ** -pKa; const c = acid / totalV; const oh = Math.sqrt(Kb * c); pH = 14 + Math.log10(oh); }
    else pH = 14 + Math.log10((base - acid) / totalV);
    pH = clamp(pH, 0, 14); const excessMmol = (base - acid) * 1000; const ionFraction = Math.min(base, acid) / Math.max(acid, 1e-12) * 100; const ratio = base < acid ? base / Math.max(1e-9, acid - base) : 0; const bufferCapacity = v.acidType === "weak" ? 4 * ratio / (1 + ratio) ** 2 : 0;
    return { pH, equivalenceVolume, excessMmol, ionFraction: clamp(ionFraction, 0, 100), bufferCapacity, acidMol: acid, baseMol: base, totalV };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(50);
    if (view === "titration") {
      const b = { x: 64, y: 55, w: g.width - 115, h: g.height - 125 }; g.axes(b, { x: "넣은 염기 (mL)", y: "pH" });
      const curve = points(0, 150, 151, (volume) => { const rr = acidBaseLab.compute({ ...v, baseVolume: volume }); return [b.x + volume / 150 * b.w, b.y + b.h - rr.pH / 14 * b.h]; }); g.polyline(curve, g.accent, 3);
      const px = b.x + Number(v.baseVolume) / 150 * b.w; const py = b.y + b.h - r.pH / 14 * b.h; g.circle(px, py, 7, g.accent, g.ink, 2); g.text(`pH ${r.pH.toFixed(2)}`, px + 10, py - 12, { color: g.accent, size: 13 }); return;
    }
    const beaker = { x: g.width * 0.27, y: 105, w: g.width * 0.46, h: 280 }; g.rect(beaker.x, beaker.y, beaker.w, beaker.h, rgba(g.accent, 0.04), g.ink, 2);
    const color = r.pH < 4 ? rgba("#FF7A45", 0.48) : r.pH > 9 ? rgba("#80E8FF", 0.42) : rgba(g.accent, 0.4); g.rect(beaker.x + 8, beaker.y + 100, beaker.w - 16, beaker.h - 108, color, null);
    if (view === "indicator") {
      g.text(`선택 지시약 · ${v.indicator === "methyl" ? "메틸오렌지" : v.indicator === "phenol" ? "페놀프탈레인" : "BTB"}`, g.width / 2, 70, { align: "center", color: g.ink, size: 15 });
      g.text(`관찰색: ${r.pH < 4 ? "산성 쪽 색" : r.pH > 9 ? "염기성 쪽 색" : "전이/중간 색"}`, g.width / 2, beaker.y + 200, { align: "center", color: g.surface, size: 17, weight: 700 });
    } else {
      const acidDots = Math.round(clamp((r.acidMol - Math.min(r.acidMol, r.baseMol)) * 1400, 0, 45)); const baseDots = Math.round(clamp((r.baseMol - Math.min(r.acidMol, r.baseMol)) * 1400, 0, 45)); const neutral = Math.round(clamp(Math.min(r.acidMol, r.baseMol) * 900, 0, 40)); const random = math.seeded(47);
      for (let i = 0; i < acidDots + baseDots + neutral; i += 1) { const x = beaker.x + 22 + random() * (beaker.w - 44); const y = beaker.y + 120 + random() * (beaker.h - 145); const label = i < acidDots ? "H⁺" : i < acidDots + baseDots ? "OH⁻" : "H₂O"; const dotColor = i < acidDots ? g.accent : i < acidDots + baseDots ? g.ink : g.muted; g.circle(x, y, label === "H₂O" ? 5 : 8, dotColor); if (label !== "H₂O") g.text(label, x, y + 3, { align: "center", color: g.surface, size: 7, weight: 700 }); }
    }
    g.text(`pH ${r.pH.toFixed(2)}`, g.width / 2, beaker.y + beaker.h + 40, { align: "center", color: g.accent, size: 21, weight: 800 });
  },
  chart(v) { return { xLabel: "염기 첨가 부피 (mL)", yLabel: "pH", xDomain: [0, 150], yDomain: [0, 14], series: [{ points: points(0, 150, 151, (volume) => ({ x: volume, y: acidBaseLab.compute({ ...v, baseVolume: volume }).pH })) }] }; },
  caption(r, v) { const region = Math.abs(Number(v.baseVolume) - r.equivalenceVolume) < 1 ? "당량점 부근" : Number(v.baseVolume) < r.equivalenceVolume ? "산이 남는 구간" : "염기가 남는 구간"; return `${region} · pH ${r.pH.toFixed(2)}. pH는 남는 몰수뿐 아니라 혼합 뒤 전체 부피와 산의 세기에 좌우됩니다.`; },
  limit: "25 °C의 이상용액, 활동도 계수 1, 1가 산·염기를 가정합니다. 매우 진한 용액, 다가산, 침전, 용매 효과와 반응열은 포함하지 않습니다.",
};

export const reactionLab = {
  id: "reaction-conservation-lab",
  title: "화학반응·보존·속도 실험실",
  subtitle: "입자 충돌, 반응비, 제한 반응물과 질량 보존을 하나의 반응 장면에서 검증합니다.",
  theme: { primary: "#242010", secondary: "#B6E857" },
  duration: 12,
  views: [
    { id: "particles", label: "반응 입자", hint: "N₂ 1개와 H₂ 3개가 충돌해 NH₃ 2개를 만드는 모형입니다." },
    { id: "ledger", label: "원자 장부", hint: "원자의 종류와 수는 반응 전후에 보존됩니다." },
    { id: "rate", label: "반응 속도", hint: "온도와 촉매는 가능한 충돌 중 성공 비율을 바꿉니다." },
    { id: "sandbox", label: "자유 반응 혼합", hint: "N₂·H₂ 분자와 촉매를 반응기에 원하는 수만큼 넣습니다." },
  ],
  variables: [
    { key: "nitrogen", label: "질소 N₂ 양", shortLabel: "N₂", unit: "mol", min: 0.5, max: 10, step: 0.5, default: 2, digits: 1 },
    { key: "hydrogen", label: "수소 H₂ 양", shortLabel: "H₂", unit: "mol", min: 0.5, max: 20, step: 0.5, default: 6, digits: 1 },
    { key: "temperature", label: "반응 온도", shortLabel: "온도", unit: "K", min: 300, max: 900, step: 20, default: 650, digits: 0 },
    { key: "catalyst", label: "촉매 표면", shortLabel: "촉매", default: "on", options: [{ value: "off", label: "촉매 없음" }, { value: "on", label: "철 촉매 있음" }] },
    { key: "closed", label: "용기 상태", shortLabel: "용기", default: "closed", options: [{ value: "closed", label: "밀폐 용기" }, { value: "open", label: "열린 용기" }] },
    { key: "activation", label: "활성화에너지", unit: "kJ/mol", min: 35, max: 120, step: 5, default: 75, digits: 0, depth: "H1" },
  ],
  outputs: [
    { key: "product", label: "생성 NH₃", shortLabel: "NH₃", unit: "mol", digits: 2, classMetric: true },
    { key: "leftover", label: "제한 아닌 반응물 잔량", unit: "mol", digits: 2 },
    { key: "rate", label: "상대 초기속도", unit: "상대값", digits: 3 },
    { key: "massBefore", label: "반응 전 총질량", unit: "g", digits: 1 },
    { key: "massObserved", label: "관측되는 반응 후 질량", unit: "g", digits: 1 },
  ],
  prediction: { question: "암모니아가 최대 몇 mol 생길까?", min: 0, max: 20, step: 0.5, unit: "mol", default: 4, digits: 1 },
  missions: [
    { id: "limiting", title: "우주 농장 비료 생산", question: "N₂ 4 mol을 모두 쓰며 남는 H₂를 최소화하는 혼합비를 찾으세요.", preset: { nitrogen: 4, hydrogen: 8, temperature: 650, catalyst: "on", closed: "closed", activation: 75 }, view: "particles" },
    { id: "mass", title: "질량이 사라진 것처럼 보인다", question: "열린 용기에서 기체 생성물이 빠져나갈 때 보존법칙과 저울값을 동시에 설명하세요.", preset: { nitrogen: 2, hydrogen: 6, temperature: 700, catalyst: "on", closed: "open", activation: 75 }, view: "ledger" },
    { id: "catalyst", title: "촉매는 생성량을 늘릴까", question: "같은 시간의 생성량과 충분히 긴 시간의 최대 생성량을 구분해 A/B로 비교하세요.", preset: { nitrogen: 3, hydrogen: 9, temperature: 520, catalyst: "off", closed: "closed", activation: 85 }, view: "rate" },
    { id: "sandbox", title: "반응기 자유 충전", question: "분자 카드를 원하는 만큼 넣고 최대 수율·최소 잔량 조합을 만들어 학급에 제출하세요.", preset: { nitrogen: 2, hydrogen: 6, temperature: 650, catalyst: "on", closed: "closed", activation: 75 }, view: "sandbox" },
  ],
  theory: [
    { id: "balance", title: "계수는 입자 수의 비", summary: "반응식 계수는 반응에 참여하는 입자와 몰의 비입니다. 아래첨자는 분자 하나 내부 원자 수이므로 함부로 바꿀 수 없습니다.", formula: "N₂ + 3H₂ → 2NH₃", points: ["질소 원자 2개와 수소 원자 6개가 양쪽에서 같습니다.", "계수비가 맞지 않으면 어느 한 반응물이 먼저 떨어져 반응이 멈춥니다."], example: "레시피의 재료 비율처럼 제한 반응물이 만들 수 있는 최대 생성량을 정합니다." },
    { id: "mass", title: "질량 보존과 계의 경계", summary: "닫힌계에서는 반응 전후 총질량이 같습니다. 열린 용기 저울값이 줄었다면 원자가 사라진 것이 아니라 계 밖으로 이동했는지 확인해야 합니다.", formula: "Σm반응물 = Σm생성물 (닫힌계)", points: ["기체가 들어오거나 나가는 반응은 용기의 경계를 명확히 정해야 합니다.", "질량 보존은 부피나 분자 수가 항상 같다는 뜻이 아닙니다."], depth: "M2" },
    { id: "rate", title: "성공하는 충돌의 비율", summary: "반응하려면 입자가 충돌하고, 충분한 에너지와 알맞은 방향을 가져야 합니다. 촉매는 더 낮은 활성화에너지 경로를 제공합니다.", formula: "k ≈ A e^(−Eₐ/RT)", points: ["촉매는 정반응과 역반응을 모두 빠르게 하며 평형 위치 자체를 바꾸지 않습니다.", "온도 상승은 빠른 입자의 비율을 크게 늘리지만 수율·안전과 상충할 수 있습니다."], depth: "H1" },
  ],
  compute(v, time, view, depth, sandbox) {
    let n2 = Number(v.nitrogen); let h2 = Number(v.hydrogen); let catalyst = v.catalyst === "on";
    if (view === "sandbox" && sandbox) { n2 = sandbox.items.filter((item) => item.type === "n2").length * 0.5; h2 = sandbox.items.filter((item) => item.type === "h2").length * 0.5; catalyst = sandbox.items.some((item) => item.type === "catalyst"); }
    const extent = Math.min(n2, h2 / 3); const maxProduct = 2 * extent; const limiting = n2 < h2 / 3 ? "N₂" : n2 > h2 / 3 ? "H₂" : "정확한 비";
    const leftoverN2 = n2 - extent; const leftoverH2 = h2 - 3 * extent; const leftover = leftoverN2 + leftoverH2;
    const R = 0.008314; const effectiveEa = Number(v.activation) * (catalyst ? 0.62 : 1); const rate = Math.exp(-effectiveEa / (R * Number(v.temperature))) * 1e5 * Math.max(0.1, n2 * h2 ** 1.5);
    const progress = 1 - Math.exp(-rate * time / 15); const product = maxProduct * clamp(progress, 0, 1);
    const massBefore = n2 * 28.014 + h2 * 2.016; const escapeFraction = v.closed === "open" ? 0.35 * progress : 0; const massObserved = massBefore - product * 17.031 * escapeFraction;
    return { product, maxProduct, leftover, leftoverN2, leftoverH2, limiting, rate, progress, massBefore, massObserved, n2, h2, catalyst };
  },
  draw(g, v, r, time, view) {
    g.clear(); g.grid(50); if (view === "sandbox") return;
    if (view === "ledger") {
      const left = g.width * 0.16; const right = g.width * 0.84; const y = 130;
      g.text("반응 전", left, y - 45, { align: "center", color: g.ink, size: 16 }); g.text("관측 반응 후", right, y - 45, { align: "center", color: g.ink, size: 16 });
      const maxMass = Math.max(1, r.massBefore); const h1 = 220; g.rect(left - 45, y, 90, h1, null, g.hairline); g.rect(left - 45, y + h1 * (1 - r.massBefore / maxMass), 90, h1 * r.massBefore / maxMass, rgba(g.accent, 0.72), null);
      g.rect(right - 45, y, 90, h1, null, g.hairline); g.rect(right - 45, y + h1 * (1 - r.massObserved / maxMass), 90, h1 * r.massObserved / maxMass, rgba(g.ink, 0.45), null);
      g.arrow(left + 70, y + 110, right - 70, y + 110, g.accent, 3); g.text(v.closed === "closed" ? "닫힌계: 경계 통과 없음" : "생성 기체 일부가 경계 밖으로", g.width / 2, y + 88, { align: "center", color: g.accent });
      g.text(`${r.massBefore.toFixed(1)} g`, left, y + h1 + 32, { align: "center", color: g.accent }); g.text(`${r.massObserved.toFixed(1)} g`, right, y + h1 + 32, { align: "center", color: g.ink }); return;
    }
    if (view === "rate") {
      const b = { x: 65, y: 62, w: g.width - 120, h: g.height - 135 }; g.axes(b, { x: "시간", y: "NH₃" });
      const curve = points(0, 12, 100, (t) => [b.x + t / 12 * b.w, b.y + b.h - reactionLab.compute(v, t).product / Math.max(0.1, r.maxProduct) * b.h]); g.polyline(curve, g.accent, 3);
      g.line(b.x, b.y, b.x + b.w, b.y, g.muted, 1, [5, 4]); g.text(`이론 최대 ${r.maxProduct.toFixed(1)} mol`, b.x + b.w, b.y - 10, { align: "right", color: g.muted }); return;
    }
    const vessel = { x: g.width * 0.16, y: 75, w: g.width * 0.68, h: g.height - 150 }; g.rect(vessel.x, vessel.y, vessel.w, vessel.h, rgba(g.accent, 0.03), g.ink, 2);
    const countN = clamp(Math.round(r.n2 * 4 * (1 - r.progress)), 0, 35); const countH = clamp(Math.round(r.h2 * 2 * (1 - r.progress)), 0, 45); const countP = clamp(Math.round(r.product * 3), 0, 45); const random = math.seeded(219);
    for (let i = 0; i < countN + countH + countP; i += 1) { const x = vessel.x + 24 + random() * (vessel.w - 48); const y = vessel.y + 28 + random() * (vessel.h - 56); const phase = time * 0.7 + i; const px = x + Math.sin(phase) * 7; const py = y + Math.cos(phase * 1.17) * 7; if (i < countN) { g.circle(px - 6, py, 7, g.ink); g.circle(px + 6, py, 7, g.ink); } else if (i < countN + countH) { g.circle(px - 4, py, 5, g.accent); g.circle(px + 4, py, 5, g.accent); } else { g.circle(px, py, 8, g.ink); [-1, 0, 1].forEach((j) => g.circle(px + j * 8, py + 9, 4, g.accent)); } }
    g.text(`제한 반응물 ${r.limiting} · 진행 ${(r.progress * 100).toFixed(0)}%`, g.width / 2, g.height - 38, { align: "center", color: g.accent, size: 16, weight: 700 });
  },
  chart(v, r) { return { xLabel: "시간 (s)", yLabel: "생성 NH₃ (mol)", xDomain: [0, 12], yDomain: [0, Math.max(1, r.maxProduct * 1.1)], series: [{ points: points(0, 12, 100, (t) => ({ x: t, y: reactionLab.compute(v, t).product })) }] }; },
  caption(r) { return `제한 반응물 ${r.limiting} · 현재 NH₃ ${r.product.toFixed(2)} mol / 이론 최대 ${r.maxProduct.toFixed(2)} mol · 남는 반응물 ${r.leftover.toFixed(2)} mol.`; },
  sandbox: {
    view: "sandbox",
    title: "자유 반응기",
    instructions: "분자 카드 하나는 0.5 mol입니다. N₂와 H₂를 원하는 비율로 넣고 촉매 유무를 바꾸어 최대 생성량과 도달 속도를 함께 최적화하세요.",
    parts: [
      { type: "n2", label: "N₂ 0.5 mol", icon: "N≡N", max: 20 },
      { type: "h2", label: "H₂ 0.5 mol", icon: "H-H", max: 30 },
      { type: "catalyst", label: "철 촉매", icon: "Fe", max: 1 },
    ],
    initial: [{ type: "n2", x: 0.35, y: 0.4 }, { type: "n2", x: 0.42, y: 0.52 }, { type: "h2", x: 0.56, y: 0.34 }, { type: "h2", x: 0.62, y: 0.46 }, { type: "h2", x: 0.55, y: 0.6 }, { type: "catalyst", x: 0.7, y: 0.7 }],
    canLink() { return false; },
    evaluate(sandbox) { const n2 = sandbox.items.filter((item) => item.type === "n2").length; const h2 = sandbox.items.filter((item) => item.type === "h2").length; const exact = n2 > 0 && h2 === n2 * 3; return { valid: n2 > 0 && h2 > 0, summary: exact ? "정확한 1:3 입자비 · 두 반응물 잔량 0" : `현재 N₂:H₂ = ${n2}:${h2} · ${n2 && h2 ? "제한 반응물이 생깁니다." : "두 반응물이 모두 필요합니다."}` }; },
    draw(g, sandbox, result, time, ui) {
      const vessel = { x: 0.16 * g.width, y: 0.2 * g.height, w: 0.68 * g.width, h: 0.64 * g.height }; g.rect(vessel.x, vessel.y, vessel.w, vessel.h, rgba(g.accent, 0.035), g.ink, 2);
      sandbox.items.forEach((item) => { const x = item.x * g.width; const y = item.y * g.height; const selected = item.id === ui.selected; if (item.type === "n2") { g.circle(x - 8, y, 9, g.ink, selected ? g.accent : g.surface, selected ? 4 : 1); g.circle(x + 8, y, 9, g.ink, selected ? g.accent : g.surface, selected ? 4 : 1); g.line(x - 2, y - 4, x + 2, y - 4, g.surface, 1); g.line(x - 2, y, x + 2, y, g.surface, 1); g.line(x - 2, y + 4, x + 2, y + 4, g.surface, 1); } else if (item.type === "h2") { g.circle(x - 6, y, 7, g.accent, selected ? g.ink : g.surface, selected ? 4 : 1); g.circle(x + 6, y, 7, g.accent, selected ? g.ink : g.surface, selected ? 4 : 1); } else { g.rect(x - 28, y - 15, 56, 30, rgba(g.accent, 0.25), selected ? g.ink : g.accent, selected ? 4 : 2); g.text("Fe", x, y + 5, { align: "center", color: g.accent, weight: 800 }); } });
      g.text(`이론 최대 NH₃ ${result.maxProduct.toFixed(2)} mol · ${result.limiting}`, g.width / 2, g.height - 40, { align: "center", color: g.accent, size: 16, weight: 700 });
    },
  },
  limit: "대표 반응 N₂+3H₂→2NH₃를 단일 방향으로 단순화합니다. 실제 하버-보슈 공정의 가역 평형, 압력 효과, 표면 흡착 단계와 열역학적 안전 문제는 정밀 공정 모형이 필요합니다.",
};
