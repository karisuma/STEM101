import type { Flight, Point } from "../simulation/model";
import { positionAt, TARGET_DISTANCE } from "../simulation/model";

type Props = {
  flight: Flight;
  previousFlight: Flight | null;
  progress: number;
  showTarget: boolean;
};

const WIDTH = 920;
const HEIGHT = 560;
const PADDING = { left: 64, right: 40, top: 42, bottom: 66 };

const pathFor = (points: Point[], xScale: number, yScale: number) =>
  points
    .map((point, index) => {
      const x = PADDING.left + point.x * xScale;
      const y = HEIGHT - PADDING.bottom - point.y * yScale;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

export default function TrajectoryCanvas({
  flight,
  previousFlight,
  progress,
  showTarget,
}: Props) {
  const maxDistance = Math.max(36, flight.distance + 2, previousFlight?.distance ?? 0, TARGET_DISTANCE + 4);
  const maxHeight = Math.max(14, flight.peakHeight + 2, previousFlight?.peakHeight ?? 0);
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const xScale = chartWidth / maxDistance;
  const yScale = chartHeight / maxHeight;
  const ball = positionAt(flight, progress);
  const ballX = PADDING.left + ball.x * xScale;
  const ballY = HEIGHT - PADDING.bottom - ball.y * yScale;
  const visiblePoints = flight.trajectory.slice(
    0,
    Math.max(2, Math.round(progress * (flight.trajectory.length - 1)) + 1),
  );

  return (
    <svg
      className="trajectory-canvas"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="발사체의 포물선 운동 그래프"
    >
      <defs>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(172, 207, 245, .16)" strokeWidth="1" />
        </pattern>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" />
      <rect x={0} y={HEIGHT - PADDING.bottom} width={WIDTH} height={PADDING.bottom} fill="#06182d" />

      {Array.from({ length: 7 }, (_, index) => {
        const x = PADDING.left + (chartWidth * index) / 6;
        const value = (maxDistance * index) / 6;
        return (
          <g key={`x-${index}`}>
            <line x1={x} x2={x} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="rgba(172, 207, 245, .15)" strokeDasharray="4 7" />
            <text x={x} y={HEIGHT - 30} textAnchor="middle" className="axis-text">{value.toFixed(0)}</text>
          </g>
        );
      })}
      {Array.from({ length: 5 }, (_, index) => {
        const y = HEIGHT - PADDING.bottom - (chartHeight * index) / 4;
        const value = (maxHeight * index) / 4;
        return (
          <g key={`y-${index}`}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="rgba(172, 207, 245, .15)" strokeDasharray="4 7" />
            <text x={46} y={y + 5} textAnchor="end" className="axis-text">{value.toFixed(0)}</text>
          </g>
        );
      })}

      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={WIDTH - PADDING.right + 12} y2={HEIGHT - PADDING.bottom} className="axis-line" />
      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={PADDING.left} y2={PADDING.top - 8} className="axis-line" />
      <text x={WIDTH - PADDING.right + 18} y={HEIGHT - PADDING.bottom - 14} className="axis-title">x (m)</text>
      <text x={PADDING.left - 4} y={PADDING.top - 16} className="axis-title">y (m)</text>

      {showTarget && (
        <g className="target">
          <line x1={PADDING.left + TARGET_DISTANCE * xScale} x2={PADDING.left + TARGET_DISTANCE * xScale} y1={HEIGHT - PADDING.bottom} y2={HEIGHT - PADDING.bottom - 172} stroke="#e9edf5" strokeWidth="7" />
          <circle cx={PADDING.left + TARGET_DISTANCE * xScale} cy={HEIGHT - PADDING.bottom - 180} r="29" fill="none" stroke="#f4a35b" strokeWidth="10" strokeDasharray="8 4" />
          <text x={PADDING.left + TARGET_DISTANCE * xScale} y={HEIGHT - PADDING.bottom - 225} textAnchor="middle" className="target-label">목표 {TARGET_DISTANCE} m</text>
        </g>
      )}

      {previousFlight && <path d={pathFor(previousFlight.trajectory, xScale, yScale)} className="trajectory-previous" />}
      <path d={pathFor(visiblePoints, xScale, yScale)} className="trajectory-current" filter="url(#glow)" />
      <g transform={`translate(${PADDING.left - 7} ${HEIGHT - PADDING.bottom - 7}) rotate(-28)`}>
        <rect x="-16" y="-11" width="31" height="22" rx="5" fill="#b7c1cd" />
        <rect x="-7" y="-5" width="36" height="10" rx="4" fill="#64748b" />
        <circle cx="-14" cy="12" r="9" fill="#4b5563" />
      </g>
      <circle cx={ballX} cy={ballY} r="9" fill="#ff9b36" className="projectile-ball" />
      <circle cx={ballX} cy={ballY} r="3.5" fill="#fff3d2" />
      <text x={PADDING.left + 4} y={HEIGHT - 14} className="ground-text">발사 지점</text>
    </svg>
  );
}
