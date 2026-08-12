import {
  AU_KM,
  BODIES,
  BODY_BY_ID,
  LIGHT_SPEED_M_S,
  MODEL_VERSION,
  PRESETS,
  REFERENCE_OBJECTS,
  SOURCES,
  VIEW_DEFINITIONS,
  formatDuration,
  formatMetric,
  formatRealDistance,
  formatScale,
  getScale,
  modelRows,
  orbitRange,
  scaleInvariantReport,
} from "./data.js";

const root = document.querySelector("#lab");
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const log10 = (value) => Math.log10(Math.max(value, 1e-30));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const safeAlias = (value, fallback = "학생1") => {
  const cleaned = String(value || "").normalize("NFKC").replace(/[^0-9A-Za-z가-힣_-]/g, "").slice(0, 18);
  return cleaned || fallback;
};
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간이 막힌 환경에서도 현재 세션 실험은 계속한다.
  }
};
const storageKey = (suffix) => `stem101:cosmic-scale-lab:${suffix}`;

const initialPreset = PRESETS.find((item) => item.id === params.get("mission")) ?? PRESETS[0];
const preferences = readJson(storageKey("preferences"), {});
const initialClassCode = safeAlias(params.get("class"), preferences.classCode || "우주규모01");
const initialSeat = safeAlias(params.get("seat"), preferences.seat || "학생1");
const seatTokenKey = `stem101:seat-token:${initialClassCode}`;
const incomingSeatToken = params.get("seatToken") || "";
if (incomingSeatToken) {
  try {
    sessionStorage.setItem(seatTokenKey, incomingSeatToken);
  } catch {
    // 세션 저장이 막히면 현재 메모리에서 토큰을 사용한다.
  }
  params.delete("seatToken");
  history.replaceState(null, "", `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`);
}

let apiBase = "";
try {
  const candidate = params.get("api") || "";
  const parsed = new URL(candidate, location.href);
  if (candidate && ["http:", "https:"].includes(parsed.protocol)) apiBase = parsed.href.replace(/\/$/, "");
} catch {
  apiBase = "";
}

const state = {
  mode: params.get("mode") === "teacher" ? "teacher" : "student",
  depth: ["M1", "M2", "H1", "H2"].includes(params.get("depth")) ? params.get("depth") : preferences.depth || "M2",
  view: VIEW_DEFINITIONS[params.get("view")] ? params.get("view") : initialPreset.view,
  presetId: initialPreset.id,
  basis: params.get("basis") === "distance" ? "distance" : initialPreset.basis,
  referenceId: BODY_BY_ID[params.get("reference")] ? params.get("reference") : initialPreset.referenceId,
  modelValueM: Number(params.get("model")) > 0 ? Number(params.get("model")) : initialPreset.modelValueM,
  selected: BODY_BY_ID[params.get("selected")] ? params.get("selected") : initialPreset.selected,
  lensExponent: clamp(Number(params.get("lens") ?? 3), 0, 5),
  predictionExponent: clamp(Number(preferences.predictionExponent ?? 4), 3, 7),
  revealed: false,
  classCode: initialClassCode,
  seat: initialSeat,
  seats: readJson(storageKey(`seats:${initialClassCode}`), [initialSeat]),
  locks: readJson(storageKey(`locks:${initialClassCode}`), {}),
  trials: readJson(storageKey(`trials:${initialClassCode}`), []),
  saved: { A: null, B: null },
  camera: { center: 0, unitsPerPixel: 1 },
  needsFrame: true,
  light: { running: false, progress: 0, startedAt: 0 },
  remote: apiBase ? {
    apiBase,
    seatToken: incomingSeatToken || (() => {
      try { return sessionStorage.getItem(seatTokenKey) || ""; } catch { return ""; }
    })(),
    connected: false,
  } : null,
};

if (!state.seats.includes(state.seat)) state.seats.unshift(state.seat);

function optionList(items, selected, valueKey = "id", labelKey = "label") {
  return items.map((item) => `<option value="${escapeHtml(item[valueKey])}"${item[valueKey] === selected ? " selected" : ""}>${escapeHtml(item[labelKey])}</option>`).join("");
}

