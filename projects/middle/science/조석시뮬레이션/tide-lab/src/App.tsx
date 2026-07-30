import { useEffect, useMemo, useRef, useState } from "react";
import DayTimeline from "./components/DayTimeline";
import TideScene, {
  type FrameMode,
  type ScaleMode,
} from "./components/TideScene";
import {
  buildDaySamples,
  formatHour,
  getCelestialDirections,
  getDaylight,
  getSample,
  getSunStatus,
  getTideTrend,
  latLonToVector,
  LOCATIONS,
  normalizedPercent,
  type Location,
  type TideOptions,
} from "./simulation/model";

type ViewMode = "earth" | "system";

const currentDate = new Date();
const today = [
  currentDate.getFullYear(),
  String(currentDate.getMonth() + 1).padStart(2, "0"),
  String(currentDate.getDate()).padStart(2, "0"),
].join("-");

const phaseOptions = [
  { label: "삭·망", value: 0, caption: "사리" },
  { label: "중간", value: 0.125, caption: "중간 조차" },
  { label: "상·하현", value: 0.25, caption: "조금" },
];

const speedOptions = [
  { label: "15분/초", value: 0.25 },
  { label: "1시간/초", value: 1 },
  { label: "4시간/초", value: 4 },
];

export default function App() {
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState<Location>(LOCATIONS[0]);
  const [hour, setHour] = useState(5.75);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("earth");
  const [frameMode, setFrameMode] = useState<FrameMode>("geo");
  const [scaleMode, setScaleMode] = useState<ScaleMode>("learning");
  const [exaggeration, setExaggeration] = useState(0.12);
  const [locationMessage, setLocationMessage] = useState("");
  const [tideOptions, setTideOptions] = useState<TideOptions>({
    moonEnabled: true,
    sunEnabled: true,
    moonPhase: 0,
  });
  const lastFrame = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      lastFrame.current = null;
      return;
    }

    let frameId = 0;
    const tick = (time: number) => {
      if (lastFrame.current !== null) {
        const deltaSeconds = Math.min((time - lastFrame.current) / 1000, 0.1);
        setHour((current) => (current + deltaSeconds * speed) % 24);
      }
      lastFrame.current = time;
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, speed]);

  const samples = useMemo(
    () => buildDaySamples(location, date, tideOptions),
    [date, location, tideOptions],
  );
  const current = useMemo(
    () => getSample(hour, location, date, tideOptions),
    [date, hour, location, tideOptions],
  );
  const observer = useMemo(
    () => latLonToVector(location.latitude, location.longitude),
    [location],
  );
  const { sunDirection } = useMemo(
    () =>
      getCelestialDirections(
        hour,
        location,
        date,
        tideOptions.moonPhase,
      ),
    [date, hour, location, tideOptions.moonPhase],
  );
  const daylight = getDaylight(observer, sunDirection);
  const trend = getTideTrend(hour, location, date, tideOptions);
  const phase =
    phaseOptions.find((option) => option.value === tideOptions.moonPhase) ??
    phaseOptions[0];

  const setPresetLocation = (name: string) => {
    const selected = LOCATIONS.find((item) => item.name === name);
    if (selected) {
      setLocation(selected);
      setLocationMessage("");
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("이 브라우저에서는 위치 기능을 지원하지 않습니다.");
      return;
    }
    setLocationMessage("위치를 확인하는 중…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          name: "내 위치",
          latitude: Number(coords.latitude.toFixed(4)),
          longitude: Number(coords.longitude.toFixed(4)),
        });
        setLocationMessage(
          "위치는 이 브라우저에서만 계산에 사용되며 저장하거나 전송하지 않습니다.",
        );
      },
      () => {
        setLocationMessage(
          "위치 권한을 사용할 수 없습니다. 아래 좌표를 직접 입력해 주세요.",
        );
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const updateCoordinate = (
    key: "latitude" | "longitude",
    value: number,
  ) => {
    const limit = key === "latitude" ? 90 : 180;
    if (!Number.isFinite(value)) return;
    setLocation((currentLocation) => ({
      ...currentLocation,
      name: currentLocation.name === "내 위치" ? "내 위치" : "사용자 지정",
      [key]: Math.min(limit, Math.max(-limit, value)),
    }));
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Tide Lab 홈">
          <span className="brand-mark" aria-hidden="true">≈</span>
          <span>TIDE / LAB</span>
        </a>
        <div className="header-copy">
          <span className="eyebrow">지구과학 인터랙티브</span>
          <h1>내 위치에서 바라본 하루의 바다</h1>
        </div>
        <div className="live-badge">
          <span className={playing ? "live-dot is-playing" : "live-dot"} />
          {playing ? "시뮬레이션 중" : "일시정지"}
        </div>
      </header>

      <section className="workspace" id="top">
        <div className="scene-panel">
          <div className="scene-toolbar">
            <div className="segmented" aria-label="관찰 화면">
              <button
                className={viewMode === "earth" ? "active" : ""}
                onClick={() => setViewMode("earth")}
              >
                지구 집중
              </button>
              <button
                className={viewMode === "system" ? "active" : ""}
                onClick={() => setViewMode("system")}
              >
                천체 보기
              </button>
            </div>
            <div
              className="celestial-mode-controls"
              aria-disabled={viewMode === "earth"}
            >
              <div className="celestial-mode">
                <span>관점</span>
                <div className="mode-segmented" aria-label="천체 관점">
                  <button
                    className={frameMode === "geo" ? "active" : ""}
                    onClick={() => setFrameMode("geo")}
                    title="지구를 중심에 둔 관점"
                  >
                    지구 중심
                  </button>
                  <button
                    className={frameMode === "helio" ? "active" : ""}
                    onClick={() => setFrameMode("helio")}
                    title="태양을 중심에 둔 지동설 관점"
                  >
                    태양 중심
                  </button>
                </div>
              </div>
              <div className="celestial-mode">
                <span>스케일</span>
                <div className="mode-segmented" aria-label="천체 스케일">
                  <button
                    className={scaleMode === "learning" ? "active" : ""}
                    onClick={() => setScaleMode("learning")}
                  >
                    학습용
                  </button>
                  <button
                    className={scaleMode === "actual" ? "active" : ""}
                    onClick={() => setScaleMode("actual")}
                  >
                    실제 비율
                  </button>
                </div>
              </div>
            </div>
            <span className="scene-hint">드래그해서 회전 · 휠로 확대</span>
          </div>

          <div className="scene-canvas">
            <TideScene
              hour={hour}
              date={date}
              location={location}
              tideOptions={tideOptions}
              exaggeration={exaggeration}
              viewMode={viewMode}
              frameMode={frameMode}
              scaleMode={scaleMode}
            />
            <div className="scene-overlay scene-location">
              <span className="overlay-label">관측 지점</span>
              <strong>{location.name}</strong>
              <span>
                {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°
              </span>
            </div>
            <div className="scene-overlay scene-scale">
              {scaleMode === "actual"
                ? "실제 비율 · 위치 표식 사용"
                : `조석 변형 ${Math.round(exaggeration * 1000)}× 시각 강조`}
            </div>
            {viewMode === "system" &&
              frameMode === "geo" &&
              scaleMode === "learning" && (
                <div className="scene-overlay orbit-explanation">
                  <strong>
                    태양은 계절에 따라 ±23.4°, 달은 약 ±5.1° 기울어져
                    보여요.
                  </strong>
                  <span>궤도선은 위치를 비교하기 위한 수평 가이드입니다.</span>
                </div>
              )}
            {viewMode === "system" && scaleMode === "actual" && (
              <>
                <div className="scene-overlay actual-distance">
                  {frameMode === "helio"
                    ? "1 AU · 약 1억 5천만 km"
                    : "384,400 km · 지구 약 30개"}
                </div>
                <div className="scene-overlay actual-scale-panel">
                  <div>
                    <small>태양 지름</small>
                    <strong>139만 km</strong>
                    <span>지구의 약 109배</span>
                  </div>
                  <div>
                    <small>지구 지름</small>
                    <strong>12,756 km</strong>
                  </div>
                  <div>
                    <small>달 지름</small>
                    <strong>3,475 km</strong>
                    <span>지구의 약 1/4</span>
                  </div>
                  <div>
                    <small>지구–달 평균 거리</small>
                    <strong>384,400 km</strong>
                    <span>지구 약 30개</span>
                  </div>
                  <p>
                    실제 거리에서는 지구와 달이 점처럼 보여 위치 표식을
                    함께 표시합니다.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="transport">
            <button
              className="play-button"
              onClick={() => setPlaying((currentPlaying) => !currentPlaying)}
              aria-label={playing ? "일시정지" : "재생"}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <div className="time-readout">
              <span>지역 태양시</span>
              <strong>{formatHour(hour)}</strong>
            </div>
            <input
              className="time-slider"
              type="range"
              min="0"
              max="24"
              step="0.01"
              value={hour}
              aria-label="하루 시간"
              onChange={(event) => {
                setHour(Number(event.target.value));
                setPlaying(false);
              }}
            />
            <select
              value={speed}
              aria-label="재생 속도"
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              {speedOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="text-button"
              onClick={() => {
                setHour(0);
                setPlaying(true);
              }}
            >
              하루 다시 보기
            </button>
          </div>
        </div>

        <aside className="control-panel">
          <section className="status-card">
            <div className="status-heading">
              <span className={`day-icon ${getSunStatus(daylight)}`} />
              <div>
                <span className="eyebrow">{getSunStatus(daylight)}</span>
                <h2>{formatHour(hour)}</h2>
              </div>
            </div>
            <div className="water-level">
              <div>
                <span>현재 상대 수위</span>
                <strong>{normalizedPercent(current.tide)}%</strong>
              </div>
              <span className={`trend ${trend === "상승 중" ? "rising" : ""}`}>
                {trend}
              </span>
            </div>
            <div className="level-track">
              <i style={{ width: `${normalizedPercent(current.tide)}%` }} />
            </div>
            <p>
              낮밤은 태양 방향으로, 상대 수위는 달과 태양의 조석
              퍼텐셜을 합성해 계산합니다.
            </p>
          </section>

          <section className="control-section">
            <div className="section-heading">
              <span>01</span>
              <h2>위치와 날짜</h2>
            </div>
            <label className="field">
              <span>관측 위치</span>
              <select
                value={
                  LOCATIONS.some((item) => item.name === location.name)
                    ? location.name
                    : ""
                }
                onChange={(event) => setPresetLocation(event.target.value)}
              >
                <option value="" disabled>사용자 지정 위치</option>
                {LOCATIONS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="location-button" onClick={useCurrentLocation}>
              <span aria-hidden="true">◎</span> 현재 위치 사용
            </button>
            {locationMessage && (
              <p className="location-message" role="status">
                {locationMessage}
              </p>
            )}
            <div className="coordinate-grid">
              <label className="field">
                <span>위도</span>
                <input
                  type="number"
                  min="-90"
                  max="90"
                  step="0.0001"
                  value={location.latitude}
                  onChange={(event) =>
                    updateCoordinate("latitude", Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                <span>경도</span>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="0.0001"
                  value={location.longitude}
                  onChange={(event) =>
                    updateCoordinate("longitude", Number(event.target.value))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>관찰 날짜</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  if (event.target.value) setDate(event.target.value);
                }}
              />
            </label>
          </section>

          <section className="control-section">
            <div className="section-heading">
              <span>02</span>
              <h2>조석 조건</h2>
            </div>
            <div className="toggle-row">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={tideOptions.moonEnabled}
                  onChange={(event) =>
                    setTideOptions((currentOptions) => ({
                      ...currentOptions,
                      moonEnabled: event.target.checked,
                    }))
                  }
                />
                <i />
                달의 영향
              </label>
              <span className="force-value">1.00</span>
            </div>
            <div className="toggle-row">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={tideOptions.sunEnabled}
                  onChange={(event) =>
                    setTideOptions((currentOptions) => ({
                      ...currentOptions,
                      sunEnabled: event.target.checked,
                    }))
                  }
                />
                <i />
                태양의 영향
              </label>
              <span className="force-value">0.46</span>
            </div>

            <div className="field">
              <span>태양–달 배치</span>
              <div className="phase-grid">
                {phaseOptions.map((option) => (
                  <button
                    key={option.value}
                    className={
                      tideOptions.moonPhase === option.value ? "active" : ""
                    }
                    onClick={() =>
                      setTideOptions((currentOptions) => ({
                        ...currentOptions,
                        moonPhase: option.value,
                      }))
                    }
                  >
                    <span>{option.label}</span>
                    <small>{option.caption}</small>
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>
                조석 팽대부 강조
                <strong>{Math.round(exaggeration * 1000)}×</strong>
              </span>
              <input
                type="range"
                min="0.04"
                max="0.2"
                step="0.01"
                value={exaggeration}
                onChange={(event) =>
                  setExaggeration(Number(event.target.value))
                }
              />
            </label>
          </section>
        </aside>
      </section>

      <section className="timeline-section">
        <div className="timeline-heading">
          <div>
            <span className="eyebrow">24시간 관찰 기록</span>
            <h2>{location.name}의 낮밤과 상대 수위</h2>
          </div>
          <div className="finding">
            <span>현재 조건</span>
            <strong>{phase.caption}</strong>
            <p>
              {phase.value === 0
                ? "달과 태양의 효과가 같은 축에서 더해집니다."
                : phase.value === 0.25
                  ? "달과 태양의 효과가 직각 방향으로 분산됩니다."
                  : "사리와 조금 사이의 조차를 관찰합니다."}
            </p>
          </div>
        </div>
        <DayTimeline samples={samples} currentHour={hour} />
        <div className="education-note">
          <span className="note-number">24h 50m</span>
          <p>
            지구가 달에 대해 같은 방향으로 돌아오는 데 걸리는 시간은 태양일보다
            약 50분 깁니다. 그래서 만조 시각은 다음 날 조금씩 늦어집니다.
          </p>
          <span className="model-badge">개념 모델</span>
        </div>
      </section>
    </main>
  );
}
