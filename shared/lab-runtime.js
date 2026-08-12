/*
 * STEM101 공통 탐구 실험실 런타임
 *
 * 주제 파일은 계산 모형(compute), 장면(draw), 그래프(chart)만 정의한다.
 * 이 파일은 모든 실험실에서 동일한 예측 → 조작 → 실행 → 비교 → 학급 표본
 * 흐름과 비식별 좌석 계정, 교사용 잠금 기능을 제공한다.
 */

const DEPTHS = {
  M1: { label: "중등 · 직관", rank: 1 },
  M2: { label: "중등 · 정량", rank: 2 },
  H1: { label: "고등 · 기본", rank: 3 },
  H2: { label: "고등 · 심화", rank: 4 },
};

const SVG_NS = "http://www.w3.org/2000/svg";
const TAU = Math.PI * 2;

export const math = {
  TAU,
  clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
  lerp: (a, b, amount) => a + (b - a) * amount,
  map: (value, inMin, inMax, outMin, outMax) => {
    if (inMax === inMin) return (outMin + outMax) / 2;
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  },
  round: (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  },
  normal: (x, mean, sigma) =>
    Math.exp(-0.5 * ((x - mean) / sigma) ** 2) / (sigma * Math.sqrt(TAU)),
  seeded(seed) {
    let value = Math.abs(Math.floor(seed)) || 1;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeAlias(value, fallback = "학생1") {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9_-]/g, "")
    .slice(0, 18);
  return cleaned || fallback;
}

function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  const magnitude = Math.abs(number);
  if ((magnitude >= 100000 || (magnitude > 0 && magnitude < 0.001))) {
    return number.toExponential(Math.min(3, digits + 1));
  }
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(number);
}

function valueLabel(definition, value) {
  if (definition.options) {
    return definition.options.find((option) => String(option.value) === String(value))?.label || value;
  }
  if (definition.format) return definition.format(value);
  return formatNumber(value, definition.digits ?? 2);
}

function outputLabel(definition, value) {
  if (definition.format) return definition.format(value);
  return formatNumber(value, definition.digits ?? 2);
}

function depthVisible(item, depth) {
  if (!item.depth && !item.levels) return true;
  if (item.levels) return item.levels.includes(depth);
  return DEPTHS[depth].rank >= DEPTHS[item.depth].rank;
}

function storageKey(config, suffix) {
  return `stem101:${config.id}:${suffix}`;
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 사생활 보호 모드나 저장공간 제한에서도 실험 자체는 계속 동작한다.
  }
}

function svgElement(name, attrs = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function makeGraphics(ctx, width, height, theme) {
  const ink = getComputedStyle(document.documentElement).getPropertyValue("--sim-ink").trim() || "#eef4f5";
  const muted = getComputedStyle(document.documentElement).getPropertyValue("--sim-muted").trim() || "#8f9ca3";
  const line = getComputedStyle(document.documentElement).getPropertyValue("--sim-line").trim() || "#34434b";
  const surface = getComputedStyle(document.documentElement).getPropertyValue("--sim-surface-0").trim() || theme.primary;
  const accent = theme.secondary;

  const api = {
    ctx,
    width,
    height,
    ink,
    muted,
    line,
    hairline: line,
    surface,
    accent,
    clear(color = surface) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
    },
    line(x1, y1, x2, y2, color = line, thickness = 1, dash = []) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.restore();
    },
    polyline(points, color = accent, thickness = 2, close = false, fill = null) {
      if (!points?.length) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      if (close) ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.stroke();
      ctx.restore();
    },
    circle(x, y, radius, fill = accent, stroke = null, thickness = 1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, radius), 0, TAU);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = thickness;
        ctx.stroke();
      }
      ctx.restore();
    },
    rect(x, y, rectWidth, rectHeight, fill = null, stroke = line, thickness = 1) {
      ctx.save();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, rectWidth, rectHeight);
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = thickness;
        ctx.strokeRect(x, y, rectWidth, rectHeight);
      }
      ctx.restore();
    },
    text(text, x, y, options = {}) {
      ctx.save();
      ctx.fillStyle = options.color || ink;
      ctx.font = `${options.weight || 500} ${options.size || 12}px ${options.family || "Pretendard, sans-serif"}`;
      ctx.textAlign = options.align || "left";
      ctx.textBaseline = options.baseline || "alphabetic";
      if (options.maxWidth) ctx.fillText(String(text), x, y, options.maxWidth);
      else ctx.fillText(String(text), x, y);
      ctx.restore();
    },
    arrow(x1, y1, x2, y2, color = accent, thickness = 2, head = 8) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      api.line(x1, y1, x2, y2, color, thickness);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    },
    grid(step = 48, color = line) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      for (let x = step; x < width; x += step) api.line(x, 0, x, height, color, 1);
      for (let y = step; y < height; y += step) api.line(0, y, width, y, color, 1);
      ctx.restore();
    },
    axes(bounds, labels = {}) {
      const { x, y, w, h } = bounds;
      api.line(x, y + h, x + w, y + h, muted, 1);
      api.line(x, y, x, y + h, muted, 1);
      if (labels.x) api.text(labels.x, x + w, y + h + 25, { color: muted, align: "right", size: 11 });
      if (labels.y) api.text(labels.y, x - 8, y + 2, { color: muted, align: "right", size: 11 });
    },
  };
  return api;
}

function chartExtent(values, fallback = [0, 1]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return fallback;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    const padding = Math.abs(min || 1) * 0.25;
    min -= padding;
    max += padding;
  }
  return [min, max];
}

