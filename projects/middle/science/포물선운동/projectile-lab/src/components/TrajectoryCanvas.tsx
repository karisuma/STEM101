import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { Flight, FlightPoint } from "../simulation/model";
import { positionAt } from "../simulation/model";

export type RecordedFlight = {
  id: string;
  label: string;
  color: string;
  flight: Flight;
  visible: boolean;
};

type Props = {
  flight: Flight;
  recordedFlights: RecordedFlight[];
  progress: number;
  showVelocity: boolean;
  onAimChange?: (angle: number, speed: number) => void;
};

const WIDTH = 920;
const HEIGHT = 560;
const PADDING = { left: 64, right: 40, top: 42, bottom: 66 };
const MAX_AIM_LENGTH = 224;
const MIN_SPEED = 3;
const MAX_SPEED = 34;

const pathFor = (points: FlightPoint[], xScale: number, yScale: number) =>
  points.map((point, index) => {
    const x = PADDING.left + point.x * xScale;
    const y = HEIGHT - PADDING.bottom - point.y * yScale;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

export default function TrajectoryCanvas({
  flight,
  recordedFlights,
  progress,
  showVelocity,
  onAimChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const aimingPointer = useRef<number | null>(null);
  const visibleRecords = recordedFlights.filter((record) => record.visible);
  const maxDistance = Math.max(32, flight.distance * 1.14, ...visibleRecords.map((record) => record.flight.distance * 1.14));
  const maxHeight = Math.max(12, flight.peakHeight * 1.22, ...visibleRecords.map((record) => record.flight.peakHeight * 1.22));
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const xScale = chartWidth / maxDistance;
  const yScale = chartHeight / maxHeight;
  const ball = positionAt(flight, progress);
  const ballX = PADDING.left + ball.x * xScale;
  const ballY = HEIGHT - PADDING.bottom - ball.y * yScale;
  const visiblePoints = flight.trajectory.slice(0, Math.max(2, Math.round(progress * (flight.trajectory.length - 1)) + 1));
  const launcherRotation = -flight.settings.angle;
  const originX = PADDING.left;
  const originY = HEIGHT - PADDING.bottom - flight.settings.startHeight * yScale;
  const aimRadians = (flight.settings.angle * Math.PI) / 180;
  const aimLength = (flight.settings.speed / MAX_SPEED) * MAX_AIM_LENGTH;
  const aimX = originX + Math.cos(aimRadians) * aimLength;
  const aimY = originY - Math.sin(aimRadians) * aimLength;

  const updateAimFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (!onAimChange) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const pointerY = ((event.clientY - bounds.top) / bounds.height) * HEIGHT;
    const dx = Math.max(1, pointerX - originX);
    const dy = Math.min(-1, pointerY - originY);
    const distance = Math.min(MAX_AIM_LENGTH, Math.hypot(dx, dy));
    const angle = Math.max(5, Math.min(85, (Math.atan2(-dy, dx) * 180) / Math.PI));
    const speed = Math.max(MIN_SPEED, (distance / MAX_AIM_LENGTH) * MAX_SPEED);
    onAimChange(Math.round(angle), Math.round(speed * 2) / 2);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!onAimChange) return;
    aimingPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateAimFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (aimingPointer.current !== event.pointerId) return;
    updateAimFromPointer(event);
  };

  const stopAiming = (event: PointerEvent<SVGSVGElement>) => {
    if (aimingPointer.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    aimingPointer.current = null;
  };

  const handleAimKeys = (event: KeyboardEvent<SVGGElement>) => {
    if (!onAimChange) return;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const angleDelta = event.shiftKey ? 5 : 1;
    const speedDelta = event.shiftKey ? 2 : 0.5;
    const nextAngle = event.key === "ArrowUp"
      ? Math.min(85, flight.settings.angle + angleDelta)
      : event.key === "ArrowDown"
        ? Math.max(5, flight.settings.angle - angleDelta)
        : flight.settings.angle;
    const nextSpeed = event.key === "ArrowRight"
      ? Math.min(MAX_SPEED, flight.settings.speed + speedDelta)
      : event.key === "ArrowLeft"
        ? Math.max(MIN_SPEED, flight.settings.speed - speedDelta)
        : flight.settings.speed;
    onAimChange(nextAngle, nextSpeed);
  };

  return (
    <svg
      ref={svgRef}
      className="trajectory-canvas"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="발사체의 포물선 운동 그래프. 발사점에서 원하는 방향으로 드래그해 발사 벡터를 정합니다."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopAiming}
      onPointerCancel={stopAiming}
    >
      <defs>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(172, 224, 245, .16)" strokeWidth="1" /></pattern>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <marker id="aim-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#73e9ef" /></marker>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" />
      <rect x={0} y={HEIGHT - PADDING.bottom} width={WIDTH} height={PADDING.bottom} fill="#041323" />
      {Array.from({ length: 7 }, (_, index) => {
        const x = PADDING.left + (chartWidth * index) / 6;
        return <g key={`x-${index}`}><line x1={x} x2={x} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="rgba(172, 224, 245, .15)" strokeDasharray="4 7" /><text x={x} y={HEIGHT - 30} textAnchor="middle" className="axis-text">{((maxDistance * index) / 6).toFixed(0)}</text></g>;
      })}
      {Array.from({ length: 5 }, (_, index) => {
        const y = HEIGHT - PADDING.bottom - (chartHeight * index) / 4;
        return <g key={`y-${index}`}><line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="rgba(172, 224, 245, .15)" strokeDasharray="4 7" /><text x={46} y={y + 5} textAnchor="end" className="axis-text">{((maxHeight * index) / 4).toFixed(0)}</text></g>;
      })}
      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={WIDTH - PADDING.right + 12} y2={HEIGHT - PADDING.bottom} className="axis-line" />
      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={PADDING.left} y2={PADDING.top - 8} className="axis-line" />
      <text x={WIDTH - PADDING.right + 18} y={HEIGHT - PADDING.bottom - 14} className="axis-title">x (m)</text>
      <text x={PADDING.left - 4} y={PADDING.top - 16} className="axis-title">y (m)</text>
      {visibleRecords.map((record) => <path key={record.id} d={pathFor(record.flight.trajectory, xScale, yScale)} className="trajectory-record" style={{ stroke: record.color }} />)}
      <path d={pathFor(visiblePoints, xScale, yScale)} className="trajectory-current" filter="url(#glow)" />
      <g className="aim-guides" aria-hidden="true">
        {[8, 16, 24, 32].map((speed) => {
          const radius = (speed / MAX_SPEED) * MAX_AIM_LENGTH;
          return <path key={speed} d={`M ${originX + radius} ${originY} A ${radius} ${radius} 0 0 0 ${originX} ${originY - radius}`} />;
        })}
      </g>
      <g
        className="aim-vector"
        role="application"
        tabIndex={0}
        aria-label={`발사 벡터 ${flight.settings.angle}도, 초속 ${flight.settings.speed.toFixed(1)}미터. 화살표 키로 조절할 수 있습니다.`}
        onKeyDown={handleAimKeys}
      >
        <line x1={originX} y1={originY} x2={aimX} y2={aimY} markerEnd="url(#aim-arrow)" />
        <circle cx={aimX} cy={aimY} r="18" className="aim-hit-area" />
        <circle cx={aimX} cy={aimY} r="7" className="aim-handle" />
        <text x={aimX + 14} y={aimY - 12}>{flight.settings.angle}° · {flight.settings.speed.toFixed(1)} m/s</text>
      </g>
      <g transform={`translate(${originX - 7} ${originY - 7}) rotate(${launcherRotation})`}>
        <rect x="-16" y="-11" width="31" height="22" rx="5" fill="#b7c1cd" />
        <rect x="-7" y="-5" width="42" height="10" rx="4" fill="#64748b" />
        <circle cx="-14" cy="12" r="9" fill="#4b5563" />
      </g>
      <circle cx={ballX} cy={ballY} r="9" fill="#ffbd56" className="projectile-ball" />
      <circle cx={ballX} cy={ballY} r="3.5" fill="#fff3d2" />
      {showVelocity && <g className="velocity-vector"><line x1={ballX} y1={ballY} x2={ballX + Math.max(-56, Math.min(56, ball.vx * 3.2))} y2={ballY - Math.max(-56, Math.min(56, ball.vy * 3.2))} /><text x={ballX + 14} y={ballY - 16}>속도 벡터</text></g>}
      {Math.abs(flight.settings.wind) > 0.1 && <g className="wind-indicator" transform={`translate(${WIDTH - 174} 48)`}><line x1={0} y1={0} x2={flight.settings.wind > 0 ? 62 : -62} y2={0} /><text x={flight.settings.wind > 0 ? 72 : -72} y={5} textAnchor={flight.settings.wind > 0 ? "start" : "end"}>바람 {Math.abs(flight.settings.wind).toFixed(1)} m/s</text></g>}
      <text x={PADDING.left + 4} y={HEIGHT - 14} className="ground-text">발사 지점</text>
      <text x={PADDING.left + 4} y={HEIGHT - 45} className="aim-instruction">발사점에서 드래그 · 거리=세기 · 방향=각도</text>
    </svg>
  );
}
