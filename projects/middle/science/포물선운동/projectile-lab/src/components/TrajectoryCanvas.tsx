import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { LAUNCH_LIMITS, TRAJECTORY_AXIS_EXTENTS } from "../axisRanges";
import type { Flight, FlightPoint } from "../simulation/model";
import { positionAt } from "../simulation/model";

export type RecordedFlight = {
  id: string;
  label: string;
  color: string;
  flight: Flight;
  visible: boolean;
  isLatest: boolean;
};

type Props = {
  flight: Flight;
  recordedFlights: RecordedFlight[];
  progress: number;
  isFlightActive: boolean;
  showVelocity: boolean;
  onAimChange?: (angle: number, speed: number) => void;
  onAimCommit?: (angle: number, speed: number) => void;
  onInspectModeChange?: (isInspecting: boolean) => void;
};

const WIDTH = 920;
const HEIGHT = 560;
const PADDING = { left: 64, right: 40, top: 42, bottom: 66 };
const MAX_AIM_LENGTH = 224;
const MAX_ZOOM = 5;
const TRACKING_EDGE_RATIO = 0.95;
const TOOLTIP_WIDTH = 304;
const MIN_SPEED = LAUNCH_LIMITS.speed.min;
const MAX_SPEED = LAUNCH_LIMITS.speed.max;

const clientPointInSvg = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
) => {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
};

