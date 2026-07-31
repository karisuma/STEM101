import { useMemo } from "react";
import { buildAngleSweep, type Flight, type LaunchSettings } from "../simulation/model";

export type GraphMode = "height" | "speed" | "range";

type Props = { flight: Flight; settings: LaunchSettings; mode: GraphMode };

const WIDTH = 360;
const HEIGHT = 230;
const PAD = { left: 44, right: 18, top: 22, bottom: 36 };
const linePath = (points: Array<{ x: number; y: number }>) => points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

export default function TelemetryChart({ flight, settings, mode }: Props) {
  const series = useMemo(() => {
    if (mode === "range") return buildAngleSweep(settings).map((point) => ({ x: point.angle, y: point.distance }));
    return flight.trajectory.map((point) => ({ x: point.time, y: mode === "height" ? point.y : point.speed }));
  }, [flight, mode, settings]);
  const xMax = Math.max(1, series.at(-1)?.x ?? 1);
  const yMax = Math.max(1, ...series.map((point) => point.y)) * 1.12;
  const graphWidth = WIDTH - PAD.left - PAD.right;
  const graphHeight = HEIGHT - PAD.top - PAD.bottom;
  const project = (point: { x: number; y: number }) => ({ x: PAD.left + (point.x / xMax) * graphWidth, y: HEIGHT - PAD.bottom - (point.y / yMax) * graphHeight });
  const path = linePath(series.map(project));
  const current = mode === "range"
    ? { x: PAD.left + (settings.angle / xMax) * graphWidth, y: HEIGHT - PAD.bottom - (flight.distance / yMax) * graphHeight }
    : project(series[Math.min(series.length - 1, Math.round((series.length - 1) * 0.58))]);
  const labels = mode === "height"
    ? { title: "높이 변화", x: "시간 (s)", y: "높이 (m)" }
    : mode === "speed"
      ? { title: "속력 변화", x: "시간 (s)", y: "속력 (m/s)" }
      : { title: "각도와 도달 거리", x: "발사 각도 (°)", y: "거리 (m)" };

  return <section className="telemetry-chart" aria-label={labels.title}>
    <h2>{labels.title}</h2>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${labels.title} 그래프`}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => { const y = PAD.top + graphHeight * ratio; return <g key={ratio}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="chart-grid" /><text x={PAD.left - 8} y={y + 4} textAnchor="end">{(yMax * (1 - ratio)).toFixed(0)}</text></g>; })}
      {[0, 0.5, 1].map((ratio) => { const x = PAD.left + graphWidth * ratio; return <g key={ratio}><line x1={x} x2={x} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="chart-grid" /><text x={x} y={HEIGHT - 14} textAnchor="middle">{(xMax * ratio).toFixed(mode === "range" ? 0 : 1)}</text></g>; })}
      <path d={path} className="chart-line" />
      <circle cx={current.x} cy={current.y} r="5" className="chart-point" />
      <text x={PAD.left} y={13} className="chart-axis-label">{labels.y}</text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end" className="chart-axis-label">{labels.x}</text>
    </svg>
  </section>;
}