function buildShell() {
  const bodyOptions = BODIES.map((body) => `<option value="${body.id}">${body.name}</option>`).join("");
  const sourceLinks = SOURCES.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer">${source.label}</a>`).join("");
  root.innerHTML = `
    <div class="sim-shell cosmic-shell" data-depth="${state.depth}">
      <a class="cosmic-skip" href="#cosmic-stage">시뮬레이션 장면으로 이동</a>
      <header class="cosmic-header">
        <div class="cosmic-brand">
          <a class="cosmic-home" href="../../../../">STEM101</a>
          <div class="cosmic-title-wrap">
            <p>과학 · 수학 · 천문 규모</p>
            <h1>우주 규모·비유 검증 실험실</h1>
          </div>
        </div>
        <div class="cosmic-header-actions">
          <label class="cosmic-seat"><span>비식별 좌석</span><select data-seat aria-label="비식별 좌석 별칭"></select></label>
          <label><span class="cosmic-live">설명 깊이</span><select class="cosmic-depth" data-depth-select aria-label="설명 깊이">
            <option value="M1">중등 기초</option><option value="M2">중등 탐구</option><option value="H1">고등 개념</option><option value="H2">고등 심화</option>
          </select></label>
          <div class="cosmic-mode-switch" aria-label="사용자 모드"><span class="cosmic-live">사용자 모드</span>
            <button type="button" data-mode="student">학생</button><button type="button" data-mode="teacher">선생님</button>
          </div>
        </div>
      </header>

      <nav class="cosmic-viewbar" aria-label="비교 관점">
        ${Object.values(VIEW_DEFINITIONS).map((view) => `<button type="button" data-view="${view.id}">${view.label}</button>`).join("")}
        <span class="cosmic-view-hint" data-view-hint></span>
      </nav>

      <section class="cosmic-question" aria-labelledby="question-label">
        <strong id="question-label">오늘의 질문</strong>
        <p data-question></p>
        <button type="button" data-focus-selected>선택 천체에 맞추기</button>
      </section>

      <div class="cosmic-workspace">
        <section class="cosmic-stage-column" aria-label="축척 시뮬레이션">
          <div class="cosmic-stage" id="cosmic-stage">
            <canvas data-stage tabindex="0" role="img" aria-label="천체 크기와 거리를 같은 축척으로 배치한 상호작용 장면. 마우스 휠로 포인터 위치를 중심으로 확대하고 드래그하여 이동합니다."></canvas>
            <div class="cosmic-hud"><strong data-hud-title></strong><span data-hud-detail></span></div>
            <div class="cosmic-zoom" aria-label="장면 확대와 축소">
              <button type="button" data-zoom-in aria-label="확대">+</button><button type="button" data-zoom-out aria-label="축소">−</button><button type="button" data-reset-view>전체 맞춤</button>
            </div>
            <div class="cosmic-label-layer" data-label-layer aria-label="보이는 천체"></div>
            <div class="cosmic-scale-legend">
              <span><i class="cosmic-true-key"></i>실선 = 실제 모형 크기</span>
              <span><i class="cosmic-lens-key"></i>점선 = 보기 렌즈 <b data-lens-key>×1,000</b></span>
            </div>
            <div class="cosmic-minimap" aria-label="전체 범위 미니맵">
              <button type="button" data-minimap aria-label="미니맵에서 위치 이동"><svg viewBox="0 0 250 94" role="img" aria-label="전체 축척 범위와 현재 화면 범위"></svg></button>
            </div>
            <span class="cosmic-live" aria-live="polite" data-live></span>
          </div>
          <div class="cosmic-transport">
            <button type="button" data-prev aria-label="이전 천체">← 이전</button>
            <button type="button" data-next aria-label="다음 천체">다음 →</button>
            <div class="cosmic-light-progress"><progress max="1" value="0" data-light-progress aria-label="빛 이동 진행률"></progress><output data-light-time>빛 0초</output></div>
            <button type="button" data-light-play>빛 보내기</button>
            <span class="cosmic-stage-scale" data-stage-scale></span>
          </div>
        </section>

        <aside class="cosmic-sidebar" aria-label="실험 조작과 측정">
          <section class="cosmic-panel">
            <h2>1. 미션 선택</h2>
            <label class="cosmic-field">사례
              <select class="cosmic-mission-select" data-mission>${optionList(PRESETS, state.presetId, "id", "title")}</select>
            </label>
            <p class="cosmic-mission-question" data-mission-question></p>
            <button class="cosmic-primary-action" type="button" data-apply-mission>이 조건으로 시작</button>
          </section>

          <section class="cosmic-panel">
            <h2>2. 축척 만들기</h2>
            <div class="cosmic-segment" aria-label="기준 종류">
              <button type="button" data-basis="diameter">지름 기준</button><button type="button" data-basis="distance">거리 기준</button>
            </div>
            <label class="cosmic-field">기준 천체
              <select data-reference>${bodyOptions}</select>
            </label>
            <label class="cosmic-field">생활 속 기준물
              <select data-reference-object>${optionList(REFERENCE_OBJECTS, "soccer")}</select>
            </label>
            <label class="cosmic-field"><span data-model-value-label>모형 값 (m)</span>
              <input type="number" min="0.000000001" step="any" inputmode="decimal" data-model-value>
            </label>
            <div class="cosmic-field-row"><span>축척</span><strong data-scale></strong></div>
            <div class="cosmic-equation" data-scale-equation></div>
          </section>

          <section class="cosmic-panel">
            <h2>3. 보기 렌즈</h2>
            <p>거리와 계산값은 그대로 두고 화면의 천체 원만 확대합니다. 위치 표시 십자선은 렌즈와 무관합니다.</p>
            <label class="cosmic-field"><span class="cosmic-field-row"><span>천체 원 확대</span><output data-lens-output></output></span>
              <input type="range" min="0" max="5" step="0.25" data-lens aria-label="천체 보기 렌즈 배율의 상용로그">
            </label>
          </section>

          <section class="cosmic-panel">
            <h2>4. 선택 천체 측정</h2>
            <label class="cosmic-field">천체
              <select data-selected>${bodyOptions}</select>
            </label>
            <div class="cosmic-readout-grid" data-readouts></div>
            <div class="cosmic-equation" data-selected-equation></div>
          </section>

          <section class="cosmic-panel cosmic-reveal-cover" data-reveal-cover="false">
            <h2>5. 먼저 예상, 다음 측정</h2>
            <p>지구–태양 대표 거리에 지구 지름이 몇 개 들어갈지 자릿수부터 예상하세요. 이 비율은 축척을 바꿔도 같습니다.</p>
            <label class="cosmic-field"><span class="cosmic-field-row"><span>예상 거리비</span><output class="cosmic-prediction-value" data-prediction-value></output></span>
              <input type="range" min="3" max="7" step="0.01" data-prediction aria-label="예상 지구 거리와 태양 지름의 비율">
            </label>
            <button class="cosmic-primary-action" type="button" data-reveal>예측 고정 · 결과 보기</button>
            <div class="cosmic-result-only">
              <div class="cosmic-readout-grid" data-prediction-result></div>
              <p class="cosmic-error-note" data-prediction-note></p>
            </div>
            <div class="cosmic-actions">
              <button type="button" data-save="A">A 저장</button><button type="button" data-save="B">B 저장</button>
              <button class="cosmic-primary-action" type="button" data-submit>학급 표본에 제출</button>
            </div>
          </section>
        </aside>
      </div>

      <section class="cosmic-evidence" id="evidence">
        <div class="cosmic-section-heading"><p>COMPARE · COLLECT · EXPLAIN</p><h2>한 번의 답이 아니라, 비교와 학급 표본으로 검증합니다</h2></div>
        <div class="cosmic-evidence-grid">
          <article class="cosmic-evidence-card">
            <h3>A/B 축척 비교</h3><p>기준물을 바꾼 두 시행에서 모든 길이가 같은 비율로 바뀌는지 확인하세요.</p>
            <div data-ab-result></div>
          </article>
          <article class="cosmic-evidence-card">
            <h3>학급의 자릿수 감각</h3><p>점 하나가 비식별 좌석 하나의 예측입니다. 진한 점이 내 결과입니다. 1.0 자릿수 오차는 실제의 10배 또는 1/10배 예상입니다.</p>
            <div class="cosmic-stats-summary" data-stats-summary></div>
            <div class="cosmic-stats-chart" data-stats-chart></div>
            <div class="cosmic-trials-scroll" data-trial-table></div>
          </article>
        </div>
      </section>

      <section class="cosmic-data-section">
        <div class="cosmic-section-heading"><p>ONE SCALE · ALL OBJECTS</p><h2>반올림 전 계산값으로 천체 전체를 비교합니다</h2></div>
        <div class="cosmic-data-scroll"><table class="cosmic-data-table">
          <thead><tr><th>천체</th><th>실제 지름</th><th>모형 지름</th><th>거리 기준</th><th>실제 대표 거리</th><th>모형 거리</th><th>빛 시간</th></tr></thead>
          <tbody data-data-table></tbody>
        </table></div>
      </section>

      <section class="cosmic-principles">
        <div class="cosmic-section-heading"><p>FROM PRINCIPLE TO MODEL LIMIT</p><h2>숫자가 왜 그렇게 되는지, 모형이 어디서 멈추는지</h2></div>
        <div class="cosmic-principle-grid" data-principles></div>
        <div class="cosmic-limit"><strong>모형의 경계.</strong> 행성의 ‘대표 거리’는 현재 위치가 아니라 궤도 장반경입니다. 행성은 한 줄에 고정되어 있지 않고 타원 궤도를 돌며, 지구–화성처럼 두 행성 사이 거리는 시점에 따라 달라집니다. 가스행성의 지름은 구름층 기준이고 프록시마의 지름은 추정값입니다. 이 랩은 규모 관계를 검증하는 도구이지 특정 날짜의 천체 위치 예측기가 아닙니다.
          <div class="cosmic-sources">${sourceLinks}</div>
        </div>
      </section>

      <section class="cosmic-teacher" data-teacher hidden>
        <div class="cosmic-section-heading"><p>TEACHER MODE · 60 MINUTES</p><h2>비식별 좌석과 한 시간 수업 운영</h2></div>
        <div class="cosmic-teacher-grid">
          <article class="cosmic-teacher-card">
            <h3>수업·좌석 만들기</h3>
            <label>수업 코드 <input type="text" maxlength="18" data-class-code></label>
            <label>별칭 접두어 <input type="text" maxlength="12" value="학생" data-seat-prefix></label>
            <label>좌석 수 <input type="number" min="1" max="40" value="24" data-seat-count></label>
            <div class="cosmic-actions"><button type="button" data-create-seats>좌석 생성</button><button type="button" data-demo-samples>예시 24개</button></div>
            <p>이름·이메일 등 개인정보는 묻거나 저장하지 않습니다. 원격 감독자 계정의 좌석 한도는 관리 콘솔에서 적용됩니다.</p>
            <div class="cosmic-seat-links" data-seat-links></div>
          </article>
          <article class="cosmic-teacher-card">
            <h3>학생 조작 잠금</h3>
            <label><input type="checkbox" data-lock="basis"> 기준 종류</label>
            <label><input type="checkbox" data-lock="referenceId"> 기준 천체</label>
            <label><input type="checkbox" data-lock="modelValueM"> 모형 값</label>
            <label><input type="checkbox" data-lock="lensExponent"> 보기 렌즈</label>
            <div class="cosmic-actions"><button type="button" data-export>CSV 내보내기</button><button type="button" data-clear-class>표본 비우기</button></div>
            <p class="cosmic-status" data-remote-status></p>
          </article>
          <article class="cosmic-teacher-card">
            <h3>권장 60분 흐름</h3>
            <ol class="cosmic-lesson-flow">
              <li>0–7분: 축구공 태양 비유를 보고 지구 크기·거리 개인 예상</li>
              <li>7–20분: 동일 축척 계산과 실제 크기/보기 렌즈 구분</li>
              <li>20–32분: A/B로 축구공 태양과 6 mm 지구의 축척 충돌 검증</li>
              <li>32–44분: 운동장·책상·프록시마 미션을 모둠별 자유 탐구</li>
              <li>44–53분: 비식별 학급 산점도에서 내 오차와 분포 해석</li>
              <li>53–60분: 대표 거리·타원 궤도·모형 한계로 주장 수정</li>
            </ol>
          </article>
        </div>
      </section>

      <div class="cosmic-toast" role="status" data-toast hidden></div>
    </div>`;
}

buildShell();

