import { useMemo } from "react";
import {
  formatHour,
  getExtrema,
  type Sample,
} from "../simulation/model";

type DayTimelineProps = {
  samples: Sample[];
  currentHour: number;
};

const WIDTH = 1000;
const HEIGHT = 250;
const LEFT = 52;
const RIGHT = 22;
const TOP = 22;
const BOTTOM = 42;
const MAX_HOUR = 26;
const MIN_TIDE = -0.58;
const MAX_TIDE = 1.08;

const xForHour = (hour: number) =>
  LEFT + (hour / MAX_HOUR) * (WIDTH - LEFT - RIGHT);

const yForTide = (tide: number) =>
  TOP +
  ((MAX_TIDE - tide) / (MAX_TIDE - MIN_TIDE)) *
    (HEIGHT - TOP - BOTTOM);

export default function DayTimeline({
  samples,
  currentHour,
}: DayTimelineProps) {
  const path = useMemo(
    () =>
      samples
        .map(
          (sample, index) =>
            `${index === 0 ? "M" : "L"} ${xForHour(sample.hour).toFixed(2)} ${yForTide(sample.tide).toFixed(2)}`,
        )
        .join(" "),
    [samples],
  );
  const areaPath = useMemo(
    () =>
      `${path} L ${xForHour(samples.at(-1)?.hour ?? MAX_HOUR).toFixed(2)} ${(
        HEIGHT - BOTTOM
      ).toFixed(2)} L ${xForHour(samples[0]?.hour ?? 0).toFixed(2)} ${(
        HEIGHT - BOTTOM
      ).toFixed(2)} Z`,
    [path, samples],
  );
  const extrema = useMemo(() => getExtrema(samples), [samples]);
  const currentX = xForHour(currentHour);

  return (
    <div className="timeline-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="24시간 상대 조석 수위와 낮밤 변화 그래프"
      >
        <rect
          x={LEFT}
          y={TOP}
          width={WIDTH - LEFT - RIGHT}
          height={HEIGHT - TOP - BOTTOM}
          className="chart-night"
        />

        {samples.slice(0, -1).map((sample, index) =>
          sample.daylight > 0 ? (
            <rect
              key={sample.hour}
              x={xForHour(sample.hour)}
              y={TOP}
              width={xForHour(samples[index + 1].hour) - xForHour(sample.hour)}
              height={HEIGHT - TOP - BOTTOM}
              className="chart-day"
            />
          ) : null,
        )}

        <rect
          x={xForHour(24)}
          y={TOP}
          width={xForHour(26) - xForHour(24)}
          height={HEIGHT - TOP - BOTTOM}
          className="chart-next-day"
        />

        {[0, 0.5, 1].map((ratio) => {
          const y = TOP + ratio * (HEIGHT - TOP - BOTTOM);
          return (
            <line
              key={ratio}
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y}
              y2={y}
              className="chart-grid"
            />
          );
        })}

        <path d={areaPath} className="tide-area" />
        <path d={path} className="tide-line" />

        {extrema.map((sample) => {
          const isHigh =
            sample.tide >
            (samples.find(
              (candidate) => candidate.hour === sample.hour - 0.25,
            )?.tide ?? sample.tide);
          return (
            <g key={`${sample.hour}-${sample.tide}`}>
              <circle
                cx={xForHour(sample.hour)}
                cy={yForTide(sample.tide)}
                r={5}
                className={isHigh ? "high-dot" : "low-dot"}
              />
              <text
                x={xForHour(sample.hour)}
                y={yForTide(sample.tide) + (isHigh ? -13 : 20)}
                textAnchor="middle"
                className="chart-label"
              >
                {isHigh ? "만조" : "간조"} {formatHour(sample.hour)}
              </text>
            </g>
          );
        })}

        <line
          x1={currentX}
          x2={currentX}
          y1={TOP}
          y2={HEIGHT - BOTTOM}
          className="current-line"
        />
        <circle
          cx={currentX}
          cy={
            yForTide(
              samples.reduce((closest, sample) =>
                Math.abs(sample.hour - currentHour) <
                Math.abs(closest.hour - currentHour)
                  ? sample
                  : closest,
              ).tide,
            )
          }
          r={7}
          className="current-dot"
        />

        {[0, 3, 6, 9, 12, 15, 18, 21, 24, 26].map((hour) => (
          <g key={hour}>
            <line
              x1={xForHour(hour)}
              x2={xForHour(hour)}
              y1={HEIGHT - BOTTOM}
              y2={HEIGHT - BOTTOM + 6}
              className="axis-tick"
            />
            <text
              x={xForHour(hour)}
              y={HEIGHT - 15}
              textAnchor="middle"
              className="axis-label"
            >
              {hour === 26 ? "+2h" : String(hour).padStart(2, "0")}
            </text>
          </g>
        ))}

        <text x={8} y={TOP + 8} className="axis-note">
          높음
        </text>
        <text x={8} y={HEIGHT - BOTTOM} className="axis-note">
          낮음
        </text>
      </svg>

      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-day" /> 낮</span>
        <span><i className="legend-night" /> 밤</span>
        <span><i className="legend-next" /> 다음 날 미리보기</span>
      </div>
    </div>
  );
}
