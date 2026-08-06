import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  EXPERIMENT_AXIS_EXTENTS,
  type AxisExtent,
  type ExperimentAxisKey,
} from "../axisRanges";
import type { ExperimentRecord } from "../experiments";

export type { ExperimentRecord } from "../experiments";
export type { ExperimentAxisKey } from "../axisRanges";

export type PlotMode = "2d" | "3d";

export type ExperimentPlotProps = {
  records: ExperimentRecord[];
  mode: PlotMode;
  xAxis: ExperimentAxisKey;
  yAxis: ExperimentAxisKey;
  zAxis: ExperimentAxisKey;
  onModeChange: (mode: PlotMode) => void;
  onAxisChange: (axis: "x" | "y" | "z", key: ExperimentAxisKey) => void;
  selectedId?: string | null;
  onSelect: (id: string) => void;
};

type AxisDefinition = {
  key: ExperimentAxisKey;
  label: string;
  unit: string;
  digits: number;
};

type Point2D = { x: number; y: number };
type Point3D = Point2D & { depth: number };

export const EXPERIMENT_AXIS_OPTIONS: readonly AxisDefinition[] = [
  { key: "angle", label: "발사 각도", unit: "°", digits: 0 },
  { key: "speed", label: "초기 속력", unit: "m/s", digits: 1 },
  { key: "startHeight", label: "발사 높이", unit: "m", digits: 1 },
  { key: "gravityLevel", label: "중력 단계", unit: "단계", digits: 0 },
  { key: "gravity", label: "중력 가속도", unit: "m/s²", digits: 2 },
  { key: "windLevel", label: "바람 단계", unit: "단계", digits: 0 },
  { key: "wind", label: "바람 속도", unit: "m/s", digits: 1 },
  { key: "dragLevel", label: "공기저항 단계", unit: "단계", digits: 0 },
  { key: "drag", label: "저항 계수", unit: "", digits: 3 },
  { key: "airDensityLevel", label: "공기밀도 단계", unit: "단계", digits: 0 },
  { key: "airDensity", label: "공기 밀도", unit: "kg/m³", digits: 3 },
  { key: "distance", label: "도달 거리", unit: "m", digits: 1 },
  { key: "peakHeight", label: "최고 높이", unit: "m", digits: 1 },
  { key: "duration", label: "비행 시간", unit: "s", digits: 2 },
  { key: "impactSpeed", label: "착지 속력", unit: "m/s", digits: 1 },
] as const;

const AXIS_DEFINITIONS = Object.fromEntries(
  EXPERIMENT_AXIS_OPTIONS.map((definition) => [definition.key, definition]),
) as Record<ExperimentAxisKey, AxisDefinition>;

const TWO_D_WIDTH = 760;
const TWO_D_HEIGHT = 430;
const TWO_D_PAD = { left: 82, right: 34, top: 30, bottom: 72 };
const THREE_D_WIDTH = 760;
const THREE_D_HEIGHT = 470;
const THREE_D_CENTER = { x: 380, y: 236 };
const THREE_D_SIZE = 154;
const GRID_TICKS = 5;

function valueOf(record: ExperimentRecord, key: ExperimentAxisKey) {
  const value = record[key];
  return Number.isFinite(value) ? value : 0;
}

function normalize(value: number, extent: AxisExtent) {
  const span = extent.max - extent.min;
  if (span === 0) return 0.5;
  return Math.max(0, Math.min(1, (value - extent.min) / span));
}

function formatValue(value: number, key: ExperimentAxisKey, withUnit = true) {
  const definition = AXIS_DEFINITIONS[key];
  const normalized = Math.abs(value) < 10 ** -(definition.digits + 1) ? 0 : value;
  const text = normalized.toLocaleString("ko-KR", {
    minimumFractionDigits: definition.digits,
    maximumFractionDigits: definition.digits,
  });
  return withUnit && definition.unit ? `${text} ${definition.unit}` : text;
}