const elements = {
  shell: root.querySelector(".cosmic-shell"),
  canvas: root.querySelector("[data-stage]"),
  labelLayer: root.querySelector("[data-label-layer]"),
  minimap: root.querySelector("[data-minimap]"),
  minimapSvg: root.querySelector("[data-minimap] svg"),
  viewButtons: [...root.querySelectorAll("[data-view]")],
  viewHint: root.querySelector("[data-view-hint]"),
  question: root.querySelector("[data-question]"),
  hudTitle: root.querySelector("[data-hud-title]"),
  hudDetail: root.querySelector("[data-hud-detail]"),
  lensKey: root.querySelector("[data-lens-key]"),
  lens: root.querySelector("[data-lens]"),
  lensOutput: root.querySelector("[data-lens-output]"),
  mission: root.querySelector("[data-mission]"),
  missionQuestion: root.querySelector("[data-mission-question]"),
  basisButtons: [...root.querySelectorAll("[data-basis]")],
  reference: root.querySelector("[data-reference]"),
  referenceObject: root.querySelector("[data-reference-object]"),
  modelValue: root.querySelector("[data-model-value]"),
  modelValueLabel: root.querySelector("[data-model-value-label]"),
  scale: root.querySelector("[data-scale]"),
  scaleEquation: root.querySelector("[data-scale-equation]"),
  selected: root.querySelector("[data-selected]"),
  readouts: root.querySelector("[data-readouts]"),
  selectedEquation: root.querySelector("[data-selected-equation]"),
  prediction: root.querySelector("[data-prediction]"),
  predictionValue: root.querySelector("[data-prediction-value]"),
  predictionResult: root.querySelector("[data-prediction-result]"),
  predictionNote: root.querySelector("[data-prediction-note]"),
  revealCover: root.querySelector("[data-reveal-cover]"),
  reveal: root.querySelector("[data-reveal]"),
  submit: root.querySelector("[data-submit]"),
  dataTable: root.querySelector("[data-data-table]"),
  abResult: root.querySelector("[data-ab-result]"),
  statsSummary: root.querySelector("[data-stats-summary]"),
  statsChart: root.querySelector("[data-stats-chart]"),
  trialTable: root.querySelector("[data-trial-table]"),
  principles: root.querySelector("[data-principles]"),
  seat: root.querySelector("[data-seat]"),
  depth: root.querySelector("[data-depth-select]"),
  modeButtons: [...root.querySelectorAll("[data-mode]")],
  teacher: root.querySelector("[data-teacher]"),
  classCode: root.querySelector("[data-class-code]"),
  seatLinks: root.querySelector("[data-seat-links]"),
  lockInputs: [...root.querySelectorAll("[data-lock]")],
  remoteStatus: root.querySelector("[data-remote-status]"),
  lightProgress: root.querySelector("[data-light-progress]"),
  lightTime: root.querySelector("[data-light-time]"),
  lightPlay: root.querySelector("[data-light-play]"),
  stageScale: root.querySelector("[data-stage-scale]"),
  live: root.querySelector("[data-live]"),
  toast: root.querySelector("[data-toast]"),
};

const context = elements.canvas.getContext("2d");
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;
let report = scaleInvariantReport(state);
let labelButtons = new Map();
let screenObjects = [];
let toastTimer = 0;
let animationFrame = 0;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2600);
}

function viewBodies() {
  if (state.view === "moon") return [BODY_BY_ID.earth, BODY_BY_ID.moon];
  if (state.view === "star") return [BODY_BY_ID.sun, BODY_BY_ID.earth, BODY_BY_ID.proxima];
  if (state.view === "log") return BODIES;
  return BODIES.filter((body) => body.id === "sun" || (body.parent === "sun" && body.id !== "proxima"));
}

function axisValue(body) {
  const row = report.rows[body.id];
  if (state.view === "log") return log10(Math.max(row.distanceM, row.diameterM / 2));
  if (state.view === "moon") return body.id === "earth" ? 0 : row.distanceM;
  return body.id === "sun" ? 0 : row.distanceM;
}

function sceneBounds() {
  const bodies = viewBodies();
  const values = bodies.map(axisValue);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (state.view === "log") {
    min -= .6;
    max += .6;
  } else {
    const span = Math.max(max - min, report.rows[state.selected]?.diameterM || 1, 1e-9);
    min -= span * .035;
    max += span * .05;
  }
  return { min, max, span: Math.max(max - min, 1e-9) };
}

function visibleWorld() {
  const half = state.camera.unitsPerPixel * canvasWidth / 2;
  return { min: state.camera.center - half, max: state.camera.center + half };
}

function worldToScreen(value) {
  return canvasWidth / 2 + (value - state.camera.center) / state.camera.unitsPerPixel;
}

function screenToWorld(x) {
  return state.camera.center + (x - canvasWidth / 2) * state.camera.unitsPerPixel;
}

function frameScene(targetId = state.selected) {
  if (!canvasWidth) return;
  const target = BODY_BY_ID[targetId] && viewBodies().some((body) => body.id === targetId) ? BODY_BY_ID[targetId] : viewBodies().at(-1);
  const targetValue = axisValue(target);
  const parentValue = state.view === "log" ? sceneBounds().min : 0;
  const full = sceneBounds();
  let min = Math.min(parentValue, targetValue);
  let max = Math.max(parentValue, targetValue);
  if (target.id === "sun" && state.view !== "log") {
    const sun = report.rows.sun;
    min = -sun.diameterM * 1.4;
    max = sun.diameterM * 2.8;
  }
  if (state.view === "log") {
    min = full.min;
    max = full.max;
  }
  const span = Math.max(max - min, full.span * (state.view === "log" ? .2 : .002), 1e-12);
  state.camera.center = (min + max) / 2;
  state.camera.unitsPerPixel = span / Math.max(160, canvasWidth * .76);
  state.needsFrame = false;
  drawScene();
}

function zoomAt(screenX, factor) {
  const before = screenToWorld(screenX);
  const bounds = sceneBounds();
  const minUnits = Math.max(bounds.span / 1e8, 1e-14);
  const maxUnits = bounds.span / Math.max(60, canvasWidth * .08);
  state.camera.unitsPerPixel = clamp(state.camera.unitsPerPixel * factor, minUnits, maxUnits);
  state.camera.center = before - (screenX - canvasWidth / 2) * state.camera.unitsPerPixel;
  drawScene();
}

function cssColor(name, fallback) {
  return getComputedStyle(elements.shell).getPropertyValue(name).trim() || fallback;
}

function niceStep(raw) {
  const power = 10 ** Math.floor(log10(raw));
  const ratio = raw / power;
  const nice = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10;
  return nice * power;
}

function drawGrid(colors, baseY) {
  const { min, max } = visibleWorld();
  context.save();
  context.lineWidth = 1;
  context.font = "10px SFMono-Regular, Consolas, monospace";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = colors.muted;
  context.strokeStyle = colors.line;

  if (state.view === "log") {
    for (let exponent = Math.floor(min); exponent <= Math.ceil(max); exponent += 1) {
      const x = worldToScreen(exponent);
      if (x < -20 || x > canvasWidth + 20) continue;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
      context.stroke();
      context.fillText(`10^${exponent} m`, x, canvasHeight - 30);
    }
    context.textAlign = "left";
    context.fillText("각 점 = 태양 지름 또는 부모 천체에서의 대표 거리 · 같은 화면 간격 = 10배", 16, canvasHeight - 52);
    context.restore();
    return;
  }

  const step = niceStep((max - min) / 9);
  const first = Math.floor(min / step) * step;
  for (let value = first; value <= max + step; value += step) {
    const x = worldToScreen(value);
    if (x < -20 || x > canvasWidth + 20) continue;
    context.globalAlpha = Math.abs(Math.round(value / step)) % 5 === 0 ? .9 : .52;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvasHeight);
    context.stroke();
    context.fillText(formatMetric(value, 2), x, canvasHeight - 30);
  }
  context.globalAlpha = 1;
  context.beginPath();
  context.moveTo(0, baseY);
  context.lineTo(canvasWidth, baseY);
  context.strokeStyle = colors.muted;
  context.stroke();

  if (state.view === "solar") {
    const lane = 46;
    for (let y = baseY - lane * 3; y <= baseY + lane * 3; y += lane) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
      context.strokeStyle = colors.line;
      context.stroke();
    }
    context.textAlign = "left";
    context.fillText("학교 운동장 직선 모형 · 거리와 지름은 같은 축척", 16, canvasHeight - 52);
  } else if (state.view === "moon") {
    context.textAlign = "left";
    context.fillText("책상 눈금 · 지구 중심에서 달 중심까지", 16, canvasHeight - 52);
  } else if (state.view === "star") {
    context.textAlign = "left";
    context.fillText("도로 거리 모형 · 태양계와 프록시마 사이를 같은 축척으로 연장", 16, canvasHeight - 52);
  }
  context.restore();
}

function sceneLabel(body) {
  if (state.view !== "log") return body.short;
  if (body.id === "sun") return "태양 지름";
  if (body.id === "moon") return "지구–달 간격";
  return `${body.short} 거리`;
}