function renderChart(svg, spec, theme) {
  svg.replaceChildren();
  const width = 520;
  const height = 228;
  const margin = { left: 52, right: 20, top: 20, bottom: 42 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", spec?.ariaLabel || "실험 결과 그래프");
  if (!spec?.series?.length) {
    const note = svgElement("text", { x: 20, y: 32, fill: "currentColor", opacity: "0.62" });
    note.textContent = "실험을 실행하면 변화가 이곳에 기록됩니다.";
    svg.append(note);
    return;
  }

  const allPoints = spec.series.flatMap((series) => series.points || []);
  const [xMin0, xMax0] = spec.xDomain || chartExtent(allPoints.map((point) => point.x));
  const [yMin0, yMax0] = spec.yDomain || chartExtent(allPoints.map((point) => point.y));
  const xPadding = (xMax0 - xMin0) * 0.04;
  const yPadding = (yMax0 - yMin0) * 0.08;
  const xMin = spec.xDomain ? xMin0 : xMin0 - xPadding;
  const xMax = spec.xDomain ? xMax0 : xMax0 + xPadding;
  const yMin = spec.yDomain ? yMin0 : yMin0 - yPadding;
  const yMax = spec.yDomain ? yMax0 : yMax0 + yPadding;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const px = (value) => margin.left + ((value - xMin) / (xMax - xMin || 1)) * plotW;
  const py = (value) => margin.top + plotH - ((value - yMin) / (yMax - yMin || 1)) * plotH;

  const grid = svgElement("g", { stroke: "currentColor", opacity: "0.16", "stroke-width": "1" });
  const labels = svgElement("g", { fill: "currentColor", opacity: "0.64", "font-size": "10", "font-family": "ui-monospace, monospace" });
  for (let i = 0; i <= 4; i += 1) {
    const gx = margin.left + (plotW * i) / 4;
    const gy = margin.top + (plotH * i) / 4;
    grid.append(svgElement("line", { x1: gx, y1: margin.top, x2: gx, y2: margin.top + plotH }));
    grid.append(svgElement("line", { x1: margin.left, y1: gy, x2: margin.left + plotW, y2: gy }));
    const xText = svgElement("text", { x: gx, y: height - 23, "text-anchor": "middle" });
    xText.textContent = formatNumber(xMin + ((xMax - xMin) * i) / 4, 2);
    labels.append(xText);
    const yText = svgElement("text", { x: margin.left - 8, y: gy + 3, "text-anchor": "end" });
    yText.textContent = formatNumber(yMax - ((yMax - yMin) * i) / 4, 2);
    labels.append(yText);
  }
  svg.append(grid, labels);

  spec.series.forEach((series, index) => {
    const color = series.color || (index === 0 ? theme.secondary : "currentColor");
    if (series.type === "bars") {
      const barWidth = Math.max(3, plotW / Math.max(series.points.length, 1) * 0.62);
      series.points.forEach((point) => {
        svg.append(svgElement("rect", {
          x: px(point.x) - barWidth / 2,
          y: py(point.y),
          width: barWidth,
          height: Math.max(1, py(yMin) - py(point.y)),
          fill: color,
          opacity: series.opacity || "0.76",
        }));
      });
      return;
    }
    if (series.type !== "scatter") {
      const pathData = (series.points || [])
        .map((point, pointIndex) => `${pointIndex ? "L" : "M"}${px(point.x).toFixed(2)},${py(point.y).toFixed(2)}`)
        .join(" ");
      svg.append(svgElement("path", {
        d: pathData,
        fill: "none",
        stroke: color,
        "stroke-width": series.width || "2",
        opacity: series.opacity || "1",
      }));
    }
    if (series.type === "scatter" || series.points.length < 20 || series.showPoints) {
      series.points.forEach((point) => {
        const dot = svgElement("circle", {
          cx: px(point.x),
          cy: py(point.y),
          r: point.own ? 5 : series.radius || 3,
          fill: point.own ? theme.secondary : color,
          stroke: point.own ? "currentColor" : "none",
          "stroke-width": point.own ? 1 : 0,
          opacity: point.opacity || series.opacity || "0.86",
        });
        if (point.label) {
          const title = svgElement("title");
          title.textContent = point.label;
          dot.append(title);
        }
        svg.append(dot);
      });
    }
  });

  const axisLabels = svgElement("g", { fill: "currentColor", opacity: "0.72", "font-size": "11" });
  const xLabel = svgElement("text", { x: width - margin.right, y: height - 4, "text-anchor": "end" });
  xLabel.textContent = spec.xLabel || "x";
  const yLabel = svgElement("text", { x: margin.left, y: 12 });
  yLabel.textContent = spec.yLabel || "y";
  axisLabels.append(xLabel, yLabel);
  svg.append(axisLabels);
}

function summarize(values) {
  const finite = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return { n: 0, mean: NaN, median: NaN, sd: NaN, min: NaN, max: NaN };
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const median = finite.length % 2
    ? finite[(finite.length - 1) / 2]
    : (finite[finite.length / 2 - 1] + finite[finite.length / 2]) / 2;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, finite.length - 1);
  return {
    n: finite.length,
    mean,
    median,
    sd: Math.sqrt(variance),
    min: finite[0],
    max: finite.at(-1),
  };
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

function buildShell(config) {
  const views = config.views.map((view, index) => `
    <button type="button" data-view="${escapeHtml(view.id)}" aria-pressed="${index === 0}">${escapeHtml(view.label)}</button>
  `).join("");
  const depthOptions = Object.entries(DEPTHS).map(([value, item]) =>
    `<option value="${value}">${escapeHtml(item.label)}</option>`).join("");
  const missionOptions = config.missions.map((mission) =>
    `<option value="${escapeHtml(mission.id)}">${escapeHtml(mission.title)}</option>`).join("");
  const sandboxMarkup = config.sandbox ? `
    <div class="lab-sandbox-tools" data-sandbox-tools hidden>
      <div class="lab-sandbox-tools__head"><strong>${escapeHtml(config.sandbox.title || "자유 제작")}</strong><span>놓기 · 연결 · 분해</span></div>
      <div class="lab-sandbox-parts">${config.sandbox.parts.map((part) =>
        `<button type="button" data-add-part="${escapeHtml(part.type)}"><span aria-hidden="true">${escapeHtml(part.icon || "+")}</span>${escapeHtml(part.label)}</button>`).join("")}</div>
      <div class="lab-sandbox-select">
        <select data-sandbox-part-select aria-label="배치된 부품 선택"></select>
        <button type="button" data-link-from>연결 시작점</button>
        <button type="button" data-link-to>선택 부품에 연결</button>
      </div>
      <div class="lab-sandbox-actions">
        <button type="button" data-link-mode aria-pressed="false">↗ 연결</button>
        <button type="button" data-rotate-part>↻ 회전</button>
        <button type="button" data-delete-part>⌫ 제거</button>
        <button type="button" data-clear-sandbox>모두 비우기</button>
      </div>
      <p data-sandbox-status>${escapeHtml(config.sandbox.instructions || "부품을 추가하고 직접 연결해 보세요.")}</p>
    </div>` : "";

  return `
    <div class="sim-shell lab-shell" data-mode="student">
      <header class="lab-header">
        <a class="lab-brand" href="../../../../index.html" aria-label="STEM101 실험실 목차">
          <span class="lab-brand__mark" aria-hidden="true">⌁</span><span>STEM101 LAB</span>
        </a>
        <div class="lab-title-row">
          <h1>${escapeHtml(config.title)}</h1>
          <span class="lab-run-status" data-running="false">관찰 준비</span>
        </div>
        <div class="lab-header-actions">
          <div class="lab-mode-switch" aria-label="사용자 모드">
            <button type="button" data-mode-button="student" aria-pressed="true">학생</button>
            <button type="button" data-mode-button="teacher" aria-pressed="false">선생님</button>
          </div>
          <span class="lab-seat">좌석 <strong data-seat-label>학생1</strong></span>
        </div>
      </header>

      <nav class="lab-toolbar" aria-label="관찰 관점과 설명 수준">
        <div class="lab-view-tabs">${views}</div>
        <label class="lab-depth">설명 깊이
          <select class="lab-depth-select" data-depth>${depthOptions}</select>
        </label>
      </nav>

      <div class="lab-workspace">
        <section class="lab-stage-column" aria-label="시뮬레이션 장면">
          <div class="lab-stage">
            <canvas data-stage aria-label="${escapeHtml(config.title)} 동적 장면"></canvas>
            ${sandboxMarkup}
            <div class="lab-stage-legend"><strong data-stage-view></strong><span data-stage-legend></span></div>
            <p class="lab-stage-caption" data-stage-caption></p>
          </div>
          <div class="lab-transport">
            <button class="lab-transport__play" type="button" data-play aria-label="실험 재생">▶</button>
            <label class="lab-time"><input type="range" min="0" max="${config.duration || 10}" step="0.01" value="0" data-time><output data-time-output>0.00 s</output></label>
            <label class="lab-depth">속도
              <select class="lab-depth-select" data-speed aria-label="재생 속도">
                <option value="0.25">×0.25</option><option value="0.5">×0.5</option>
                <option value="1" selected>×1</option><option value="2">×2</option><option value="4">×4</option>
              </select>
            </label>
            <button type="button" data-reset>↺ 처음</button>
          </div>
        </section>

        <aside class="lab-sidebar" aria-label="실험 조작 패널">
          <section class="lab-side-section">
            <p class="lab-section-kicker">QUESTION / MISSION</p>
            <h2 data-mission-title>${escapeHtml(config.missions[0]?.title || "자유 탐구")}</h2>
            <select class="lab-mission-select" data-mission aria-label="수업 미션">${missionOptions}</select>
            <p class="lab-mission-question" data-mission-question></p>
            <button class="lab-action" type="button" data-apply-mission>미션 조건 적용</button>
          </section>

          <section class="lab-side-section">
            <p class="lab-section-kicker">LIVE MEASUREMENT</p>
            <h2>현재 측정값</h2>
            <div class="lab-readouts" data-readouts></div>
          </section>

          <section class="lab-side-section">
            <p class="lab-section-kicker">MANIPULATE</p>
            <h2>조작 변수</h2>
            <div class="lab-controls" data-controls></div>
            <p class="lab-help">한 번에 하나만 바꾸면 원인을 분리할 수 있습니다. 자물쇠는 선생님 모드에서 수업 변수로 고정합니다.</p>
          </section>
        </aside>
      </div>

      <section class="lab-investigation" aria-label="예측과 시행 저장">
        <div class="lab-prediction">
          <p class="lab-section-kicker">PREDICT</p>
          <h2>${escapeHtml(config.prediction?.question || "결과를 먼저 예측해 보세요")}</h2>
          <div class="lab-prediction-row" data-prediction></div>
        </div>
        <div class="lab-trial-actions">
          <p class="lab-section-kicker">COMPARE A / B</p>
          <h2>조건을 저장하고 증거로 비교하기</h2>
          <div class="lab-trial-buttons">
            <button class="lab-action" type="button" data-save="A">A 조건 저장</button>
            <button class="lab-action" type="button" data-save="B">B 조건 저장</button>
            <button class="lab-action lab-action--primary" type="button" data-submit>학급 표본에 제출</button>
          </div>
          <p class="lab-trial-summary" data-trial-summary>A와 B의 차이를 만들 조작 변수를 하나 선택하세요.</p>
        </div>
      </section>

      <section class="lab-evidence" aria-label="실험 증거">
        <header class="lab-evidence-header">
          <div><p class="lab-section-kicker">EVIDENCE</p><h2>개인 시행과 학급 표본</h2></div>
          <button class="lab-action" type="button" data-export>CSV 내려받기</button>
        </header>
        <div class="lab-evidence-grid">
          <article class="lab-evidence-panel"><h3>모형의 정량 관계</h3><svg class="lab-chart" data-model-chart></svg></article>
          <article class="lab-evidence-panel"><h3>학급 분포 — 내 결과는 강조됨</h3><svg class="lab-chart" data-class-chart></svg><p class="lab-trial-summary" data-class-summary></p></article>
          <article class="lab-evidence-panel"><h3>최근 시행 기록</h3><div class="lab-table-wrap"><table class="lab-table"><thead data-table-head></thead><tbody data-table-body></tbody></table></div></article>
        </div>
      </section>

      <section class="lab-principles" aria-label="원리 설명">
        <div class="lab-principle-nav">
          <p class="lab-section-kicker">FROM PHENOMENON TO MODEL</p>
          <h2>현상에서 식으로</h2>
          <p>장면에서 본 변화가 어떤 가정과 관계식으로 설명되는지 단계별로 연결합니다.</p>
          <div class="lab-principle-tabs" data-theory-tabs></div>
        </div>
        <article class="lab-principle-content" data-theory-content></article>
      </section>

      <footer class="lab-side-section">
        <p class="lab-section-kicker">MODEL BOUNDARY</p>
        <p class="lab-limit" data-limit>${escapeHtml(config.limit || "이 시뮬레이션은 학습을 위한 모형이며 실제 현상의 모든 변수를 포함하지 않습니다.")}</p>
      </footer>

      <aside class="lab-teacher-panel" data-teacher-panel hidden aria-label="교사용 수업 제어">
        <header class="lab-teacher-head"><h2>교사용 수업 제어</h2><button class="lab-action" type="button" data-teacher-close>닫기</button></header>
        <div class="lab-teacher-body">
          <p class="lab-help">이름·이메일·전화번호 없이 수업용 좌석 별칭만 사용합니다. 현재 정적 SITE에서는 이 브라우저 안에서 학급 흐름을 시험하며, 학교 서버 어댑터가 연결되면 같은 수업 코드의 기기끼리 동기화됩니다.</p>
          <label class="lab-teacher-field">수업 코드<input type="text" maxlength="16" value="${escapeHtml(config.id.toUpperCase())}-01" data-class-code></label>
          <div class="lab-teacher-field">좌석 계정 생성
            <div class="lab-prediction-row"><input type="text" maxlength="10" value="학생" data-seat-prefix aria-label="좌석 접두어"><input type="number" min="1" max="40" value="24" data-seat-count aria-label="좌석 수"><button class="lab-action" type="button" data-create-seats>생성</button></div>
          </div>
          <div class="lab-seat-grid" data-seat-grid></div>
          <button class="lab-action" type="button" data-demo-samples>예시 학급 표본 24개 만들기</button>
          <button class="lab-action" type="button" data-clear-class>현재 수업 표본 비우기</button>
          <p class="lab-help">변수 자물쇠는 오른쪽 조작 패널에서 설정합니다. 잠긴 변수는 학생 모드에서 변경할 수 없습니다.</p>
        </div>
      </aside>
    </div>`;
}

export function mountLab(config, root = document.querySelector("#lab")) {
  if (!root) throw new Error("실험실을 마운트할 #lab 요소가 없습니다.");
  if (!config?.compute || !config?.draw || !config?.variables?.length) {
    throw new Error("실험실 설정에는 variables, compute, draw가 필요합니다.");
  }

  document.documentElement.style.setProperty("--sim-color-primary", config.theme.primary);
  document.documentElement.style.setProperty("--sim-color-secondary", config.theme.secondary);
  document.documentElement.style.setProperty("--sim-surface-0", config.theme.primary);
  document.title = `${config.title} · STEM101`;
  root.innerHTML = buildShell(config);

  const shell = root.querySelector(".lab-shell");
  shell.style.setProperty("--sim-color-primary", config.theme.primary);
  shell.style.setProperty("--sim-color-secondary", config.theme.secondary);
  shell.style.setProperty("--sim-surface-0", `color-mix(in srgb, ${config.theme.primary} 88%, #000)`);
  const canvas = root.querySelector("[data-stage]");
  const context = canvas.getContext("2d");
  const params = new URLSearchParams(location.search);
  const classCode = safeAlias(params.get("class"), `${config.id.toUpperCase()}-01`);
  const apiCandidate = params.get("api") || "";
  let apiBase = "";
  try {
    const parsedApi = new URL(apiCandidate, location.href);
    if (["http:", "https:"].includes(parsedApi.protocol) && apiCandidate) apiBase = parsedApi.href.replace(/\/$/, "");
  } catch {
    apiBase = "";
  }
  const seatTokenKey = `stem101:seat-token:${classCode}`;
  const seatTokenFromLink = params.get("seatToken") || "";
  if (seatTokenFromLink) {
    try { sessionStorage.setItem(seatTokenKey, seatTokenFromLink); } catch { /* 세션 저장 불가 시 현재 링크 토큰 사용 */ }
    params.delete("seatToken");
    const cleanQuery = params.toString();
    history.replaceState(null, "", `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${location.hash}`);
  }
  let seatToken = seatTokenFromLink;
  try { seatToken = seatToken || sessionStorage.getItem(seatTokenKey) || ""; } catch { /* 현재 값 유지 */ }
  const storedPreferences = readJson(storageKey(config, "preferences"), {});
  const state = {
    mode: params.get("mode") === "teacher" ? "teacher" : "student",
    depth: params.get("depth") in DEPTHS ? params.get("depth") : storedPreferences.depth || config.defaultDepth || "M2",
    view: params.get("view") || config.views[0].id,
    mission: config.missions[0]?.id,
    seat: safeAlias(params.get("seat") || storedPreferences.seat, "학생1"),
    classCode,
    values: Object.fromEntries(config.variables.map((item) => [item.key, item.default])),
    sandbox: config.sandbox ? readJson(storageKey(config, `sandbox:${classCode}`), {
      items: (config.sandbox.initial || []).map((item, index) => ({ ...item, id: item.id || `part-${index + 1}` })),
      links: [],
    }) : null,
    selectedPart: null,
    linkMode: false,
    linkStart: null,
    dragging: null,
    locks: readJson(storageKey(config, `locks:${classCode}`), {}),
    time: 0,
    speed: 1,
    running: false,
    lastFrame: performance.now(),
    result: {},
    prediction: config.prediction?.default ?? config.prediction?.min ?? 0,
    trials: readJson(storageKey(config, `trials:${classCode}`), []),
    saved: { A: null, B: null },
    theory: config.theory[0]?.id,
    seats: readJson(storageKey(config, `seats:${classCode}`), ["학생1"]),
    panelOpen: false,
    remote: apiBase && seatToken ? { apiBase, seatToken, connected: false } : null,
  };
  // 위 객체 리터럴 안에서 state를 참조할 수 없으므로 패널 상태를 바로 보정한다.
  state.panelOpen = state.mode === "teacher";
  if (state.sandbox) {
    state.sandbox.items = (state.sandbox.items || []).map((item, index) => {
      const definition = config.sandbox.parts.find((part) => part.type === item.type) || {};
      return {
        x: 0.35 + (index % 4) * 0.1,
        y: 0.42 + Math.floor(index / 4) * 0.12,
        rotation: 0,
        ...definition.defaults,
        ...item,
        label: item.label || definition.label || item.type,
      };
    });
    state.sandbox.links = state.sandbox.links || [];
  }

  const elements = {
    status: root.querySelector(".lab-run-status"),
    seatLabel: root.querySelector("[data-seat-label]"),
    depth: root.querySelector("[data-depth]"),
    viewButtons: [...root.querySelectorAll("[data-view]")],
    modeButtons: [...root.querySelectorAll("[data-mode-button]")],
    stageView: root.querySelector("[data-stage-view]"),
    stageLegend: root.querySelector("[data-stage-legend]"),
    caption: root.querySelector("[data-stage-caption]"),
    play: root.querySelector("[data-play]"),
    time: root.querySelector("[data-time]"),
    timeOutput: root.querySelector("[data-time-output]"),
    speed: root.querySelector("[data-speed]"),
    reset: root.querySelector("[data-reset]"),
    mission: root.querySelector("[data-mission]"),
    missionTitle: root.querySelector("[data-mission-title]"),
    missionQuestion: root.querySelector("[data-mission-question]"),
    applyMission: root.querySelector("[data-apply-mission]"),
    readouts: root.querySelector("[data-readouts]"),
    controls: root.querySelector("[data-controls]"),
    prediction: root.querySelector("[data-prediction]"),
    trialSummary: root.querySelector("[data-trial-summary]"),
    modelChart: root.querySelector("[data-model-chart]"),
    classChart: root.querySelector("[data-class-chart]"),
    classSummary: root.querySelector("[data-class-summary]"),
    tableHead: root.querySelector("[data-table-head]"),
    tableBody: root.querySelector("[data-table-body]"),
    theoryTabs: root.querySelector("[data-theory-tabs]"),
    theoryContent: root.querySelector("[data-theory-content]"),
    teacherPanel: root.querySelector("[data-teacher-panel]"),
    classCode: root.querySelector("[data-class-code]"),
    seatPrefix: root.querySelector("[data-seat-prefix]"),
    seatCount: root.querySelector("[data-seat-count]"),
    seatGrid: root.querySelector("[data-seat-grid]"),
    sandboxTools: root.querySelector("[data-sandbox-tools]"),
    sandboxStatus: root.querySelector("[data-sandbox-status]"),
    linkMode: root.querySelector("[data-link-mode]"),
    sandboxPartSelect: root.querySelector("[data-sandbox-part-select]"),
  };

  function currentMission() {
    return config.missions.find((item) => item.id === state.mission) || config.missions[0];
  }

  function visibleVariables() {
    return config.variables.filter((item) => depthVisible(item, state.depth));
  }

  function visibleOutputs() {
    return config.outputs.filter((item) => depthVisible(item, state.depth));
  }

  function compute() {
    state.result = config.compute({ ...state.values }, state.time, state.view, state.depth, state.sandbox ? structuredClone(state.sandbox) : null);
    return state.result;
  }

  function setValues(values) {
    Object.entries(values || {}).forEach(([key, value]) => {
      const definition = config.variables.find((item) => item.key === key);
      if (!definition) return;
      state.values[key] = definition.options ? value : math.clamp(Number(value), definition.min, definition.max);
    });
  }

  function renderMission() {
    const mission = currentMission();
    if (!mission) return;
    elements.mission.value = mission.id;
    elements.missionTitle.textContent = mission.title;
    elements.missionQuestion.textContent = mission.question || mission.brief;
  }

  function renderReadouts() {
    elements.readouts.innerHTML = visibleOutputs().map((output) => `
      <div class="lab-readout-row"><span>${escapeHtml(output.label)}</span>
        <output data-output="${escapeHtml(output.key)}">${escapeHtml(outputLabel(output, state.result[output.key]))}</output>
        <span class="lab-readout-unit">${escapeHtml(output.unit || "")}</span></div>`).join("");
  }

  function renderControls() {
    elements.controls.innerHTML = visibleVariables().map((definition) => {
      const locked = Boolean(state.locks[definition.key]);
      const disabled = state.mode === "student" && locked;
      const input = definition.options
        ? `<select data-variable="${escapeHtml(definition.key)}" ${disabled ? "disabled" : ""}>${definition.options.map((option) =>
            `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(state.values[definition.key]) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`
        : `<input type="range" data-variable="${escapeHtml(definition.key)}" min="${definition.min}" max="${definition.max}" step="${definition.step}" value="${state.values[definition.key]}" ${disabled ? "disabled" : ""}>`;
      return `<label class="lab-field">
        <span class="lab-field__top"><span>${escapeHtml(definition.label)}</span>
          <button class="lab-field__lock" type="button" data-lock="${escapeHtml(definition.key)}" aria-pressed="${locked}" aria-label="${escapeHtml(definition.label)} 잠금">${locked ? "▣" : "□"}</button>
          <output data-variable-output="${escapeHtml(definition.key)}">${escapeHtml(valueLabel(definition, state.values[definition.key]))}${definition.options ? "" : ` ${escapeHtml(definition.unit || "")}`}</output>
        </span>${input}</label>`;
    }).join("");

    elements.controls.querySelectorAll("[data-variable]").forEach((input) => {
      input.addEventListener("input", () => {
        const definition = config.variables.find((item) => item.key === input.dataset.variable);
        state.values[input.dataset.variable] = definition.options ? input.value : Number(input.value);
        state.running = false;
        compute();
        renderDynamic();
      });
    });
    elements.controls.querySelectorAll("[data-lock]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.mode !== "teacher") return;
        state.locks[button.dataset.lock] = !state.locks[button.dataset.lock];
        writeJson(storageKey(config, `locks:${state.classCode}`), state.locks);
        renderControls();
      });
    });
  }

  function renderPrediction() {
    const prediction = config.prediction;
    if (!prediction) {
      elements.prediction.innerHTML = `<p class="lab-help">이 미션은 말로 예측한 뒤 결과를 비교합니다.</p>`;
      return;
    }
    if (prediction.options) {
      elements.prediction.innerHTML = `<select data-prediction-value aria-label="예측값">${prediction.options.map((option) =>
        `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}</select>`;
    } else {
      const options = [];
      const step = prediction.step || 1;
      for (let value = prediction.min; value <= prediction.max + step / 2; value += step) {
        options.push(`<option value="${value}">${escapeHtml(formatNumber(value, prediction.digits ?? 1))} ${escapeHtml(prediction.unit || "")}</option>`);
      }
      elements.prediction.innerHTML = `<select data-prediction-value aria-label="예측값">${options.join("")}</select>`;
    }
    const select = elements.prediction.querySelector("select");
    select.value = String(state.prediction);
    if (select.selectedIndex < 0) select.selectedIndex = 0;
    state.prediction = select.value;
    select.addEventListener("change", () => { state.prediction = select.value; });
  }

  function trialMetric(result = state.result) {
    const output = config.outputs.find((item) => item.classMetric) || config.outputs[0];
    return { definition: output, value: Number(result[output.key]) };
  }

  function makeTrial(label = "시행") {
    const metric = trialMetric();
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      classCode: state.classCode,
      seat: state.seat,
      label,
      mission: state.mission,
      view: state.view,
      depth: state.depth,
      modelVersion: config.version || "1.0.0",
      prediction: state.prediction,
      values: { ...state.values },
      sandbox: state.sandbox ? structuredClone(state.sandbox) : null,
      outputs: Object.fromEntries(config.outputs.map((item) => [item.key, state.result[item.key]])),
      metricKey: metric.definition.key,
      metric: metric.value,
    };
  }

  function renderTrialSummary() {
    const { A, B } = state.saved;
    if (!A && !B) {
      elements.trialSummary.textContent = "A와 B의 차이를 만들 조작 변수를 하나 선택하세요.";
      return;
    }
    const output = trialMetric().definition;
    if (A && !B) {
      elements.trialSummary.textContent = `A 저장됨 · ${output.label} ${outputLabel(output, A.outputs[output.key])} ${output.unit || ""}. 이제 한 변수만 바꿔 B를 저장하세요.`;
      return;
    }
    if (!A && B) {
      elements.trialSummary.textContent = `B 저장됨. 비교를 위해 A 조건도 저장하세요.`;
      return;
    }
    const difference = Number(B.outputs[output.key]) - Number(A.outputs[output.key]);
    const changed = config.variables.filter((item) => String(A.values[item.key]) !== String(B.values[item.key]));
    elements.trialSummary.textContent = `${changed.length}개 변수 변경 · ${changed.map((item) => item.label).join(", ") || "같은 조건"} · ${output.label} Δ ${formatNumber(difference, output.digits ?? 2)} ${output.unit || ""}`;
  }

  function classTrials() {
    return state.trials.filter((trial) => trial.classCode === state.classCode);
  }

  async function remoteRequest(path, options = {}) {
    if (!state.remote) throw new Error("학급 서버가 설정되지 않았습니다.");
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
    if (!state.remote) return;
    const payload = await remoteRequest(`/api/classroom/trials?labId=${encodeURIComponent(config.id)}`);
    state.trials = payload.trials.map((entry) => ({
      ...entry.payload,
      id: `remote-${entry.id}`,
      seat: entry.seat,
      classCode: state.classCode,
      timestamp: entry.createdAt,
      modelVersion: entry.modelVersion,
    }));
    state.remote.connected = true;
    writeJson(storageKey(config, `trials:${state.classCode}`), state.trials);
    renderClassEvidence();
  }

  async function connectRemoteClassroom() {
    if (!state.remote) return;
    try {
      const session = await remoteRequest("/api/classroom/session");
      state.classCode = session.classCode;
      state.seat = session.seat;
      if (session.settings?.labId === config.id) {
        state.locks = session.settings.locks || state.locks;
        if (session.settings.depth in DEPTHS) state.depth = session.settings.depth;
        if (config.missions.some((mission) => mission.id === session.settings.mission)) state.mission = session.settings.mission;
      }
      await syncRemoteTrials();
      renderStatic();
      elements.status.textContent = "학급 서버 연결";
    } catch (error) {
      state.remote.connected = false;
      elements.status.textContent = `로컬 기록 · ${error.message}`;
    }
  }

  function renderClassEvidence() {
    const trials = classTrials();
    const metricDef = trialMetric().definition;
    const values = trials.map((trial) => Number(trial.outputs?.[metricDef.key] ?? trial.metric));
    const stats = summarize(values);
    const points = trials.map((trial, index) => ({
      x: index + 1,
      y: Number(trial.outputs?.[metricDef.key] ?? trial.metric),
      own: trial.seat === state.seat,
      label: `${trial.seat}: ${formatNumber(trial.outputs?.[metricDef.key] ?? trial.metric, metricDef.digits ?? 2)} ${metricDef.unit || ""}`,
    })).filter((point) => Number.isFinite(point.y));
    renderChart(elements.classChart, {
      ariaLabel: `${metricDef.label} 학급 분포`,
      xLabel: "제출 순서",
      yLabel: `${metricDef.label} (${metricDef.unit || "값"})`,
      series: [{ type: "scatter", points, radius: 3 }],
    }, config.theme);
    elements.classSummary.textContent = stats.n
      ? `n=${stats.n} · 평균 ${formatNumber(stats.mean, metricDef.digits ?? 2)} · 중앙값 ${formatNumber(stats.median, metricDef.digits ?? 2)} · 표준편차 ${formatNumber(stats.sd, metricDef.digits ?? 2)} ${metricDef.unit || ""}`
      : "아직 제출된 표본이 없습니다. 결과를 제출하거나 선생님 모드에서 예시 표본을 만드세요.";

    const columns = [
      { key: "seat", label: "좌석" },
      ...config.variables.filter((item) => item.table !== false).slice(0, 2).map((item) => ({ key: `v:${item.key}`, label: item.shortLabel || item.label })),
      { key: `o:${metricDef.key}`, label: metricDef.shortLabel || metricDef.label },
    ];
    elements.tableHead.innerHTML = `<tr>${columns.map((item) => `<th>${escapeHtml(item.label)}</th>`).join("")}</tr>`;
    elements.tableBody.innerHTML = trials.slice(-30).reverse().map((trial) => `<tr data-own="${trial.seat === state.seat}">${columns.map((column) => {
      if (column.key === "seat") return `<td>${escapeHtml(trial.seat)}</td>`;
      if (column.key.startsWith("v:")) {
        const key = column.key.slice(2);
        const definition = config.variables.find((item) => item.key === key);
        return `<td>${escapeHtml(valueLabel(definition, trial.values[key]))}</td>`;
      }
      const key = column.key.slice(2);
      const definition = config.outputs.find((item) => item.key === key);
      return `<td>${escapeHtml(outputLabel(definition, trial.outputs[key]))}</td>`;
    }).join("")}</tr>`).join("");
  }

  function renderModelChart() {
    const spec = config.chart?.({ ...state.values }, state.result, state.view, state.depth, state.time);
    renderChart(elements.modelChart, spec, config.theme);
  }

  function renderTheory() {
    const visibleTheory = config.theory.filter((item) => depthVisible(item, state.depth));
    if (!visibleTheory.some((item) => item.id === state.theory)) state.theory = visibleTheory[0]?.id;
    elements.theoryTabs.innerHTML = visibleTheory.map((item) => `<button type="button" data-theory="${escapeHtml(item.id)}" aria-pressed="${item.id === state.theory}">${escapeHtml(item.title)}</button>`).join("");
    const item = visibleTheory.find((entry) => entry.id === state.theory) || visibleTheory[0];
    if (!item) return;
    elements.theoryContent.innerHTML = `<h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      ${item.formula ? `<div class="lab-formula">${escapeHtml(item.formula)}</div>` : ""}
      ${item.points?.length ? `<ul>${item.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}
      ${item.example ? `<p><strong>관심 사례</strong> · ${escapeHtml(item.example)}</p>` : ""}`;
    elements.theoryTabs.querySelectorAll("[data-theory]").forEach((button) => {
      button.addEventListener("click", () => { state.theory = button.dataset.theory; renderTheory(); });
    });
  }

  function renderSeats() {
    elements.seatGrid.innerHTML = state.seats.map((seat) => `<button class="lab-action" type="button" data-seat="${escapeHtml(seat)}" aria-pressed="${seat === state.seat}">${escapeHtml(seat)}</button>`).join("");
    elements.seatGrid.querySelectorAll("[data-seat]").forEach((button) => {
      button.addEventListener("click", () => {
        state.seat = button.dataset.seat;
        writeJson(storageKey(config, "preferences"), { seat: state.seat, depth: state.depth });
        renderStatic();
      });
    });
  }

  function sandboxViewActive() {
    return Boolean(config.sandbox && state.view === (config.sandbox.view || "sandbox"));
  }

  function sandboxEvaluation() {
    if (!config.sandbox || !state.sandbox) return null;
    return config.sandbox.evaluate?.(structuredClone(state.sandbox), { ...state.values }, state.result) || {
      valid: state.sandbox.items.length > 0,
      summary: state.sandbox.items.length ? `부품 ${state.sandbox.items.length}개 · 연결 ${state.sandbox.links.length}개` : "팔레트에서 부품을 추가하세요.",
    };
  }

  function persistSandbox() {
    if (!state.sandbox) return;
    writeJson(storageKey(config, `sandbox:${state.classCode}`), state.sandbox);
  }

  function renderSandboxStatus() {
    if (!elements.sandboxTools) return;
    elements.sandboxTools.hidden = !sandboxViewActive();
    elements.linkMode?.setAttribute("aria-pressed", String(state.linkMode));
    if (elements.sandboxPartSelect) {
      const current = state.selectedPart || "";
      elements.sandboxPartSelect.innerHTML = `<option value="">배치된 부품 선택</option>${state.sandbox.items.map((item, index) => `<option value="${escapeHtml(item.id)}">${index + 1}. ${escapeHtml(item.label)}</option>`).join("")}`;
      elements.sandboxPartSelect.value = current;
    }
    const evaluation = sandboxEvaluation();
    if (elements.sandboxStatus && evaluation) {
      const selection = state.selectedPart ? ` · 선택 ${state.sandbox.items.find((item) => item.id === state.selectedPart)?.label || "부품"}` : "";
      elements.sandboxStatus.textContent = `${evaluation.summary}${selection}${state.linkStart ? " · 연결할 두 번째 부품 선택" : ""}`;
      elements.sandboxStatus.dataset.valid = String(Boolean(evaluation.valid));
    }
  }

  function renderMode() {
    shell.dataset.mode = state.mode;
    elements.modeButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.modeButton === state.mode));
    elements.teacherPanel.hidden = !(state.mode === "teacher" && state.panelOpen);
    renderControls();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function draw() {
    const rect = resizeCanvas();
    const graphics = makeGraphics(context, rect.width, rect.height, config.theme);
    config.draw(graphics, { ...state.values }, state.result, state.time, state.view, state.depth, state.sandbox ? structuredClone(state.sandbox) : null);
    if (sandboxViewActive()) {
      config.sandbox.draw?.(graphics, structuredClone(state.sandbox), state.result, state.time, {
        selected: state.selectedPart,
        linkStart: state.linkStart,
      });
    }
  }

  function renderDynamic() {
    visibleOutputs().forEach((output) => {
      const node = elements.readouts.querySelector(`[data-output="${CSS.escape(output.key)}"]`);
      if (node) node.textContent = outputLabel(output, state.result[output.key]);
    });
    visibleVariables().forEach((definition) => {
      const output = elements.controls.querySelector(`[data-variable-output="${CSS.escape(definition.key)}"]`);
      if (output) output.textContent = `${valueLabel(definition, state.values[definition.key])}${definition.options ? "" : ` ${definition.unit || ""}`}`;
    });
    const view = config.views.find((item) => item.id === state.view) || config.views[0];
    elements.stageView.textContent = view.label;
    elements.stageLegend.textContent = typeof config.legend === "function" ? config.legend(state.result, state.view) : (view.hint || config.subtitle || "");
    elements.caption.textContent = config.caption?.(state.result, state.values, state.view, state.time, state.depth) || config.subtitle || "";
    elements.status.dataset.running = String(state.running);
    elements.status.textContent = state.running ? "관찰 중" : "관찰 준비";
    elements.play.textContent = state.running ? "❚❚" : "▶";
    elements.time.value = String(state.time);
    elements.timeOutput.textContent = `${formatNumber(state.time, 2)} s`;
    renderModelChart();
    renderSandboxStatus();
    draw();
  }

  function renderStatic() {
    elements.depth.value = state.depth;
    elements.seatLabel.textContent = state.seat;
    elements.classCode.value = state.classCode;
    elements.viewButtons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.view === state.view));
    renderMission();
    compute();
    renderReadouts();
    renderControls();
    renderPrediction();
    renderTrialSummary();
    renderClassEvidence();
    renderTheory();
    renderSeats();
    renderMode();
    renderDynamic();
  }

  function addTrial(trial) {
    state.trials.push(trial);
    state.trials = state.trials.slice(-500);
    writeJson(storageKey(config, `trials:${state.classCode}`), state.trials);
    renderClassEvidence();
    if (state.remote) {
      remoteRequest("/api/classroom/trials", {
        method: "POST",
        body: JSON.stringify({ labId: config.id, modelVersion: config.version || "1.0.0", mission: state.mission, payload: trial }),
      }).then(syncRemoteTrials).catch((error) => {
        state.remote.connected = false;
        elements.status.textContent = `서버 제출 실패 · 로컬 보관: ${error.message}`;
      });
    }
  }

  function makeDemoTrials(count = 24) {
    const random = math.seeded([...state.classCode].reduce((sum, character) => sum + character.charCodeAt(0), 0) + count);
    for (let index = 0; index < count; index += 1) {
      const values = { ...state.values };
      config.variables.forEach((definition, variableIndex) => {
        if (definition.options) {
          const optionIndex = Math.floor(random() * definition.options.length);
          values[definition.key] = definition.options[optionIndex].value;
        } else if (!state.locks[definition.key]) {
          const center = Number(state.values[definition.key]);
          const span = (definition.max - definition.min) * (variableIndex === 0 ? 0.35 : 0.15);
          const raw = math.clamp(center + (random() + random() - 1) * span, definition.min, definition.max);
          values[definition.key] = Math.round(raw / definition.step) * definition.step;
        }
      });
      const result = config.compute(values, config.duration || 10, state.view, state.depth, state.sandbox ? structuredClone(state.sandbox) : null);
      const output = trialMetric(result).definition;
      addTrial({
        id: `demo-${Date.now()}-${index}`,
        timestamp: new Date().toISOString(),
        classCode: state.classCode,
        seat: `학생${index + 1}`,
        label: "예시 표본",
        mission: state.mission,
        view: state.view,
        depth: state.depth,
        prediction: "",
        values,
        outputs: Object.fromEntries(config.outputs.map((item) => [item.key, result[item.key]])),
        metricKey: output.key,
        metric: result[output.key],
      });
    }
  }

  elements.modeButtons.forEach((button) => button.addEventListener("click", () => {
    state.mode = button.dataset.modeButton;
    state.panelOpen = state.mode === "teacher";
    renderMode();
  }));
  elements.viewButtons.forEach((button) => button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.running = false;
    compute();
    renderStatic();
  }));
  elements.depth.addEventListener("change", () => {
    state.depth = elements.depth.value;
    writeJson(storageKey(config, "preferences"), { seat: state.seat, depth: state.depth });
    renderStatic();
  });
  elements.play.addEventListener("click", () => {
    if (state.time >= (config.duration || 10)) state.time = 0;
    state.running = !state.running;
    state.lastFrame = performance.now();
    renderDynamic();
  });
  elements.time.addEventListener("input", () => {
    state.time = Number(elements.time.value);
    state.running = false;
    compute();
    renderDynamic();
  });
  elements.speed.addEventListener("change", () => { state.speed = Number(elements.speed.value); });
  elements.reset.addEventListener("click", () => {
    state.time = 0;
    state.running = false;
    setValues(Object.fromEntries(config.variables.map((item) => [item.key, item.default])));
    renderStatic();
  });
  elements.mission.addEventListener("change", () => {
    state.mission = elements.mission.value;
    renderMission();
  });
  elements.applyMission.addEventListener("click", () => {
    const mission = currentMission();
    setValues(mission?.preset || {});
    if (mission?.view) state.view = mission.view;
    state.time = mission?.time ?? 0;
    state.running = false;
    renderStatic();
  });
  root.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => {
    state.saved[button.dataset.save] = makeTrial(button.dataset.save);
    renderTrialSummary();
  }));
  root.querySelector("[data-submit]").addEventListener("click", () => addTrial(makeTrial("제출")));
  root.querySelector("[data-export]").addEventListener("click", () => {
    const trials = classTrials();
    const headers = ["수업코드", "좌석별칭", "시각", ...config.variables.map((item) => item.label), ...config.outputs.map((item) => item.label)];
    const rows = trials.map((trial) => [trial.classCode, trial.seat, trial.timestamp, ...config.variables.map((item) => trial.values[item.key]), ...config.outputs.map((item) => trial.outputs[item.key])]);
    downloadCsv(`${config.id}-${state.classCode}.csv`, [headers, ...rows]);
  });
  root.querySelector("[data-teacher-close]").addEventListener("click", () => { state.panelOpen = false; elements.teacherPanel.hidden = true; });
  elements.classCode.addEventListener("change", () => {
    state.classCode = safeAlias(elements.classCode.value, `${config.id.toUpperCase()}-01`);
    state.locks = readJson(storageKey(config, `locks:${state.classCode}`), {});
    state.seats = readJson(storageKey(config, `seats:${state.classCode}`), ["학생1"]);
    state.trials = readJson(storageKey(config, `trials:${state.classCode}`), []);
    renderStatic();
  });
  root.querySelector("[data-create-seats]").addEventListener("click", () => {
    const prefix = safeAlias(elements.seatPrefix.value, "학생");
    const count = math.clamp(Number(elements.seatCount.value) || 1, 1, 40);
    state.seats = Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
    state.seat = state.seats[0];
    writeJson(storageKey(config, `seats:${state.classCode}`), state.seats);
    renderStatic();
  });
  root.querySelector("[data-demo-samples]").addEventListener("click", () => makeDemoTrials(24));
  root.querySelector("[data-clear-class]").addEventListener("click", () => {
    if (!confirm("현재 수업 코드의 실험 표본만 비울까요? 좌석 계정은 유지됩니다.")) return;
    state.trials = state.trials.filter((trial) => trial.classCode !== state.classCode);
    writeJson(storageKey(config, `trials:${state.classCode}`), state.trials);
    renderClassEvidence();
  });

  if (config.sandbox) {
    function commitSandbox() {
      persistSandbox();
      state.running = false;
      compute();
      renderDynamic();
    }

    function hitSandboxPart(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      let best = null; let distance = Infinity;
      state.sandbox.items.forEach((item) => {
        const definition = config.sandbox.parts.find((part) => part.type === item.type) || {};
        const dx = nx - item.x; const dy = ny - item.y; const current = Math.hypot(dx, dy);
        if (current <= (definition.hitRadius || 0.055) && current < distance) { best = item; distance = current; }
      });
      return { item: best, nx: clamp(nx, 0.04, 0.96), ny: clamp(ny, 0.1, 0.94) };
    }

    function addSandboxLink(fromId, toId) {
      if (!fromId || !toId || fromId === toId) return false;
      const from = state.sandbox.items.find((item) => item.id === fromId);
      const to = state.sandbox.items.find((item) => item.id === toId);
      if (!from || !to) return false;
      const allowed = config.sandbox.canLink ? config.sandbox.canLink(from, to, structuredClone(state.sandbox)) : true;
      const duplicate = state.sandbox.links.some((link) => (link.from === from.id && link.to === to.id) || (link.to === from.id && link.from === to.id));
      if (!allowed || duplicate) return false;
      state.sandbox.links.push({ id: `link-${Date.now()}-${state.sandbox.links.length}`, from: from.id, to: to.id });
      return true;
    }

    root.querySelectorAll("[data-add-part]").forEach((button) => button.addEventListener("click", () => {
      const definition = config.sandbox.parts.find((part) => part.type === button.dataset.addPart);
      const sameCount = state.sandbox.items.filter((item) => item.type === definition.type).length;
      if (definition.max && sameCount >= definition.max) {
        elements.sandboxStatus.textContent = `${definition.label}은 최대 ${definition.max}개까지 놓을 수 있습니다.`;
        return;
      }
      const index = state.sandbox.items.length;
      const item = {
        id: `${definition.type}-${Date.now()}-${index}`,
        type: definition.type,
        label: definition.label,
        x: 0.42 + (index % 4) * 0.065,
        y: 0.38 + (Math.floor(index / 4) % 4) * 0.09,
        rotation: 0,
        ...definition.defaults,
      };
      state.sandbox.items.push(item); state.selectedPart = item.id; commitSandbox();
    }));

    elements.linkMode?.addEventListener("click", () => {
      state.linkMode = !state.linkMode; state.linkStart = null; renderSandboxStatus();
    });
    elements.sandboxPartSelect?.addEventListener("change", () => { state.selectedPart = elements.sandboxPartSelect.value || null; renderSandboxStatus(); draw(); });
    root.querySelector("[data-link-from]")?.addEventListener("click", () => {
      if (!state.selectedPart) { elements.sandboxStatus.textContent = "먼저 배치된 부품을 선택하세요."; return; }
      state.linkStart = state.selectedPart; renderSandboxStatus();
    });
    root.querySelector("[data-link-to]")?.addEventListener("click", () => {
      if (!state.linkStart || !state.selectedPart || state.linkStart === state.selectedPart) { elements.sandboxStatus.textContent = "시작점을 지정한 뒤 다른 부품을 선택하세요."; return; }
      addSandboxLink(state.linkStart, state.selectedPart); state.linkStart = null; commitSandbox();
    });
    root.querySelector("[data-rotate-part]")?.addEventListener("click", () => {
      const item = state.sandbox.items.find((entry) => entry.id === state.selectedPart); if (!item) return;
      item.rotation = ((item.rotation || 0) + 90) % 360; commitSandbox();
    });
    root.querySelector("[data-delete-part]")?.addEventListener("click", () => {
      if (!state.selectedPart) return;
      state.sandbox.items = state.sandbox.items.filter((item) => item.id !== state.selectedPart);
      state.sandbox.links = state.sandbox.links.filter((link) => link.from !== state.selectedPart && link.to !== state.selectedPart);
      state.selectedPart = null; state.linkStart = null; commitSandbox();
    });
    root.querySelector("[data-clear-sandbox]")?.addEventListener("click", () => {
      if (!confirm("현재 자유 제작 장면의 부품과 연결을 모두 비울까요?")) return;
      state.sandbox = { items: [], links: [] }; state.selectedPart = null; state.linkStart = null; commitSandbox();
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (!sandboxViewActive()) return;
      const hit = hitSandboxPart(event.clientX, event.clientY);
      if (!hit.item) { state.selectedPart = null; state.linkStart = null; renderDynamic(); return; }
      state.selectedPart = hit.item.id;
      if (state.linkMode) {
        if (!state.linkStart) state.linkStart = hit.item.id;
        else if (state.linkStart !== hit.item.id) {
          addSandboxLink(state.linkStart, hit.item.id);
          state.linkStart = null; commitSandbox();
        } else state.linkStart = null;
        renderSandboxStatus(); return;
      }
      const rect = canvas.getBoundingClientRect();
      state.dragging = { id: hit.item.id, dx: hit.item.x - (event.clientX - rect.left) / rect.width, dy: hit.item.y - (event.clientY - rect.top) / rect.height };
      canvas.setPointerCapture(event.pointerId); renderDynamic();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.dragging || !sandboxViewActive()) return;
      const rect = canvas.getBoundingClientRect(); const item = state.sandbox.items.find((entry) => entry.id === state.dragging.id); if (!item) return;
      item.x = clamp((event.clientX - rect.left) / rect.width + state.dragging.dx, 0.05, 0.95);
      item.y = clamp((event.clientY - rect.top) / rect.height + state.dragging.dy, 0.13, 0.93);
      compute(); renderDynamic();
    });
    canvas.addEventListener("pointerup", () => { if (state.dragging) persistSandbox(); state.dragging = null; });
    canvas.addEventListener("dblclick", (event) => {
      if (!sandboxViewActive()) return; const hit = hitSandboxPart(event.clientX, event.clientY); if (!hit.item) return;
      hit.item.rotation = ((hit.item.rotation || 0) + 90) % 360; state.selectedPart = hit.item.id; commitSandbox();
    });
    window.addEventListener("keydown", (event) => {
      if (!sandboxViewActive()) return;
      if ((event.key === "Delete" || event.key === "Backspace") && state.selectedPart && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) {
        event.preventDefault(); root.querySelector("[data-delete-part]")?.click();
      }
      if (event.key === "Escape") { state.linkMode = false; state.linkStart = null; renderSandboxStatus(); }
    });
  }

  const resizeObserver = new ResizeObserver(() => draw());
  resizeObserver.observe(canvas.parentElement);
  document.addEventListener("visibilitychange", () => { state.lastFrame = performance.now(); });

  function animate(now) {
    const delta = Math.min(0.05, (now - state.lastFrame) / 1000);
    state.lastFrame = now;
    if (state.running) {
      state.time += delta * state.speed;
      if (state.time >= (config.duration || 10)) {
        state.time = config.duration || 10;
        state.running = false;
      }
      compute();
      renderDynamic();
    }
    requestAnimationFrame(animate);
  }

  renderStatic();
  connectRemoteClassroom();
  requestAnimationFrame(animate);
  return { state, render: renderStatic, config };
}