function createdAtTime(record: ExperimentRecord, fallback: number) {
  const parsed = Date.parse(record.createdAt);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "기록 시각 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ticksFor(extent: AxisExtent) {
  return Array.from({ length: GRID_TICKS }, (_, index) => {
    const ratio = index / (GRID_TICKS - 1);
    return { ratio, value: extent.min + (extent.max - extent.min) * ratio };
  });
}

function correlationOf(
  records: ExperimentRecord[],
  xAxis: ExperimentAxisKey,
  yAxis: ExperimentAxisKey,
) {
  if (records.length < 3) return null;
  const xMean = records.reduce((sum, record) => sum + valueOf(record, xAxis), 0) / records.length;
  const yMean = records.reduce((sum, record) => sum + valueOf(record, yAxis), 0) / records.length;
  let numerator = 0;
  let xSquareSum = 0;
  let ySquareSum = 0;
  records.forEach((record) => {
    const xOffset = valueOf(record, xAxis) - xMean;
    const yOffset = valueOf(record, yAxis) - yMean;
    numerator += xOffset * yOffset;
    xSquareSum += xOffset ** 2;
    ySquareSum += yOffset ** 2;
  });
  const denominator = Math.sqrt(xSquareSum * ySquareSum);
  return denominator === 0 ? null : numerator / denominator;
}

function rotateAndProject(
  point: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
): Point3D {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const yawX = point.x * cosYaw - point.z * sinYaw;
  const yawZ = point.x * sinYaw + point.z * cosYaw;
  const pitchY = point.y * cosPitch - yawZ * sinPitch;
  const depth = point.y * sinPitch + yawZ * cosPitch;
  const perspective = 1 / (1.12 - depth * 0.12);
  return {
    x: THREE_D_CENTER.x + yawX * THREE_D_SIZE * perspective,
    y: THREE_D_CENTER.y - pitchY * THREE_D_SIZE * perspective,
    depth,
  };
}

function axisName(key: ExperimentAxisKey) {
  const definition = AXIS_DEFINITIONS[key];
  return definition.unit ? `${definition.label} (${definition.unit})` : definition.label;
}