const pathFor = (
  points: FlightPoint[],
  xScale: number,
  yScale: number,
  camera: { x: number; y: number },
) =>
  points.map((point, index) => {
    const x = PADDING.left + (point.x - camera.x) * xScale;
    const y = HEIGHT - PADDING.bottom - (point.y - camera.y) * yScale;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

export default function TrajectoryCanvas({
  flight,
  recordedFlights,
  progress,
  isFlightActive,
  showVelocity,
  onAimChange,
  onAimCommit,
  onInspectModeChange,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const aimingPointer = useRef<number | null>(null);
  const aimDraft = useRef({ angle: flight.settings.angle, speed: flight.settings.speed });
  const visibleRecords = recordedFlights.filter((record) => record.visible);
  const maxDistance = TRAJECTORY_AXIS_EXTENTS.distance.max;
  const maxHeight = TRAJECTORY_AXIS_EXTENTS.height.max;
  const [zoom, setZoom] = useState(1);
  const isInspecting = zoom > 1.001;
  const [activeImpactId, setActiveImpactId] = useState<string | null>(null);
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const viewportDistance = maxDistance / zoom;
  const viewportHeight = maxHeight;
  const xScale = chartWidth / viewportDistance;
  const yScale = chartHeight / viewportHeight;
  const ball = positionAt(flight, progress);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const wasFlightActive = useRef(false);
  const cameraResetTimer = useRef<number | null>(null);

  useEffect(() => {
    onInspectModeChange?.(isInspecting);
  }, [isInspecting, onInspectModeChange]);

  useEffect(() => {
    if (isFlightActive) {
      if (cameraResetTimer.current !== null) {
        window.clearTimeout(cameraResetTimer.current);
        cameraResetTimer.current = null;
      }
      wasFlightActive.current = true;
      setCamera((current) => {
        const trackingBoundary = current.x + viewportDistance * TRACKING_EDGE_RATIO;
        if (ball.x <= trackingBoundary) {
          return current.y === 0 ? current : { x: current.x, y: 0 };
        }
        const nextX = Math.max(0, ball.x - viewportDistance * TRACKING_EDGE_RATIO);
        return Math.abs(current.x - nextX) < 0.01 && current.y === 0
          ? current
          : { x: nextX, y: 0 };
      });
      return;
    }

    if (wasFlightActive.current) {
      wasFlightActive.current = false;
      setCamera({
        x: Math.max(0, ball.x - viewportDistance * TRACKING_EDGE_RATIO),
        y: 0,
      });
      cameraResetTimer.current = window.setTimeout(() => {
        setCamera({ x: 0, y: 0 });
        cameraResetTimer.current = null;
      }, 2000);
    }
  }, [ball.x, isFlightActive, viewportDistance]);

  useEffect(
    () => () => {
      if (cameraResetTimer.current !== null) window.clearTimeout(cameraResetTimer.current);
    },
    [],
  );

  const stopPendingCameraReset = () => {
    if (cameraResetTimer.current === null) return;
    window.clearTimeout(cameraResetTimer.current);
    cameraResetTimer.current = null;
    wasFlightActive.current = false;
  };

  useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    if (!stage || !svg) return;

    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (cameraResetTimer.current !== null) {
        window.clearTimeout(cameraResetTimer.current);
        cameraResetTimer.current = null;
        wasFlightActive.current = false;
      }
      const pointer = clientPointInSvg(svg, event.clientX, event.clientY);
      if (!pointer) return;
      const ratioX = Math.max(0, Math.min(1, (pointer.x - PADDING.left) / chartWidth));
      const worldX = camera.x + ratioX * viewportDistance;
      const nextZoom = Math.max(1, Math.min(MAX_ZOOM, zoom * (event.deltaY < 0 ? 1.25 : 0.8)));
      if (Math.abs(nextZoom - zoom) < 0.001) return;
      const nextDistance = maxDistance / nextZoom;
      setCamera({
        x: Math.max(0, worldX - ratioX * nextDistance),
        y: 0,
      });
      setZoom(nextZoom);
      setActiveImpactId(null);
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [camera.x, chartWidth, maxDistance, viewportDistance, zoom]);

  const resetView = () => {
    stopPendingCameraReset();
    setZoom(1);
    setCamera({ x: 0, y: 0 });
    setActiveImpactId(null);
  };

  const ballX = PADDING.left + (ball.x - camera.x) * xScale;
  const ballY = HEIGHT - PADDING.bottom - (ball.y - camera.y) * yScale;
  const visiblePoints = flight.trajectory.slice(0, Math.max(2, Math.round(progress * (flight.trajectory.length - 1)) + 1));
  const launcherRotation = -flight.settings.angle;
  const originX = PADDING.left - camera.x * xScale;
  const originY = HEIGHT - PADDING.bottom - (flight.settings.startHeight - camera.y) * yScale;
  const groundY = HEIGHT - PADDING.bottom + camera.y * yScale;
  const aimRadians = (flight.settings.angle * Math.PI) / 180;
  const aimLength = (flight.settings.speed / MAX_SPEED) * MAX_AIM_LENGTH;
  const aimX = originX + Math.cos(aimRadians) * aimLength;
  const aimY = originY - Math.sin(aimRadians) * aimLength;

  const updateAimFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (isInspecting || !onAimChange) return;
    const pointer = clientPointInSvg(event.currentTarget, event.clientX, event.clientY);
    if (!pointer) return;
    const pointerX = pointer.x;
    const pointerY = pointer.y;
    const dx = Math.max(1, pointerX - originX);
    const dy = Math.min(-1, pointerY - originY);
    const distance = Math.min(MAX_AIM_LENGTH, Math.hypot(dx, dy));
    const angle = Math.max(LAUNCH_LIMITS.angle.min, Math.min(LAUNCH_LIMITS.angle.max, (Math.atan2(-dy, dx) * 180) / Math.PI));
    const speed = Math.max(MIN_SPEED, (distance / MAX_AIM_LENGTH) * MAX_SPEED);
    const next = { angle: Math.round(angle), speed: Math.round(speed * 2) / 2 };
    aimDraft.current = next;
    onAimChange(next.angle, next.speed);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (isInspecting || !onAimChange) return;
    aimingPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateAimFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (isInspecting) return;
    if (aimingPointer.current !== event.pointerId) return;
    updateAimFromPointer(event);
  };

  const stopAiming = (event: PointerEvent<SVGSVGElement>) => {
    if (isInspecting) {
      aimingPointer.current = null;
      return;
    }
    if (aimingPointer.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    aimingPointer.current = null;
    onAimCommit?.(aimDraft.current.angle, aimDraft.current.speed);
  };

  const cancelAiming = (event: PointerEvent<SVGSVGElement>) => {
    if (aimingPointer.current !== event.pointerId) return;
    aimingPointer.current = null;
  };

  const handleAimKeys = (event: KeyboardEvent<SVGGElement>) => {
    if (isInspecting || !onAimChange) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onAimCommit?.(flight.settings.angle, flight.settings.speed);
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const angleDelta = event.shiftKey ? 5 : 1;
    const speedDelta = event.shiftKey ? 2 : 0.5;
    const nextAngle = event.key === "ArrowUp"
      ? Math.min(LAUNCH_LIMITS.angle.max, flight.settings.angle + angleDelta)
      : event.key === "ArrowDown"
        ? Math.max(LAUNCH_LIMITS.angle.min, flight.settings.angle - angleDelta)
        : flight.settings.angle;
    const nextSpeed = event.key === "ArrowRight"
      ? Math.min(MAX_SPEED, flight.settings.speed + speedDelta)
      : event.key === "ArrowLeft"
        ? Math.max(MIN_SPEED, flight.settings.speed - speedDelta)
        : flight.settings.speed;
    onAimChange(nextAngle, nextSpeed);
  };

  return (
    <div ref={stageRef} className="trajectory-stage">
    <svg
      ref={svgRef}
      className={`trajectory-canvas${isInspecting ? " is-inspecting" : ""}`}
      data-camera-x={camera.x.toFixed(2)}
      data-camera-y={camera.y.toFixed(2)}
      data-zoom={zoom.toFixed(2)}
      data-ball-x={ball.x.toFixed(2)}
      data-tracking-boundary={(camera.x + viewportDistance * TRACKING_EDGE_RATIO).toFixed(2)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={isInspecting
        ? "확대된 실험 기록 탐색 그래프. 중앙의 기본 축척으로 버튼을 눌러 발사 모드로 돌아갑니다."
        : "발사체의 포물선 운동 그래프. 발사점에서 원하는 방향으로 드래그해 발사 벡터를 정합니다."}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopAiming}
      onPointerCancel={cancelAiming}
    >
      <defs>
        <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(172, 224, 245, .16)" strokeWidth="1" /></pattern>
        <clipPath id="trajectory-plot-clip"><rect x={PADDING.left} y={PADDING.top} width={chartWidth} height={chartHeight} /></clipPath>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <marker id="aim-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#73e9ef" /></marker>
      </defs>
      <rect x={PADDING.left} y={PADDING.top} width={chartWidth} height={chartHeight} fill="url(#grid)" />
      <rect x={PADDING.left} y={groundY} width={chartWidth} height={Math.max(0, HEIGHT - PADDING.bottom - groundY)} fill="#041323" clipPath="url(#trajectory-plot-clip)" />
      {Array.from({ length: 7 }, (_, index) => {
        const x = PADDING.left + (chartWidth * index) / 6;
        return <g key={`x-${index}`}><line x1={x} x2={x} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} stroke="rgba(172, 224, 245, .15)" strokeDasharray="4 7" /><text x={x} y={HEIGHT - 30} textAnchor="middle" className="axis-text">{(camera.x + (viewportDistance * index) / 6).toFixed(isInspecting ? 1 : 0)}</text></g>;
      })}
      {Array.from({ length: 5 }, (_, index) => {
        const y = HEIGHT - PADDING.bottom - (chartHeight * index) / 4;
        return <g key={`y-${index}`}><line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="rgba(172, 224, 245, .15)" strokeDasharray="4 7" /><text x={46} y={y + 5} textAnchor="end" className="axis-text">{((viewportHeight * index) / 4).toFixed(0)}</text></g>;
      })}
      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={WIDTH - PADDING.right + 12} y2={HEIGHT - PADDING.bottom} className="axis-line" />
      <line x1={PADDING.left} y1={HEIGHT - PADDING.bottom} x2={PADDING.left} y2={PADDING.top - 8} className="axis-line" />
      <text x={WIDTH - PADDING.right - 8} y={HEIGHT - PADDING.bottom - 14} textAnchor="end" className="axis-title">x (m)</text>
      <text x={PADDING.left - 4} y={PADDING.top - 16} className="axis-title">y (m)</text>
      {visibleRecords.map((record) => {
        const impact = record.flight.trajectory.at(-1);
        const impactX = impact ? PADDING.left + (impact.x - camera.x) * xScale : 0;
        const tooltipX = Math.max(
          PADDING.left + 8,
          Math.min(WIDTH - PADDING.right - TOOLTIP_WIDTH, impactX - TOOLTIP_WIDTH / 2),
        );
        const tooltipY = Math.max(PADDING.top + 8, groundY - 132);
        const settings = record.flight.settings;
        const impactIsVisible = Boolean(impact)
          && impactX >= PADDING.left
          && impactX <= WIDTH - PADDING.right
          && groundY >= PADDING.top
          && groundY <= HEIGHT - PADDING.bottom;
        return <g key={record.id}>
          <path
            d={pathFor(record.flight.trajectory, xScale, yScale, camera)}
            className={`trajectory-record${record.isLatest ? " trajectory-record--latest" : ""}`}
            style={{ stroke: record.color }}
            clipPath="url(#trajectory-plot-clip)"
          />
          {impact && impactIsVisible ? (
            <g
              className={`trajectory-impact-group${record.isLatest ? " is-latest" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${record.isLatest ? "가장 최근 실험" : "이전 실험"}, ${record.label}, 발사 높이 ${settings.startHeight.toFixed(1)}미터, 중력 ${settings.gravity.toFixed(2)}, 바람 ${settings.wind.toFixed(1)}, 공기 저항 ${settings.drag.toFixed(3)}, 공기 밀도 ${settings.airDensity.toFixed(3)}`}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerEnter={() => setActiveImpactId(record.id)}
              onPointerLeave={() => setActiveImpactId((current) => current === record.id ? null : current)}
              onFocus={() => setActiveImpactId(record.id)}
              onBlur={() => setActiveImpactId((current) => current === record.id ? null : current)}
              onClick={() => setActiveImpactId((current) => current === record.id ? null : record.id)}
            >
              <circle className="trajectory-impact-hit" cx={impactX} cy={groundY} r="18" />
              <circle className="trajectory-impact" cx={impactX} cy={groundY} r={record.isLatest ? 9 : 7} />
              {activeImpactId === record.id ? (
                <g className="trajectory-impact-tooltip" pointerEvents="none">
                  <rect x={tooltipX} y={tooltipY} width={TOOLTIP_WIDTH} height="118" />
                  <text x={tooltipX + 14} y={tooltipY + 22} className="trajectory-impact-tooltip__title">
                    {record.isLatest ? "가장 최근 실험" : "이전 실험"} · {record.label}
                  </text>
                  <text x={tooltipX + 14} y={tooltipY + 46}>발사 높이 {settings.startHeight.toFixed(1)} m · 중력 {settings.gravity.toFixed(2)} m/s²</text>
                  <text x={tooltipX + 14} y={tooltipY + 68}>바람 {settings.wind.toFixed(1)} m/s · 저항 {settings.drag.toFixed(3)}</text>
                  <text x={tooltipX + 14} y={tooltipY + 90}>공기 밀도 {settings.airDensity.toFixed(3)} kg/m³</text>
                  <text x={tooltipX + 14} y={tooltipY + 108}>거리 {record.flight.distance.toFixed(1)} m · 최고 {record.flight.peakHeight.toFixed(1)} m</text>
                </g>
              ) : null}
            </g>
          ) : null}
        </g>;
      })}
      {isFlightActive ? <path d={pathFor(visiblePoints, xScale, yScale, camera)} className="trajectory-current" filter="url(#glow)" clipPath="url(#trajectory-plot-clip)" /> : null}
      {!isInspecting ? <><g className="aim-guides" aria-hidden="true" clipPath="url(#trajectory-plot-clip)">
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
      <g
        className="launcher-object"
        transform={`translate(${originX - 7} ${originY - 7})`}
        role="img"
        aria-label={`발사 지점 높이 ${flight.settings.startHeight.toFixed(0)}미터`}
      >
        <g transform={`rotate(${launcherRotation})`}>
          <rect x="-16" y="-11" width="31" height="22" rx="5" fill="#b7c1cd" />
          <rect x="-7" y="-5" width="42" height="10" rx="4" fill="#64748b" />
          <circle cx="-14" cy="12" r="9" fill="#4b5563" />
        </g>
      </g>
      <text x={originX + 4} y={groundY + 52} className="ground-text">발사 지점</text></> : null}
      {isFlightActive ? <g clipPath="url(#trajectory-plot-clip)">
        <circle cx={ballX} cy={ballY} r="9" fill="#ffbd56" className="projectile-ball" />
        <circle cx={ballX} cy={ballY} r="3.5" fill="#fff3d2" />
      </g> : null}
      {isFlightActive && showVelocity ? <g className="velocity-vector" clipPath="url(#trajectory-plot-clip)"><line x1={ballX} y1={ballY} x2={ballX + Math.max(-56, Math.min(56, ball.vx * 3.2))} y2={ballY - Math.max(-56, Math.min(56, ball.vy * 3.2))} /><text x={ballX + 14} y={ballY - 16}>속도 벡터</text></g> : null}
      {Math.abs(flight.settings.wind) > 0.1 && <g className="wind-indicator" transform={`translate(${WIDTH - 174} 48)`}><line x1={0} y1={0} x2={flight.settings.wind > 0 ? 62 : -62} y2={0} /><text x={flight.settings.wind > 0 ? 72 : -72} y={5} textAnchor={flight.settings.wind > 0 ? "start" : "end"}>바람 {Math.abs(flight.settings.wind).toFixed(1)} m/s</text></g>}
    </svg>
    {zoom > 1.001 ? (
      <button className="trajectory-reset-view" type="button" onClick={resetView}>
        기본 축척으로
      </button>
    ) : null}
    </div>
  );
}