function layoutLabels(objects, baseY) {
  const placed = [];
  const slots = [-70, 70, -122, 122, -174, 174];
  const sorted = [...objects].sort((a, b) => a.x - b.x);
  for (const object of sorted) {
    const width = Math.max(50, sceneLabel(object.body).length * 14 + 18);
    let chosenY = clamp(baseY + slots[0], 70, canvasHeight - 100);
    for (const offset of slots) {
      const candidateY = clamp(baseY + offset, 70, canvasHeight - 100);
      const overlaps = placed.some((item) => Math.abs(item.x - object.x) < (item.width + width) / 2 + 6 && Math.abs(item.labelY - candidateY) < 50);
      if (!overlaps) {
        chosenY = candidateY;
        break;
      }
    }
    placed.push({ ...object, labelY: chosenY, width });
  }
  return placed;
}

function syncLabelButtons(layout) {
  const active = new Set(layout.map((item) => item.body.id));
  for (const [id, button] of labelButtons) {
    if (!active.has(id)) {
      button.remove();
      labelButtons.delete(id);
    }
  }
  for (const item of layout) {
    let button = labelButtons.get(item.body.id);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "cosmic-label";
      button.dataset.body = item.body.id;
      button.addEventListener("click", () => selectBody(item.body.id, true));
      elements.labelLayer.append(button);
      labelButtons.set(item.body.id, button);
    }
    button.textContent = sceneLabel(item.body);
    button.style.left = `${item.x}px`;
    button.style.top = `${item.labelY}px`;
    button.setAttribute("aria-current", String(item.body.id === state.selected));
    button.setAttribute("aria-label", `${item.body.name} 선택`);
  }
}

function drawBody(item, colors) {
  const lensFactor = 10 ** state.lensExponent;
  const linear = state.view !== "log";
  const trueRadius = linear ? item.row.diameterM / (2 * state.camera.unitsPerPixel) : 0;
  const lensRadius = linear ? trueRadius * lensFactor : 8 + state.lensExponent * 1.7;
  const visibleLens = clamp(lensRadius, 0, 31);
  const selected = item.body.id === state.selected;

  context.save();
  context.translate(item.x, item.y);
  context.strokeStyle = selected ? colors.secondary : colors.muted;
  context.lineWidth = selected ? 2 : 1;
  context.beginPath();
  context.moveTo(-5, 0);
  context.lineTo(5, 0);
  context.moveTo(0, -5);
  context.lineTo(0, 5);
  context.stroke();

  if (trueRadius >= .45 && trueRadius <= Math.max(canvasWidth, canvasHeight) * 2) {
    context.beginPath();
    context.arc(0, 0, trueRadius, 0, Math.PI * 2);
    context.fillStyle = selected ? colors.secondary : colors.ink;
    context.globalAlpha = selected ? .3 : .16;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = colors.ink;
    context.lineWidth = 1.25;
    context.stroke();
  }

  if (state.lensExponent > 0 && visibleLens >= 2) {
    context.beginPath();
    context.arc(0, 0, Math.max(3, visibleLens), 0, Math.PI * 2);
    context.setLineDash([4, 4]);
    context.strokeStyle = colors.secondary;
    context.globalAlpha = selected ? 1 : .62;
    context.lineWidth = selected ? 2 : 1;
    context.stroke();
  }
  context.restore();
  return { trueRadius, lensRadius: visibleLens };
}

function drawPhoton(colors, bodyY) {
  if (state.light.progress <= 0) return;
  const target = report.rows[state.selected]?.distanceM > 0 ? BODY_BY_ID[state.selected] : BODY_BY_ID.earth;
  if (!viewBodies().some((body) => body.id === target.id)) return;
  const start = state.view === "log" ? axisValue(BODY_BY_ID.sun) : 0;
  const end = axisValue(target);
  const value = start + (end - start) * state.light.progress;
  const x = worldToScreen(value);
  if (x < -15 || x > canvasWidth + 15) return;
  context.save();
  context.fillStyle = colors.secondary;
  context.strokeStyle = colors.secondary;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, bodyY, 6, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = .35;
  context.beginPath();
  context.moveTo(worldToScreen(start), bodyY);
  context.lineTo(x, bodyY);
  context.stroke();
  context.restore();
}

function updateMinimap() {
  const bounds = sceneBounds();
  const current = visibleWorld();
  const pad = 12;
  const width = 226;
  const mapX = (value) => pad + (value - bounds.min) / bounds.span * width;
  const windowX = clamp(mapX(current.min), pad, pad + width);
  const windowRight = clamp(mapX(current.max), pad, pad + width);
  const objects = viewBodies().map((body) => {
    const x = clamp(mapX(axisValue(body)), pad, pad + width);
    return `<circle class="${body.id === state.selected ? "overview-target" : "overview-object"}" cx="${x.toFixed(2)}" cy="49" r="${body.id === state.selected ? 3.6 : 2}"/>`;
  }).join("");
  elements.minimapSvg.innerHTML = `
    <text x="12" y="14">전체 범위</text>
    <line class="overview-line" x1="12" y1="49" x2="238" y2="49"/>
    ${objects}
    <rect class="overview-window" x="${windowX.toFixed(2)}" y="27" width="${Math.max(4, windowRight - windowX).toFixed(2)}" height="44"/>
    <text x="12" y="86">현재 화면</text>`;
}

function drawScene() {
  if (!canvasWidth || !canvasHeight) return;
  const colors = {
    surface: cssColor("--sim-surface-0", "#080B15"),
    ink: cssColor("--sim-ink", "#EDF4F2"),
    muted: cssColor("--sim-muted", "#9AABB0"),
    line: cssColor("--sim-line", "rgba(237,244,242,.16)"),
    secondary: cssColor("--sim-color-secondary", "#FF6B5E"),
  };
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = colors.surface;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const baseY = Math.round(canvasHeight * .54);
  drawGrid(colors, baseY);
  const candidates = viewBodies().map((body, index) => {
    const x = worldToScreen(axisValue(body));
    const y = baseY + (state.view === "solar" && index % 2 ? 6 : 0);
    return { body, row: report.rows[body.id], x, y };
  }).filter((item) => item.x > -80 && item.x < canvasWidth + 80);
  const layout = layoutLabels(candidates, baseY);

  context.save();
  context.strokeStyle = colors.line;
  context.lineWidth = 1;
  for (const item of layout) {
    context.beginPath();
    context.moveTo(item.x, item.y + (item.labelY > item.y ? 7 : -7));
    context.lineTo(item.x, item.labelY + (item.labelY > item.y ? -17 : 17));
    context.stroke();
  }
  context.restore();

  screenObjects = candidates.map((item) => ({ ...item, ...drawBody(item, colors) }));
  drawPhoton(colors, baseY);
  syncLabelButtons(layout);
  updateMinimap();

  const selected = report.rows[state.selected] ?? report.rows.earth;
  const view = VIEW_DEFINITIONS[state.view];
  elements.hudTitle.textContent = `${view.label} · ${formatScale(report.scale)}`;
  elements.hudDetail.textContent = state.view === "log"
    ? "점 위치 = 모형 길이의 log₁₀ · 태양은 지름, 나머지는 부모 천체에서의 대표 거리"
    : `선택 ${selected.name} · 모형 거리 ${formatMetric(selected.distanceM)} · 모형 지름 ${formatMetric(selected.diameterM)}`;
  elements.stageScale.textContent = state.view === "log"
    ? `화면 1 px = ${state.camera.unitsPerPixel.toFixed(3)} 자릿수`
    : `화면 1 px = ${formatMetric(state.camera.unitsPerPixel, 2)}`;
  elements.lensKey.textContent = `×${Math.round(10 ** state.lensExponent).toLocaleString("ko-KR")}`;
}

function resizeCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  canvasWidth = Math.max(1, Math.round(rect.width));
  canvasHeight = Math.max(1, Math.round(rect.height));
  dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
  elements.canvas.width = Math.round(canvasWidth * dpr);
  elements.canvas.height = Math.round(canvasHeight * dpr);
  if (state.needsFrame) frameScene(); else drawScene();
}

function currentMission() {
  return PRESETS.find((item) => item.id === state.presetId) ?? PRESETS[0];
}

function selectedRow() {
  return report.rows[state.selected] ?? report.rows.earth;
}

function parentName(body) {
  return body.parent ? BODY_BY_ID[body.parent].name : "기준점";
}

function referenceRealMeters() {
  const reference = BODY_BY_ID[state.referenceId];
  return (state.basis === "distance" ? reference.distanceKm : reference.diameterKm) * 1_000;
}

function formatCompact(value, digits = 3) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e7 || (Math.abs(value) > 0 && Math.abs(value) < 1e-3)) return value.toExponential(2);
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function renderMode() {
  elements.modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode)));
  elements.teacher.hidden = state.mode !== "teacher";
  elements.lockInputs.forEach((input) => { input.checked = Boolean(state.locks[input.dataset.lock]); });
}