function AxisSelect({
  axis,
  value,
  onChange,
  id,
}: {
  axis: "x" | "y" | "z";
  value: ExperimentAxisKey;
  onChange: ExperimentPlotProps["onAxisChange"];
  id: string;
}) {
  return (
    <label className="experiment-plot__axis-control" htmlFor={id}>
      <span>{axis.toUpperCase()}축</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(axis, event.target.value as ExperimentAxisKey)}
      >
        {EXPERIMENT_AXIS_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}{option.unit ? ` (${option.unit})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ExperimentPlot({
  records,
  mode,
  xAxis,
  yAxis,
  zAxis,
  onModeChange,
  onAxisChange,
  selectedId,
  onSelect,
}: ExperimentPlotProps) {
  const idPrefix = useId();
  const [rotation, setRotation] = useState({ yaw: -0.58, pitch: -0.38 });
  const [isRotating, setIsRotating] = useState(false);
  const drag = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    yaw: number;
    pitch: number;
  } | null>(null);

  const latestRecord = useMemo(() => {
    let latest: ExperimentRecord | undefined;
    let latestTime = -Infinity;
    records.forEach((record, index) => {
      const time = createdAtTime(record, index);
      if (time >= latestTime) {
        latest = record;
        latestTime = time;
      }
    });
    return latest;
  }, [records]);

  const selectedRecord = records.find((record) => record.id === selectedId) ?? latestRecord;
  const xExtent = EXPERIMENT_AXIS_EXTENTS[xAxis];
  const yExtent = EXPERIMENT_AXIS_EXTENTS[yAxis];
  const zExtent = EXPERIMENT_AXIS_EXTENTS[zAxis];
  const correlation = useMemo(
    () => correlationOf(records, xAxis, yAxis),
    [records, xAxis, yAxis],
  );

  const projected3D = useMemo(() => records.map((record) => {
    const point = rotateAndProject({
      x: normalize(valueOf(record, xAxis), xExtent) * 2 - 1,
      y: normalize(valueOf(record, yAxis), yExtent) * 2 - 1,
      z: normalize(valueOf(record, zAxis), zExtent) * 2 - 1,
    }, rotation.yaw, rotation.pitch);
    return { record, ...point };
  }).sort((a, b) => a.depth - b.depth), [records, rotation, xAxis, xExtent, yAxis, yExtent, zAxis, zExtent]);

  const cube = useMemo(() => {
    const corners = [
      { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
      { x: -1, y: 1, z: -1 }, { x: 1, y: 1, z: -1 },
      { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
      { x: -1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 },
    ].map((point) => rotateAndProject(point, rotation.yaw, rotation.pitch));
    const origin = corners[0];
    return {
      corners,
      axes: [
        { axis: "x" as const, start: origin, end: corners[1], key: xAxis, extent: xExtent },
        { axis: "y" as const, start: origin, end: corners[2], key: yAxis, extent: yExtent },
        { axis: "z" as const, start: origin, end: corners[4], key: zAxis, extent: zExtent },
      ],
    };
  }, [rotation, xAxis, xExtent, yAxis, yExtent, zAxis, zExtent]);

  const selectFromKeyboard = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(id);
  };

  const beginRotation = (event: PointerEvent<SVGSVGElement>) => {
    if (mode !== "3d" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      yaw: rotation.yaw,
      pitch: rotation.pitch,
    };
    setIsRotating(true);
  };

  const continueRotation = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.current.clientX;
    const dy = event.clientY - drag.current.clientY;
    setRotation({
      yaw: drag.current.yaw - dx * 0.009,
      pitch: Math.max(-1.15, Math.min(1.15, drag.current.pitch + dy * 0.009)),
    });
  };

  const endRotation = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
    setIsRotating(false);
  };

  const plotPoint = (
    record: ExperimentRecord,
    point: Point2D,
    key: string,
    depth = 0,
  ) => {
    const isSelected = selectedRecord?.id === record.id;
    const isLatest = latestRecord?.id === record.id;
    const className = [
      "experiment-plot__point",
      isSelected ? "is-selected" : "",
      isLatest ? "is-latest" : "",
    ].filter(Boolean).join(" ");
    return (
      <g
        className={className}
        key={key}
        role="button"
        tabIndex={0}
        aria-label={`${formatCreatedAt(record.createdAt)} 실험, ${axisName(xAxis)} ${formatValue(valueOf(record, xAxis), xAxis)}, ${axisName(yAxis)} ${formatValue(valueOf(record, yAxis), yAxis)}${mode === "3d" ? `, ${axisName(zAxis)} ${formatValue(valueOf(record, zAxis), zAxis)}` : ""}`}
        aria-pressed={isSelected}
        onClick={() => onSelect(record.id)}
        onKeyDown={(event) => selectFromKeyboard(event, record.id)}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <circle className="experiment-plot__point-hit" cx={point.x} cy={point.y} r="18" />
        {isSelected ? <circle className="experiment-plot__point-ring" cx={point.x} cy={point.y} r={mode === "3d" ? 10 : 11} /> : null}
        <circle
          className="experiment-plot__point-mark"
          cx={point.x}
          cy={point.y}
          r={mode === "3d" ? Math.max(4.5, 6.5 + depth * 1.5) : 6.5}
        />
      </g>
    );
  };

  const render2D = () => {
    const chartWidth = TWO_D_WIDTH - TWO_D_PAD.left - TWO_D_PAD.right;
    const chartHeight = TWO_D_HEIGHT - TWO_D_PAD.top - TWO_D_PAD.bottom;
    const project = (record: ExperimentRecord) => ({
      x: TWO_D_PAD.left + normalize(valueOf(record, xAxis), xExtent) * chartWidth,
      y: TWO_D_HEIGHT - TWO_D_PAD.bottom - normalize(valueOf(record, yAxis), yExtent) * chartHeight,
    });
    return (
      <svg
        className="experiment-plot__svg experiment-plot__svg--2d"
        viewBox={`0 0 ${TWO_D_WIDTH} ${TWO_D_HEIGHT}`}
        role="img"
        aria-label={`${axisName(xAxis)}와 ${axisName(yAxis)}의 관계를 나타낸 실험 기록 산점도`}
      >
        <title>{axisName(xAxis)}와 {axisName(yAxis)} 관계</title>
        {ticksFor(yExtent).map((tick) => {
          const y = TWO_D_HEIGHT - TWO_D_PAD.bottom - tick.ratio * chartHeight;
          return <g key={`y-${tick.ratio}`}>
            <line className="experiment-plot__grid" x1={TWO_D_PAD.left} x2={TWO_D_WIDTH - TWO_D_PAD.right} y1={y} y2={y} />
            <text className="experiment-plot__tick" x={TWO_D_PAD.left - 12} y={y + 4} textAnchor="end">{formatValue(tick.value, yAxis, false)}</text>
          </g>;
        })}
        {ticksFor(xExtent).map((tick) => {
          const x = TWO_D_PAD.left + tick.ratio * chartWidth;
          return <g key={`x-${tick.ratio}`}>
            <line className="experiment-plot__grid" x1={x} x2={x} y1={TWO_D_PAD.top} y2={TWO_D_HEIGHT - TWO_D_PAD.bottom} />
            <text className="experiment-plot__tick" x={x} y={TWO_D_HEIGHT - TWO_D_PAD.bottom + 26} textAnchor="middle">{formatValue(tick.value, xAxis, false)}</text>
          </g>;
        })}
        <line className="experiment-plot__axis" x1={TWO_D_PAD.left} x2={TWO_D_WIDTH - TWO_D_PAD.right} y1={TWO_D_HEIGHT - TWO_D_PAD.bottom} y2={TWO_D_HEIGHT - TWO_D_PAD.bottom} />
        <line className="experiment-plot__axis" x1={TWO_D_PAD.left} x2={TWO_D_PAD.left} y1={TWO_D_PAD.top} y2={TWO_D_HEIGHT - TWO_D_PAD.bottom} />
        <text className="experiment-plot__axis-label" x={(TWO_D_PAD.left + TWO_D_WIDTH - TWO_D_PAD.right) / 2} y={TWO_D_HEIGHT - 16} textAnchor="middle">{axisName(xAxis)}</text>
        <text className="experiment-plot__axis-label" transform={`translate(22 ${(TWO_D_PAD.top + TWO_D_HEIGHT - TWO_D_PAD.bottom) / 2}) rotate(-90)`} textAnchor="middle">{axisName(yAxis)}</text>
        {records.map((record) => plotPoint(record, project(record), record.id))}
      </svg>
    );
  };

  const cubeEdges: Array<[number, number]> = [
    [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3],
    [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
  ];

  const render3D = () => (
    <svg
      className={`experiment-plot__svg experiment-plot__svg--3d${isRotating ? " is-rotating" : ""}`}
      viewBox={`0 0 ${THREE_D_WIDTH} ${THREE_D_HEIGHT}`}
      role="img"
      aria-label={`${axisName(xAxis)}, ${axisName(yAxis)}, ${axisName(zAxis)}의 관계를 원근 투영한 실험 기록 산점도. 빈 공간을 드래그하면 회전합니다.`}
      onPointerDown={beginRotation}
      onPointerMove={continueRotation}
      onPointerUp={endRotation}
      onPointerCancel={endRotation}
    >
      <title>{axisName(xAxis)}, {axisName(yAxis)}, {axisName(zAxis)}의 3차원 관계</title>
      {cubeEdges.map(([startIndex, endIndex]) => {
        const start = cube.corners[startIndex];
        const end = cube.corners[endIndex];
        return <line key={`${startIndex}-${endIndex}`} className="experiment-plot__cube-edge" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
      })}
      {cube.axes.map(({ axis, start, end, key, extent }) => (
        <g className={`experiment-plot__axis-3d experiment-plot__axis-3d--${axis}`} key={axis}>
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          <text className="experiment-plot__axis-min" x={start.x} y={start.y + 18} textAnchor="middle">{formatValue(extent.min, key, false)}</text>
          <text className="experiment-plot__axis-max" x={end.x} y={end.y + 18} textAnchor="middle">{formatValue(extent.max, key, false)}</text>
          <text className="experiment-plot__axis-label" x={end.x} y={end.y - 14} textAnchor="middle">{axis.toUpperCase()} · {axisName(key)}</text>
        </g>
      ))}
      {projected3D.map(({ record, x, y, depth }) => plotPoint(record, { x, y }, record.id, depth))}
    </svg>
  );

  const detailAxes = Array.from(new Set(mode === "3d" ? [xAxis, yAxis, zAxis] : [xAxis, yAxis]));

  return (
    <section className="experiment-plot" aria-labelledby={`${idPrefix}-title`}>
      <header className="experiment-plot__header">
        <div>
          <h2 id={`${idPrefix}-title`}>실험 기록 관계 그래프</h2>
          <p>{mode === "2d" ? "축은 전체 실험 가능 범위에 고정됩니다. 점의 이동을 비교하세요." : "고정된 세 축에서 공간을 드래그하며 군집과 경향을 살펴보세요."}</p>
        </div>
        <div className="experiment-plot__mode" role="group" aria-label="그래프 차원">
          <button type="button" className={mode === "2d" ? "is-active" : ""} aria-pressed={mode === "2d"} onClick={() => onModeChange("2d")}>2차원</button>
          <button type="button" className={mode === "3d" ? "is-active" : ""} aria-pressed={mode === "3d"} onClick={() => onModeChange("3d")}>3차원</button>
        </div>
      </header>

      <div className="experiment-plot__axes" aria-label="그래프 축 선택">
        <AxisSelect axis="x" id={`${idPrefix}-x`} value={xAxis} onChange={onAxisChange} />
        <AxisSelect axis="y" id={`${idPrefix}-y`} value={yAxis} onChange={onAxisChange} />
        {mode === "3d" ? <AxisSelect axis="z" id={`${idPrefix}-z`} value={zAxis} onChange={onAxisChange} /> : null}
      </div>

      <div className="experiment-plot__chart">
        {records.length === 0 ? (
          <div className="experiment-plot__empty" role="status">
            <strong>아직 기록된 실험이 없습니다.</strong>
            <span>조건을 정해 발사하면 결과가 이 그래프에 점으로 쌓입니다.</span>
          </div>
        ) : mode === "2d" ? render2D() : render3D()}
      </div>

      {mode === "2d" && correlation !== null ? (
        <p className="experiment-plot__insight" role="status">
          <strong>현재 점들의 상관계수 r = {correlation.toFixed(2)}</strong>
          <span>
            {Math.abs(correlation) >= 0.7
              ? correlation > 0 ? "두 값이 함께 커지는 경향이 강합니다." : "한 값이 커질수록 다른 값은 작아지는 경향이 강합니다."
              : Math.abs(correlation) >= 0.35
                ? "두 값 사이에 어느 정도 경향이 보입니다."
                : "현재 기록만으로는 뚜렷한 직선 관계가 보이지 않습니다."}
            {" "}상관은 원인을 증명하지 않으므로 다른 조건을 고정해 다시 실험하세요.
          </span>
        </p>
      ) : null}

      {mode === "3d" && records.length > 0 ? <p className="experiment-plot__gesture-hint">빈 공간을 마우스나 손가락으로 드래그하여 회전</p> : null}

      {selectedRecord ? (
        <aside className="experiment-plot__detail" aria-live="polite" aria-label="선택한 실험 기록">
          <div className="experiment-plot__detail-heading">
            <strong>{latestRecord?.id === selectedRecord.id ? "최근 실험" : "선택한 실험"}</strong>
            <time dateTime={selectedRecord.createdAt}>{formatCreatedAt(selectedRecord.createdAt)}</time>
          </div>
          <dl>
            {detailAxes.map((key) => <div key={key}><dt>{AXIS_DEFINITIONS[key].label}</dt><dd>{formatValue(valueOf(selectedRecord, key), key)}</dd></div>)}
          </dl>
        </aside>
      ) : null}
    </section>
  );
}
