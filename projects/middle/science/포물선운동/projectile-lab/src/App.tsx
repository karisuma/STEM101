import { useEffect, useMemo, useRef, useState } from "react";
import TelemetryChart, { type GraphMode } from "./components/TelemetryChart";
import TrajectoryCanvas, { type RecordedFlight } from "./components/TrajectoryCanvas";
import { DEFAULT_SETTINGS, formatNumber, GRAVITY_PRESETS, simulateFlight, type LaunchSettings } from "./simulation/model";

const RECORD_COLORS = ["#b581ff", "#f5c84a", "#ff7f6b", "#74d7ff", "#8de0ac", "#f493d0"];

export default function App() {
  const [settings, setSettings] = useState<LaunchSettings>(DEFAULT_SETTINGS);
  const [recordedFlights, setRecordedFlights] = useState<RecordedFlight[]>([]);
  const [progress, setProgress] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [showVelocity, setShowVelocity] = useState(true);
  const [graphMode, setGraphMode] = useState<GraphMode>("range");
  const [message, setMessage] = useState("조건을 바꾸고 발사하세요. 궤적을 기록하면 여러 실험을 겹쳐 볼 수 있어요.");
  const animationStart = useRef<number | null>(null);
  const progressRef = useRef(1);
  const flight = useMemo(() => simulateFlight(settings), [settings]);

  useEffect(() => {
    if (!isRunning) return;
    let frame = 0;
    const animate = (now: number) => {
      if (animationStart.current === null) animationStart.current = now - progressRef.current * 1_650;
      const next = Math.min(1, (now - animationStart.current) / 1_650);
      progressRef.current = next;
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(animate);
      else {
        setIsRunning(false);
        animationStart.current = null;
        setMessage("착지했어요. 현재 결과를 기록하거나 조건을 바꿔 다음 발사를 해 보세요.");
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isRunning]);

  const updateSetting = <K extends keyof LaunchSettings>(key: K, value: LaunchSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setProgress(1);
    progressRef.current = 1;
    setIsRunning(false);
    animationStart.current = null;
  };

  const launch = () => {
    if (isRunning) return;
    setProgress(0);
    progressRef.current = 0;
    animationStart.current = null;
    setIsRunning(true);
    setMessage("발사 중입니다. 속도 벡터와 궤적의 변화를 관찰해 보세요.");
  };

  const saveFlight = (nextSettings = settings, label?: string) => {
    const nextFlight = simulateFlight(nextSettings);
    setRecordedFlights((current) => [
      ...current.slice(-5),
      {
        id: `${Date.now()}-${current.length}`,
        label: label ?? `${nextSettings.angle}° · ${nextSettings.speed} m/s`,
        color: RECORD_COLORS[current.length % RECORD_COLORS.length],
        flight: nextFlight,
        visible: true,
      },
    ]);
    setProgress(1);
    progressRef.current = 1;
    setMessage("현재 조건을 비교 기록에 남겼어요. 다른 조건과 궤적을 겹쳐 보세요.");
  };

  const loadComparison = (kind: "angles" | "drag" | "gravity") => {
    const variants = kind === "angles"
      ? [30, 45, 60].map((angle) => ({ ...settings, angle }))
      : kind === "drag"
        ? [{ ...settings, airResistance: false, drag: 0 }, { ...settings, airResistance: true, drag: Math.max(settings.drag, 0.045) }]
        : GRAVITY_PRESETS.slice(0, 3).map((preset) => ({ ...settings, gravity: preset.gravity }));
    const labels = kind === "angles"
      ? ["30° 발사", "45° 발사", "60° 발사"]
      : kind === "drag"
        ? ["공기 저항 없음", "공기 저항 적용"]
        : ["달 중력", "화성 중력", "지구 중력"];
    setRecordedFlights(variants.map((variant, index) => ({
      id: `${kind}-${index}`,
      label: labels[index],
      color: RECORD_COLORS[index],
      flight: simulateFlight(variant),
      visible: true,
    })));
    setProgress(1);
    progressRef.current = 1;
    setMessage(kind === "angles" ? "세 발사각의 궤적을 겹쳤어요." : kind === "drag" ? "공기 저항 전후의 궤적을 겹쳤어요." : "행성별 중력의 차이를 같은 조건으로 겹쳤어요.");
  };

  const currentPoint = flight.trajectory[Math.round((flight.trajectory.length - 1) * progress)];

  return <main className="app-shell">
    <header className="site-header">
      <a className="brand" href="../../../../index.html" aria-label="STEM101 프로젝트 목록으로 이동">STEM101</a>
      <div className="title-group"><h1>포물선 운동 시뮬레이션 실험실</h1><span>발사 조건을 바꾸고 움직임을 관찰하세요.</span></div>
      <div className="header-actions"><button className="header-reset" type="button" onClick={() => { setSettings(DEFAULT_SETTINGS); setRecordedFlights([]); setProgress(1); progressRef.current = 1; setIsRunning(false); setMessage("모든 조건과 기록을 초기화했습니다."); }}>새 실험 시작</button></div>
    </header>

    <section className="workspace">
      <aside className="control-rail" aria-label="발사 조건 조절">
        <h2>발사 조건</h2>
        <label className="slider-control"><span>발사 각도 <strong>{settings.angle}°</strong></span><input type="range" min="5" max="85" value={settings.angle} onChange={(event) => updateSetting("angle", Number(event.target.value))} /></label>
        <label className="slider-control"><span>초기 속도 <strong>{settings.speed.toFixed(1)} m/s</strong></span><input type="range" min="5" max="32" step="0.5" value={settings.speed} onChange={(event) => updateSetting("speed", Number(event.target.value))} /></label>
        <label className="slider-control"><span>발사 높이 <strong>{settings.startHeight.toFixed(1)} m</strong></span><input type="range" min="0" max="8" step="0.5" value={settings.startHeight} onChange={(event) => updateSetting("startHeight", Number(event.target.value))} /></label>
        <label className="select-control"><span>중력 환경</span><select value={settings.gravity} onChange={(event) => updateSetting("gravity", Number(event.target.value))}>{GRAVITY_PRESETS.map((preset) => <option key={preset.id} value={preset.gravity}>{preset.label} · {preset.gravity} m/s²</option>)}</select></label>
        <label className="slider-control"><span>바람 <strong>{settings.wind > 0 ? "+" : ""}{settings.wind.toFixed(1)} m/s</strong></span><input type="range" min="-12" max="12" step="0.5" value={settings.wind} onChange={(event) => updateSetting("wind", Number(event.target.value))} /></label>
        <label className="toggle-control"><span>공기 저항</span><input type="checkbox" checked={settings.airResistance} onChange={(event) => updateSetting("airResistance", event.target.checked)} /><i /></label>
        {settings.airResistance ? <label className="slider-control compact"><span>저항 계수 <strong>{settings.drag.toFixed(3)}</strong></span><input type="range" min="0.01" max="0.12" step="0.005" value={settings.drag} onChange={(event) => updateSetting("drag", Number(event.target.value))} /></label> : null}
        <section className="comparison-presets"><h3>비교 장면</h3><button type="button" onClick={() => loadComparison("angles")}>30° · 45° · 60° 겹치기</button><button type="button" onClick={() => loadComparison("drag")}>공기 저항 전후 보기</button><button type="button" onClick={() => loadComparison("gravity")}>행성 중력 비교</button></section>
      </aside>

      <section className="simulation-panel" aria-label="포물선 운동 시뮬레이션">
        <div className="canvas-toolbar"><div className="trajectory-key"><span className="key-current" />현재 발사</div>{recordedFlights.filter((record) => record.visible).map((record) => <div className="trajectory-key record-key" key={record.id}><span style={{ background: record.color }} />{record.label}</div>)}<label className="vector-toggle"><input type="checkbox" checked={showVelocity} onChange={(event) => setShowVelocity(event.target.checked)} />속도 벡터</label></div>
        <div className="canvas-frame"><TrajectoryCanvas flight={flight} recordedFlights={recordedFlights} progress={progress} showVelocity={showVelocity} /></div>
        <div className="launch-bar"><button className="launch-action" type="button" onClick={launch}>{isRunning ? "발사 중…" : progress < 1 ? "계속 보기" : "발사하기"}</button><button className="secondary-action" type="button" onClick={() => { setIsRunning(false); animationStart.current = null; }}>일시정지</button><button className="secondary-action" type="button" onClick={() => { setProgress(0); progressRef.current = 0; animationStart.current = null; setIsRunning(false); }}>처음으로</button><p role="status">{message}</p></div>
        <section className="run-history" aria-label="비교 기록"><div className="history-head"><h2>비교 기록</h2><button type="button" onClick={() => setRecordedFlights([])}>기록 비우기</button></div>{recordedFlights.length === 0 ? <p>현재 발사를 기록한 뒤 조건을 바꾸어 궤적을 겹쳐 보세요.</p> : <div className="run-list">{recordedFlights.map((record) => <label className="run-chip" key={record.id}><input type="checkbox" checked={record.visible} onChange={() => setRecordedFlights((current) => current.map((item) => item.id === record.id ? { ...item, visible: !item.visible } : item))} /><i style={{ background: record.color }} /><span>{record.label}</span><small>{formatNumber(record.flight.distance)} m</small></label>)}</div>}<button className="save-run" type="button" onClick={() => saveFlight()}>현재 조건 기록하기</button></section>
      </section>

      <aside className="data-rail" aria-label="운동 데이터">
        <section className="live-metrics"><h2>현재 값</h2><div><span>도달 거리</span><strong>{formatNumber(flight.distance)} m</strong></div><div><span>최고 높이</span><strong>{formatNumber(flight.peakHeight)} m</strong></div><div><span>비행 시간</span><strong>{formatNumber(flight.duration, 2)} s</strong></div><div><span>현재 속력</span><strong>{formatNumber(currentPoint?.speed ?? 0)} m/s</strong></div></section>
        <div className="graph-tabs" role="group" aria-label="그래프 선택">{(["range", "height", "speed"] as GraphMode[]).map((mode) => <button key={mode} type="button" className={graphMode === mode ? "selected" : ""} onClick={() => setGraphMode(mode)}>{mode === "range" ? "각도·거리" : mode === "height" ? "높이·시간" : "속력·시간"}</button>)}</div>
        <TelemetryChart flight={flight} settings={settings} mode={graphMode} />
        <section className="observation-note"><h2>관찰하기</h2><p>한 번에 하나의 조건을 바꾸고 기록하세요. 같은 시간에 높이, 속도, 착지 위치가 어떻게 달라지는지 궤적과 그래프를 함께 보면 됩니다.</p></section>
      </aside>
    </section>
    <footer className="model-note">공기 저항은 속도의 제곱에 비례하는 간단한 모델로 계산합니다. 실제 공의 회전, 모양, 공기 밀도 변화는 포함하지 않습니다.</footer>
  </main>;
}