function renderSeats() {
  if (!state.seats.includes(state.seat)) state.seats.unshift(state.seat);
  elements.seat.innerHTML = state.seats.map((seat) => `<option value="${escapeHtml(seat)}"${seat === state.seat ? " selected" : ""}>${escapeHtml(seat)}</option>`).join("");
  elements.classCode.value = state.classCode;
  const baseUrl = new URL(location.href);
  baseUrl.searchParams.delete("seatToken");
  baseUrl.searchParams.set("class", state.classCode);
  baseUrl.searchParams.set("mode", "student");
  elements.seatLinks.innerHTML = state.seats.map((seat) => {
    const url = new URL(baseUrl);
    url.searchParams.set("seat", seat);
    return `<div class="cosmic-seat-link"><strong>${escapeHtml(seat)}</strong><code title="${escapeHtml(url.href)}">${escapeHtml(url.href)}</code></div>`;
  }).join("");
}

function controlLocked(key) {
  return state.mode === "student" && Boolean(state.locks[key]);
}

function renderControls() {
  const mission = currentMission();
  elements.mission.value = state.presetId;
  elements.missionQuestion.textContent = mission.question;
  elements.question.textContent = mission.question;
  elements.viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === state.view)));
  elements.viewHint.textContent = VIEW_DEFINITIONS[state.view].hint;
  elements.basisButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.basis === state.basis));
    button.disabled = controlLocked("basis");
  });
  [...elements.reference.options].forEach((option) => {
    const body = BODY_BY_ID[option.value];
    option.disabled = state.basis === "distance" && !(body.distanceKm > 0);
  });
  if (state.basis === "distance" && !(BODY_BY_ID[state.referenceId].distanceKm > 0)) state.referenceId = "earth";
  elements.reference.value = state.referenceId;
  elements.reference.disabled = controlLocked("referenceId");
  elements.modelValue.value = String(state.modelValueM);
  elements.modelValue.disabled = controlLocked("modelValueM");
  elements.modelValueLabel.textContent = state.basis === "distance" ? "모형 대표 거리 (m)" : "모형 지름 (m)";
  const matchingObject = REFERENCE_OBJECTS.find((item) => item.meters != null && Math.abs(item.meters - state.modelValueM) < Math.max(1e-12, state.modelValueM * 1e-9));
  elements.referenceObject.value = matchingObject?.id ?? "custom";
  elements.referenceObject.disabled = controlLocked("modelValueM");
  elements.scale.textContent = formatScale(report.scale);
  const reference = BODY_BY_ID[state.referenceId];
  elements.scaleEquation.innerHTML = `축척 S = ${formatMetric(state.modelValueM)} ÷ ${state.basis === "distance" ? formatRealDistance(reference.distanceKm) : `${formatCompact(reference.diameterKm, 3)} km`}<br>S = ${report.scale.toExponential(6)}<br>모형 길이 = 실제 길이 × S`;
  elements.lens.value = String(state.lensExponent);
  elements.lens.disabled = controlLocked("lensExponent");
  elements.lensOutput.textContent = `×${Math.round(10 ** state.lensExponent).toLocaleString("ko-KR")}`;
  elements.selected.value = state.selected;
  elements.depth.value = state.depth;
}

function renderSelected() {
  const row = selectedRow();
  const body = BODY_BY_ID[row.id];
  const orbit = orbitRange(body);
  const walkSeconds = row.distanceM / 1.4;
  const distanceLabel = row.distanceKm > 0 ? formatRealDistance(row.distanceKm) : "기준점";
  elements.readouts.innerHTML = `
    <div class="cosmic-readout"><span>실제 지름</span><strong>${formatCompact(row.diameterKm, 3)} km</strong></div>
    <div class="cosmic-readout"><span>모형 지름</span><strong>${formatMetric(row.diameterM)}</strong></div>
    <div class="cosmic-readout"><span>${row.distanceKm > 0 ? `${parentName(body)}에서 대표 거리` : "거리 기준"}</span><strong>${distanceLabel}</strong></div>
    <div class="cosmic-readout"><span>모형 대표 거리</span><strong>${row.distanceKm > 0 ? formatMetric(row.distanceM) : "0 m"}</strong></div>
    <div class="cosmic-readout"><span>빛의 실제 이동 시간</span><strong>${row.distanceKm > 0 ? formatDuration(row.lightSeconds) : "0초"}</strong></div>
    <div class="cosmic-readout"><span>모형을 걸으면 · 1.4 m/s</span><strong>${row.distanceKm > 0 ? formatDuration(walkSeconds) : "0초"}</strong></div>`;
  const rangeText = orbit && row.distanceKm > 0
    ? `<br>타원 범위 = ${formatMetric(row.periapsisM)} – ${formatMetric(row.apoapsisM)}`
    : "";
  elements.selectedEquation.innerHTML = `${formatCompact(row.diameterKm * 1_000, 2)} m × ${report.scale.toExponential(4)} = <strong>${formatMetric(row.diameterM)}</strong>${row.distanceKm > 0 ? `<br>${formatCompact(row.distanceKm * 1_000, 2)} m × S = <strong>${formatMetric(row.distanceM)}</strong>` : ""}${rangeText}`;
}

function renderPrediction() {
  const predicted = report.predictionRatio;
  const actual = report.earthDiameterDistanceRatio;
  elements.prediction.value = String(state.predictionExponent);
  elements.predictionValue.textContent = `${Math.round(predicted).toLocaleString("ko-KR")}배`;
  elements.revealCover.dataset.revealed = String(state.revealed);
  elements.reveal.textContent = state.revealed ? "예측 다시 조정" : "예측 고정 · 결과 보기";
  elements.predictionResult.innerHTML = `
    <div class="cosmic-readout"><span>지구 지름 단위 거리비</span><strong>${actual.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}배</strong></div>
    <div class="cosmic-readout"><span>자릿수 오차</span><strong>${report.absoluteOrderError.toFixed(3)}</strong></div>`;
  if (!state.revealed) {
    elements.predictionNote.textContent = "결과를 열기 전 예상값을 정하세요.";
  } else if (report.absoluteOrderError < .05) {
    elements.predictionNote.textContent = "거의 정확합니다. 축척을 바꿔도 이 거리비는 그대로입니다.";
  } else {
    const factor = 10 ** report.absoluteOrderError;
    elements.predictionNote.textContent = `${report.signedOrderError > 0 ? "크게" : "작게"} 예상했습니다. 실제값과 약 ${factor.toFixed(factor < 10 ? 2 : 1)}배 차이입니다.`;
  }
  elements.submit.disabled = !state.revealed;
}

function renderDataTable() {
  elements.dataTable.innerHTML = modelRows(report.scale).map((row) => {
    const body = BODY_BY_ID[row.id];
    const distanceBasis = body.id === "sun" ? "—" : `${parentName(body)} 중심`;
    return `<tr aria-current="${row.id === state.selected}">
      <td><button type="button" data-table-body="${row.id}">${row.name}${row.diameterKind === "estimated" ? " · 약" : ""}</button></td>
      <td>${formatCompact(row.diameterKm, 3)} km</td>
      <td>${formatMetric(row.diameterM)}</td>
      <td>${distanceBasis}</td>
      <td>${row.distanceKm > 0 ? formatRealDistance(row.distanceKm) : "—"}</td>
      <td>${row.distanceKm > 0 ? formatMetric(row.distanceM) : "—"}</td>
      <td>${row.distanceKm > 0 ? formatDuration(row.lightSeconds) : "—"}</td>
    </tr>`;
  }).join("");
  root.querySelectorAll("[data-table-body]").forEach((button) => button.addEventListener("click", () => selectBody(button.dataset.tableBody, true)));
}

function snapshot(label) {
  return {
    label,
    basis: state.basis,
    referenceId: state.referenceId,
    modelValueM: state.modelValueM,
    scale: report.scale,
    scaleDenominator: 1 / report.scale,
    sunDiameterM: report.rows.sun.diameterM,
    earthDiameterM: report.rows.earth.diameterM,
    earthDistanceM: report.rows.earth.distanceM,
    neptuneDistanceM: report.rows.neptune.distanceM,
    proximaDistanceM: report.rows.proxima.distanceM,
  };
}

function renderAb() {
  const a = state.saved.A;
  const b = state.saved.B;
  if (!a || !b) {
    elements.abResult.innerHTML = `<p>A와 B를 각각 저장하면 축척비와 네 가지 길이의 변화비가 나타납니다.</p><table class="cosmic-ab-table"><thead><tr><th>시행</th><th>기준</th><th>축척</th></tr></thead><tbody><tr><td>A</td><td>${a ? `${BODY_BY_ID[a.referenceId].short} ${formatMetric(a.modelValueM)}` : "저장 전"}</td><td>${a ? formatScale(a.scale) : "—"}</td></tr><tr><td>B</td><td>${b ? `${BODY_BY_ID[b.referenceId].short} ${formatMetric(b.modelValueM)}` : "저장 전"}</td><td>${b ? formatScale(b.scale) : "—"}</td></tr></tbody></table>`;
    return;
  }
  const ratio = b.scale / a.scale;
  const rows = [
    ["축척 S", a.scale, b.scale, "number"],
    ["태양 지름", a.sunDiameterM, b.sunDiameterM, "metric"],
    ["지구 지름", a.earthDiameterM, b.earthDiameterM, "metric"],
    ["지구 거리", a.earthDistanceM, b.earthDistanceM, "metric"],
    ["해왕성 거리", a.neptuneDistanceM, b.neptuneDistanceM, "metric"],
    ["프록시마 거리", a.proximaDistanceM, b.proximaDistanceM, "metric"],
  ];
  elements.abResult.innerHTML = `<p>B/A 축척비는 <strong>${ratio.toFixed(6)}배</strong>입니다. 모든 모형 길이도 반올림 전에는 정확히 이 비율로 변합니다.</p><table class="cosmic-ab-table"><thead><tr><th>양</th><th>A</th><th>B</th><th>B/A</th></tr></thead><tbody>${rows.map(([label, av, bv, type]) => `<tr><td>${label}</td><td>${type === "metric" ? formatMetric(av) : av.toExponential(3)}</td><td>${type === "metric" ? formatMetric(bv) : bv.toExponential(3)}</td><td>${(bv / av).toFixed(6)}</td></tr>`).join("")}</tbody></table>`;
}

function classTrials() {
  return state.trials.filter((trial) => trial.classCode === state.classCode && Number.isFinite(Number(trial.metric)));
}

function summarize(values) {
  if (!values.length) return { n: 0, mean: 0, median: 0, sd: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);
  return { n: values.length, mean, median: median(values), sd: Math.sqrt(variance) };
}

function renderStats() {
  const trials = classTrials();
  const values = trials.map((trial) => Number(trial.metric));
  const stats = summarize(values);
  elements.statsSummary.innerHTML = [
    ["표본 n", stats.n], ["평균 오차", stats.mean.toFixed(3)], ["중앙값", stats.median.toFixed(3)], ["표준편차", stats.sd.toFixed(3)],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");

  const width = 720;
  const height = 230;
  const plot = { x: 48, y: 20, w: 648, h: 174 };
  const maxY = Math.max(1, ...values.map((value) => Math.ceil(value * 2) / 2));
  const ticks = Array.from({ length: 5 }, (_, index) => index / 4 * maxY);
  const xAt = (index) => plot.x + (index + 1) / Math.max(2, trials.length + 1) * plot.w;
  const yAt = (value) => plot.y + plot.h - value / maxY * plot.h;
  const grid = ticks.map((tick) => `<line class="grid" x1="${plot.x}" y1="${yAt(tick)}" x2="${plot.x + plot.w}" y2="${yAt(tick)}"/><text x="${plot.x - 8}" y="${yAt(tick) + 3}" text-anchor="end">${tick.toFixed(2)}</text>`).join("");
  const points = trials.map((trial, index) => `<circle class="${trial.seat === state.seat ? "own-point" : "class-point"}" cx="${xAt(index).toFixed(2)}" cy="${yAt(Number(trial.metric)).toFixed(2)}" r="${trial.seat === state.seat ? 5 : 3.5}"><title>${escapeHtml(trial.seat)} · ${Number(trial.metric).toFixed(3)} 자릿수</title></circle>`).join("");
  elements.statsChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="학급별 예측 자릿수 오차 산점도. 내 결과는 진한 점으로 표시됩니다.">${grid}<line class="axis" x1="${plot.x}" y1="${plot.y + plot.h}" x2="${plot.x + plot.w}" y2="${plot.y + plot.h}"/><line class="axis" x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y + plot.h}"/>${points}<text x="${plot.x + plot.w / 2}" y="222" text-anchor="middle">제출 순서 · 비식별 좌석</text><text x="12" y="14">자릿수 오차</text></svg>`;
  const recent = trials.slice(-12).reverse();
  elements.trialTable.innerHTML = recent.length ? `<table class="cosmic-trial-table"><thead><tr><th>좌석</th><th>예상 거리비</th><th>오차</th><th>미션</th></tr></thead><tbody>${recent.map((trial) => `<tr><td>${escapeHtml(trial.seat)}${trial.seat === state.seat ? " · 나" : ""}</td><td>${Number(trial.prediction).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}배</td><td>${Number(trial.metric).toFixed(3)}</td><td>${escapeHtml(PRESETS.find((mission) => mission.id === trial.mission)?.title || trial.mission || "자유")}</td></tr>`).join("")}</tbody></table>` : `<p>아직 제출된 표본이 없습니다. 선생님 모드에서 예시 표본을 만들거나 학생 결과를 제출하세요.</p>`;
}

function renderPrinciples() {
  const depthOrder = { M1: 0, M2: 1, H1: 2, H2: 3 };
  const items = [
    { depth: "M1", title: "같은 축척은 하나의 약속", text: "태양만 축구공으로, 지구만 비비탄으로 따로 정하면 두 비유를 한 장면에 놓을 수 없습니다. 모든 지름과 거리에 같은 S를 곱해야 합니다.", formula: "모형 길이 = 실제 길이 × S" },
    { depth: "M1", title: "크기와 거리를 동시에 줄여야 한다", text: "교과서 그림은 행성을 보이게 크게 그리고 간격은 좁힙니다. 규모 감각을 익힐 때는 실제 모형 크기와 보기 렌즈를 분리해야 합니다.", formula: "위치·수치 ≠ 화면에서 보이는 원의 크기" },
    { depth: "M2", title: "천문 단위와 광년은 역할이 다르다", text: "AU는 지구–태양 대표 거리이고, 광년은 빛이 1년 동안 가는 거리입니다. 둘 다 시간 단위가 아니라 거리 단위입니다.", formula: `1 AU = ${AU_KM.toLocaleString("ko-KR")} km · 빛 약 499초` },
    { depth: "M2", title: "로그 축은 ‘차이’가 아니라 ‘비율’을 놓는다", text: "10 m, 100 m, 1 km가 같은 간격으로 보이면 한 칸마다 10배입니다. 태양계와 가까운 별을 한 화면에 넣되 비율을 읽을 수 있습니다.", formula: "화면 위치 = log₁₀(거리)" },
    { depth: "H1", title: "대표 거리는 타원 궤도의 장반경", text: "행성은 평균 반지름의 원 위에 고정되지 않습니다. 이심률 e를 사용하면 근일점과 원일점 범위를 1차적으로 계산할 수 있습니다.", formula: "근일점 = a(1−e) · 원일점 = a(1+e)" },
    { depth: "H2", title: "빛의 시간은 축척을 줄여도 보존된다", text: "거리와 빛의 속도에 같은 S를 곱하면 거리÷속도의 S가 약분됩니다. 태양 22 cm 모형의 빛은 초속 약 4.74 cm지만 지구까지 여전히 약 8분 19초입니다.", formula: `(실제 거리×S) ÷ (${LIGHT_SPEED_M_S.toLocaleString("ko-KR")} m/s×S) = 실제 빛 시간` },
  ].filter((item) => depthOrder[item.depth] <= depthOrder[state.depth]);
  elements.principles.innerHTML = items.map((item, index) => `<details class="cosmic-principle"${index === 0 ? " open" : ""}><summary>${item.title}</summary><div>${item.text}<code>${item.formula}</code></div></details>`).join("");
}

function renderTeacher() {
  renderMode();
  renderSeats();
  elements.remoteStatus.textContent = state.remote
    ? state.remote.connected ? `학급 서버 연결 · ${state.classCode}` : `서버 연결 대기 또는 로컬 보관 · ${state.classCode}`
    : `로컬 수업 기록 · ${state.classCode}`;
}

function persistPreferences() {
  writeJson(storageKey("preferences"), {
    classCode: state.classCode,
    seat: state.seat,
    depth: state.depth,
    predictionExponent: state.predictionExponent,
  });
}

function syncUrl() {
  const url = new URL(location.href);
  url.searchParams.set("view", state.view);
  url.searchParams.set("mission", state.presetId);
  url.searchParams.set("basis", state.basis);
  url.searchParams.set("reference", state.referenceId);
  url.searchParams.set("model", String(state.modelValueM));
  url.searchParams.set("selected", state.selected);
  url.searchParams.set("lens", String(state.lensExponent));
  url.searchParams.set("class", state.classCode);
  url.searchParams.set("seat", state.seat);
  url.searchParams.set("depth", state.depth);
  if (state.mode === "teacher") url.searchParams.set("mode", "teacher"); else url.searchParams.delete("mode");
  url.searchParams.delete("seatToken");
  history.replaceState(null, "", url);
}

function renderAll({ reframe = false, url = true } = {}) {
  report = scaleInvariantReport(state);
  if (reframe) state.needsFrame = true;
  renderControls();
  renderSelected();
  renderPrediction();
  renderDataTable();
  renderAb();
  renderStats();
  renderPrinciples();
  renderTeacher();
  persistPreferences();
  if (url) syncUrl();
  if (state.needsFrame) frameScene(); else drawScene();
}

function selectBody(id, focus = false) {
  if (!BODY_BY_ID[id]) return;
  state.selected = id;
  if (!viewBodies().some((body) => body.id === id)) {
    if (id === "moon") state.view = "moon";
    else if (id === "proxima") state.view = "star";
    else state.view = "solar";
  }
  state.light.running = false;
  state.light.progress = 0;
  renderAll({ reframe: focus });
  elements.live.textContent = `${BODY_BY_ID[id].name} 선택. 모형 지름 ${formatMetric(report.rows[id].diameterM)}, 모형 거리 ${formatMetric(report.rows[id].distanceM)}.`;
}

function applyMission(mission) {
  if (!mission) return;
  state.presetId = mission.id;
  if (!controlLocked("basis")) state.basis = mission.basis;
  if (!controlLocked("referenceId")) state.referenceId = mission.referenceId;
  if (!controlLocked("modelValueM")) state.modelValueM = mission.modelValueM;
  state.view = mission.view;
  state.selected = mission.selected;
  state.revealed = false;
  state.light.running = false;
  state.light.progress = 0;
  renderAll({ reframe: true });
  if (mission.playLight) startLight();
}

function cycleBody(direction) {
  const bodies = viewBodies();
  let index = bodies.findIndex((body) => body.id === state.selected);
  if (index < 0) index = 0;
  index = (index + direction + bodies.length) % bodies.length;
  selectBody(bodies[index].id, true);
}

function updateLightUi() {
  const row = selectedRow().distanceM > 0 ? selectedRow() : report.rows.earth;
  elements.lightProgress.value = state.light.progress;
  elements.lightTime.textContent = `빛 ${formatDuration(row.lightSeconds * state.light.progress)} / ${formatDuration(row.lightSeconds)}`;
  elements.lightPlay.textContent = state.light.running ? "빛 멈추기" : state.light.progress >= 1 ? "다시 보내기" : "빛 보내기";
}

function animateLight(timestamp) {
  if (!state.light.running) return;
  if (!state.light.startedAt) state.light.startedAt = timestamp - state.light.progress * 6500;
  state.light.progress = clamp((timestamp - state.light.startedAt) / 6500, 0, 1);
  updateLightUi();
  drawScene();
  if (state.light.progress >= 1) {
    state.light.running = false;
    updateLightUi();
    elements.live.textContent = `${selectedRow().name}까지 빛이 도착했습니다. 실제 이동 시간 ${formatDuration(selectedRow().lightSeconds)}.`;
    return;
  }
  animationFrame = requestAnimationFrame(animateLight);
}

function startLight() {
  if (selectedRow().distanceM <= 0) selectBody("earth", true);
  if (state.light.running) {
    state.light.running = false;
    cancelAnimationFrame(animationFrame);
    updateLightUi();
    return;
  }
  if (state.light.progress >= 1) state.light.progress = 0;
  if (reduceMotion.matches) {
    state.light.progress = 1;
    state.light.running = false;
    updateLightUi();
    drawScene();
    return;
  }
  state.light.running = true;
  state.light.startedAt = 0;
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animateLight);
  updateLightUi();
}

function makeTrial(label = "제출") {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    classCode: state.classCode,
    seat: state.seat,
    label,
    mission: state.presetId,
    view: state.view,
    depth: state.depth,
    modelVersion: MODEL_VERSION,
    prediction: report.predictionRatio,
    values: {
      basis: state.basis,
      referenceId: state.referenceId,
      modelValueM: state.modelValueM,
      lensExponent: state.lensExponent,
    },
    sandbox: null,
    outputs: {
      scale: report.scale,
      scaleDenominator: 1 / report.scale,
    earthDiameterDistanceRatio: report.earthDiameterDistanceRatio,
      predictionRatio: report.predictionRatio,
      signedOrderError: report.signedOrderError,
      absoluteOrderError: report.absoluteOrderError,
      sunDiameterM: report.rows.sun.diameterM,
      earthDiameterM: report.rows.earth.diameterM,
      earthDistanceM: report.rows.earth.distanceM,
      neptuneDistanceM: report.rows.neptune.distanceM,
      proximaDistanceM: report.rows.proxima.distanceM,
    },
    metricKey: "absoluteOrderError",
    metric: report.absoluteOrderError,
  };
}

async function remoteRequest(path, options = {}) {
  if (!state.remote?.seatToken) throw new Error("좌석 토큰 없음");
  const response = await fetch(`${state.remote.apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Seat ${state.remote.seatToken}`,
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function syncRemoteTrials() {
  if (!state.remote?.seatToken) return;
  const payload = await remoteRequest("/api/classroom/trials?labId=cosmic-scale-lab");
  state.trials = (payload.trials || []).map((entry) => ({
    ...entry.payload,
    id: `remote-${entry.id}`,
    seat: entry.seat,
    classCode: state.classCode,
    timestamp: entry.createdAt,
    modelVersion: entry.modelVersion,
  }));
  state.remote.connected = true;
  writeJson(storageKey(`trials:${state.classCode}`), state.trials);
  renderStats();
  renderTeacher();
}

async function connectRemoteClassroom() {
  if (!state.remote?.seatToken) return;
  try {
    const session = await remoteRequest("/api/classroom/session");
    state.classCode = safeAlias(session.classCode, state.classCode);
    state.seat = safeAlias(session.seat, state.seat);
    if (session.settings?.labId === "cosmic-scale-lab") {
      state.locks = { ...state.locks, ...(session.settings.locks || {}) };
      if (["M1", "M2", "H1", "H2"].includes(session.settings.depth)) state.depth = session.settings.depth;
      const mission = PRESETS.find((item) => item.id === session.settings.mission);
      if (mission) applyMission(mission);
    }
    await syncRemoteTrials();
    renderAll({ url: false });
  } catch (error) {
    state.remote.connected = false;
    elements.remoteStatus.textContent = `서버 연결 실패 · 로컬 기록 유지: ${error.message}`;
  }
}

async function addTrial(trial) {
  state.trials.push(trial);
  state.trials = state.trials.slice(-500);
  writeJson(storageKey(`trials:${state.classCode}`), state.trials);
  renderStats();
  showToast(`${state.seat} 결과를 학급 표본에 추가했습니다.`);
  if (state.remote?.seatToken) {
    try {
      await remoteRequest("/api/classroom/trials", {
        method: "POST",
        body: JSON.stringify({ labId: "cosmic-scale-lab", modelVersion: MODEL_VERSION, mission: state.presetId, payload: trial }),
      });
      await syncRemoteTrials();
    } catch (error) {
      state.remote.connected = false;
      showToast(`서버 제출 실패 · 이 기기에 보관: ${error.message}`);
    }
  }
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function makeDemoTrials(count = 24) {
  const seed = [...state.classCode].reduce((sum, character) => sum + character.charCodeAt(0), 0) + count;
  const random = seeded(seed);
  const actualExponent = log10(report.earthDiameterDistanceRatio);
  for (let index = 0; index < count; index += 1) {
    const bias = (random() + random() + random() - 1.5) * 1.25;
    const predictionExponent = clamp(actualExponent + bias, 3, 7);
    const prediction = 10 ** predictionExponent;
    const error = Math.abs(predictionExponent - actualExponent);
    const preset = PRESETS[index % PRESETS.length];
    const demoScale = getScale(preset);
    state.trials.push({
      id: `demo-${Date.now()}-${index}`,
      timestamp: new Date(Date.now() - (count - index) * 45_000).toISOString(),
      classCode: state.classCode,
      seat: `학생${index + 1}`,
      label: "예시 표본",
      mission: preset.id,
      view: preset.view,
      depth: state.depth,
      modelVersion: MODEL_VERSION,
      prediction,
      values: { basis: preset.basis, referenceId: preset.referenceId, modelValueM: preset.modelValueM, lensExponent: 3 },
      outputs: { scale: demoScale, earthDiameterDistanceRatio: report.earthDiameterDistanceRatio, predictionRatio: prediction, absoluteOrderError: error },
      metricKey: "absoluteOrderError",
      metric: error,
    });
  }
  state.trials = state.trials.slice(-500);
  writeJson(storageKey(`trials:${state.classCode}`), state.trials);
  renderStats();
  showToast("수업용 예시 표본 24개를 만들었습니다.");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = classTrials();
  const headers = ["수업코드", "좌석별칭", "시각", "미션", "기준종류", "기준천체", "모형값m", "예상거리비", "자릿수오차", "축척"];
  const data = rows.map((trial) => [trial.classCode, trial.seat, trial.timestamp, trial.mission, trial.values?.basis, trial.values?.referenceId, trial.values?.modelValueM, trial.prediction, trial.metric, trial.outputs?.scale]);
  const blob = new Blob(["\uFEFF", [headers, ...data].map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `cosmic-scale-lab-${state.classCode}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

elements.modeButtons.forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  renderAll();
  if (state.mode === "teacher") elements.teacher.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
}));

elements.depth.addEventListener("change", () => {
  state.depth = elements.depth.value;
  renderAll();
});

elements.seat.addEventListener("change", () => {
  state.seat = safeAlias(elements.seat.value, "학생1");
  renderAll();
});

elements.viewButtons.forEach((button) => button.addEventListener("click", () => {
  state.view = button.dataset.view;
  const available = viewBodies();
  if (!available.some((body) => body.id === state.selected)) state.selected = available.at(-1).id;
  state.light.running = false;
  state.light.progress = 0;
  renderAll({ reframe: true });
}));

elements.mission.addEventListener("change", () => {
  state.presetId = elements.mission.value;
  renderControls();
});
root.querySelector("[data-apply-mission]").addEventListener("click", () => applyMission(currentMission()));

elements.basisButtons.forEach((button) => button.addEventListener("click", () => {
  if (controlLocked("basis")) return;
  state.basis = button.dataset.basis;
  if (state.basis === "distance" && !(BODY_BY_ID[state.referenceId].distanceKm > 0)) state.referenceId = "earth";
  state.revealed = false;
  renderAll({ reframe: true });
}));

elements.reference.addEventListener("change", () => {
  if (controlLocked("referenceId")) return;
  state.referenceId = elements.reference.value;
  state.revealed = false;
  renderAll({ reframe: true });
});

elements.referenceObject.addEventListener("change", () => {
  if (controlLocked("modelValueM")) return;
  const object = REFERENCE_OBJECTS.find((item) => item.id === elements.referenceObject.value);
  if (object?.meters != null) {
    state.modelValueM = object.meters;
    state.revealed = false;
    renderAll({ reframe: true });
  }
});

elements.modelValue.addEventListener("change", () => {
  if (controlLocked("modelValueM")) return;
  const value = Number(elements.modelValue.value);
  if (!(value > 0)) {
    elements.modelValue.value = String(state.modelValueM);
    showToast("모형 값은 0보다 커야 합니다.");
    return;
  }
  state.modelValueM = value;
  state.revealed = false;
  renderAll({ reframe: true });
});

elements.lens.addEventListener("input", () => {
  if (controlLocked("lensExponent")) return;
  state.lensExponent = Number(elements.lens.value);
  renderControls();
  drawScene();
});
elements.lens.addEventListener("change", () => renderAll());

elements.selected.addEventListener("change", () => selectBody(elements.selected.value, true));
elements.prediction.addEventListener("input", () => {
  state.predictionExponent = Number(elements.prediction.value);
  state.revealed = false;
  report = scaleInvariantReport(state);
  renderPrediction();
});
elements.prediction.addEventListener("change", () => renderAll());
elements.reveal.addEventListener("click", () => {
  state.revealed = !state.revealed;
  renderPrediction();
  if (state.revealed) elements.live.textContent = `지구 지름 단위 거리비 ${Math.round(report.earthDiameterDistanceRatio).toLocaleString("ko-KR")}배, 내 자릿수 오차 ${report.absoluteOrderError.toFixed(3)}.`;
});

root.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => {
  state.saved[button.dataset.save] = snapshot(button.dataset.save);
  renderAb();
  showToast(`${button.dataset.save} 시행을 저장했습니다.`);
}));
elements.submit.addEventListener("click", () => addTrial(makeTrial()));

root.querySelector("[data-prev]").addEventListener("click", () => cycleBody(-1));
root.querySelector("[data-next]").addEventListener("click", () => cycleBody(1));
root.querySelector("[data-focus-selected]").addEventListener("click", () => frameScene());
root.querySelector("[data-reset-view]").addEventListener("click", () => frameScene());
root.querySelector("[data-zoom-in]").addEventListener("click", () => zoomAt(canvasWidth / 2, .62));
root.querySelector("[data-zoom-out]").addEventListener("click", () => zoomAt(canvasWidth / 2, 1.62));
elements.lightPlay.addEventListener("click", startLight);

elements.classCode.addEventListener("change", () => {
  state.classCode = safeAlias(elements.classCode.value, "우주규모01");
  state.seats = readJson(storageKey(`seats:${state.classCode}`), ["학생1"]);
  state.seat = state.seats[0];
  state.locks = readJson(storageKey(`locks:${state.classCode}`), {});
  state.trials = readJson(storageKey(`trials:${state.classCode}`), []);
  renderAll();
});

root.querySelector("[data-create-seats]").addEventListener("click", () => {
  const prefix = safeAlias(root.querySelector("[data-seat-prefix]").value, "학생");
  const count = clamp(Number(root.querySelector("[data-seat-count]").value) || 1, 1, 40);
  state.seats = Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`.slice(0, 18));
  state.seat = state.seats[0];
  writeJson(storageKey(`seats:${state.classCode}`), state.seats);
  renderAll();
  showToast(`비식별 좌석 ${count}개를 만들었습니다.`);
});
root.querySelector("[data-demo-samples]").addEventListener("click", () => makeDemoTrials(24));
root.querySelector("[data-export]").addEventListener("click", exportCsv);
root.querySelector("[data-clear-class]").addEventListener("click", () => {
  if (!confirm(`${state.classCode}의 로컬 표본을 모두 비울까요? 이 브라우저에서는 되돌릴 수 없습니다.`)) return;
  state.trials = state.trials.filter((trial) => trial.classCode !== state.classCode);
  writeJson(storageKey(`trials:${state.classCode}`), state.trials);
  renderStats();
  showToast("현재 수업의 로컬 표본을 비웠습니다.");
});
elements.lockInputs.forEach((input) => input.addEventListener("change", () => {
  state.locks[input.dataset.lock] = input.checked;
  writeJson(storageKey(`locks:${state.classCode}`), state.locks);
  renderControls();
}));

elements.minimap.addEventListener("click", (event) => {
  const rect = elements.minimap.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const bounds = sceneBounds();
  state.camera.center = bounds.min + bounds.span * ratio;
  drawScene();
});

let drag = null;
elements.canvas.addEventListener("pointerdown", (event) => {
  elements.canvas.setPointerCapture(event.pointerId);
  drag = { pointerId: event.pointerId, x: event.clientX, startX: event.clientX, startY: event.clientY, center: state.camera.center };
});
elements.canvas.addEventListener("pointermove", (event) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - drag.x;
  drag.x = event.clientX;
  state.camera.center -= deltaX * state.camera.unitsPerPixel;
  drawScene();
});
function endPointer(event) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (moved < 7) {
    const rect = elements.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = [...screenObjects].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (hit && Math.hypot(hit.x - x, hit.y - y) <= Math.max(22, hit.lensRadius + 6)) selectBody(hit.body.id, false);
  }
  drag = null;
}
elements.canvas.addEventListener("pointerup", endPointer);
elements.canvas.addEventListener("pointercancel", () => { drag = null; });
elements.canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const rect = elements.canvas.getBoundingClientRect();
  zoomAt(event.clientX - rect.left, event.deltaY > 0 ? 1.18 : .84);
}, { passive: false });
elements.canvas.addEventListener("keydown", (event) => {
  if (["+", "="].includes(event.key)) zoomAt(canvasWidth / 2, .7);
  else if (event.key === "-") zoomAt(canvasWidth / 2, 1.4);
  else if (event.key === "ArrowLeft") state.camera.center -= state.camera.unitsPerPixel * canvasWidth * .12;
  else if (event.key === "ArrowRight") state.camera.center += state.camera.unitsPerPixel * canvasWidth * .12;
  else if (event.key === "Home") frameScene();
  else return;
  event.preventDefault();
  drawScene();
});

new ResizeObserver(resizeCanvas).observe(elements.canvas);
reduceMotion.addEventListener?.("change", () => {
  if (reduceMotion.matches && state.light.running) {
    state.light.running = false;
    state.light.progress = 1;
    cancelAnimationFrame(animationFrame);
    updateLightUi();
    drawScene();
  }
});

updateLightUi();
renderAll({ reframe: true });
connectRemoteClassroom();
