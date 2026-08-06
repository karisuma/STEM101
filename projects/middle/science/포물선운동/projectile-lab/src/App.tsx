import { useEffect, useMemo, useRef, useState } from "react";
import ExperimentPlot, {
  type ExperimentAxisKey,
  type PlotMode,
} from "./components/ExperimentPlot";
import TrajectoryCanvas, {
  type RecordedFlight,
} from "./components/TrajectoryCanvas";
import {
  AIR_DENSITY_LEVELS,
  clampLevel,
  createExperimentRecord,
  DEFAULT_ENVIRONMENT,
  DRAG_LEVELS,
  type EnvironmentLevels,
  type ExperimentRecord,
  GRAVITY_LEVELS,
  readExperiments,
  settingsFromLevels,
  WIND_LEVELS,
  writeExperiments,
} from "./experiments";
import {
  DEFAULT_SETTINGS,
  formatNumber,
  simulateFlight,
  type Flight,
  type LaunchSettings,
} from "./simulation/model";

type EnvironmentKey = keyof EnvironmentLevels;

type LevelControlProps = {
  label: string;
  level: number;
  values: readonly { value: number; label: string }[];
  unit: string;
  onChange: (value: number) => void;
};

function LevelControl({
  label,
  level,
  values,
  unit,
  onChange,
}: LevelControlProps) {
  const current = values[level];
  return (
    <label className="level-control">
      <span className="level-control__heading">
        <span>{label}</span>
        <strong>{level}단계</strong>
      </span>
      <input
        type="range"
        min="0"
        max="5"
        step="1"
        value={level}
        aria-valuetext={`${level}단계, ${current.label}, ${current.value} ${unit}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="level-control__readout">
        <span>{current.label}</span>
        <b>{current.value.toLocaleString("ko-KR")} {unit}</b>
      </span>
      <span className="level-control__ticks" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((tick) => <i key={tick}>{tick}</i>)}
      </span>
    </label>
  );
}

function downloadExperimentCsv(records: ExperimentRecord[]) {
  const header = [
    "실험시각", "발사각도_deg", "초기속력_mps", "발사높이_m",
    "중력단계", "중력가속도_mps2", "바람단계", "풍속_mps",
    "공기저항단계", "저항계수", "공기밀도단계", "공기밀도_kgm3",
    "비행거리_m", "최대높이_m", "비행시간_s", "착지속력_mps",
  ];
  const rows = records.map((record) => [
    record.createdAt, record.angle, record.speed, record.startHeight,
    record.gravityLevel, record.gravity, record.windLevel, record.wind,
    record.dragLevel, record.drag, record.airDensityLevel, record.airDensity,
    record.distance, record.peakHeight, record.duration, record.impactSpeed,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `projectile-experiments-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [environment, setEnvironment] = useState<EnvironmentLevels>(DEFAULT_ENVIRONMENT);
  const [settings, setSettings] = useState<LaunchSettings>(() =>
    settingsFromLevels(DEFAULT_SETTINGS, DEFAULT_ENVIRONMENT),
  );
  const [experiments, setExperiments] = useState<ExperimentRecord[]>(readExperiments);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [progress, setProgress] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [showVelocity, setShowVelocity] = useState(true);
  const [plotMode, setPlotMode] = useState<PlotMode>("2d");
  const [xAxis, setXAxis] = useState<ExperimentAxisKey>("angle");
  const [yAxis, setYAxis] = useState<ExperimentAxisKey>("distance");
  const [zAxis, setZAxis] = useState<ExperimentAxisKey>("speed");
  const [message, setMessage] = useState(
    "발사점에서 원하는 곳까지 드래그해 방향과 세기를 정하세요.",
  );
  const animationStart = useRef<number | null>(null);
  const progressRef = useRef(1);
  const activeExperiment = useRef<{
    id: string;
    flight: Flight;
    environment: EnvironmentLevels;
  } | null>(null);
  const pendingAim = useRef<{ angle: number; speed: number } | null>(null);
  const aimFrame = useRef<number | null>(null);
  const flight = useMemo(() => simulateFlight(settings), [settings]);

  useEffect(() => {
    writeExperiments(experiments);
    if (!selectedExperimentId && experiments.length > 0) {
      setSelectedExperimentId(experiments.at(-1)?.id ?? null);
    }
  }, [experiments, selectedExperimentId]);

  useEffect(() => {
    if (!isRunning) return;
    let frame = 0;
    const animate = (now: number) => {
      if (animationStart.current === null) {
        animationStart.current = now - progressRef.current * 1_650;
      }
      const next = Math.min(1, (now - animationStart.current) / 1_650);
      progressRef.current = next;
      setProgress(next);
      if (next < 1) {
        frame = requestAnimationFrame(animate);
        return;
      }

      const completed = activeExperiment.current;
      if (completed) {
        const record = createExperimentRecord(
          completed.flight,
          completed.environment,
          completed.id,
        );
        setExperiments((current) => [...current, record]);
        setSelectedExperimentId(record.id);
        activeExperiment.current = null;
      }
      setIsRunning(false);
      animationStart.current = null;
      setMessage("착지 결과를 자동 저장했습니다. 조건을 바꿔 다음 실험을 이어가세요.");
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isRunning]);

  useEffect(() => () => {
    if (aimFrame.current !== null) cancelAnimationFrame(aimFrame.current);
  }, []);

  const stopCurrentFlight = () => {
    setProgress(1);
    progressRef.current = 1;
    setIsRunning(false);
    animationStart.current = null;
    activeExperiment.current = null;
  };

  const updateAim = (angle: number, speed: number) => {
    pendingAim.current = { angle, speed };
    if (aimFrame.current !== null) return;
    aimFrame.current = requestAnimationFrame(() => {
      const next = pendingAim.current;
      aimFrame.current = null;
      if (!next) return;
      setSettings((current) => ({ ...current, ...next }));
      stopCurrentFlight();
      setMessage("벡터가 바뀌었습니다. 화살표의 방향은 각도, 길이는 초기 속력입니다.");
    });
  };

  const updateEnvironment = (key: EnvironmentKey, rawLevel: number) => {
    const next = { ...environment, [key]: clampLevel(rawLevel) };
    setEnvironment(next);
    setSettings((current) => settingsFromLevels(current, next));
    stopCurrentFlight();
    setMessage("환경 조건이 바뀌었습니다. 같은 발사 벡터로 결과를 비교해 보세요.");
  };

  const updateStartHeight = (height: number) => {
    setSettings((current) => ({ ...current, startHeight: height }));
    stopCurrentFlight();
    setMessage("발사 높이가 바뀌었습니다. 다른 조건은 그대로 두고 결과를 비교해 보세요.");
  };

  const launch = () => {
    if (isRunning) return;
    if (progress < 1 && activeExperiment.current) {
      animationStart.current = null;
      setIsRunning(true);
      setMessage("멈춘 지점부터 실험을 계속합니다.");
      return;
    }

    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${experiments.length}`;
    activeExperiment.current = {
      id,
      flight,
      environment: { ...environment },
    };
    setProgress(0);
    progressRef.current = 0;
    animationStart.current = null;
    setIsRunning(true);
    setMessage("발사 중입니다. 착지하면 입력 조건과 결과가 자동 기록됩니다.");
  };

  const resetConditions = () => {
    setEnvironment(DEFAULT_ENVIRONMENT);
    setSettings(settingsFromLevels(DEFAULT_SETTINGS, DEFAULT_ENVIRONMENT));
    stopCurrentFlight();
    setMessage("조건만 초기화했습니다. 이전 실험 기록은 그대로 유지됩니다.");
  };

  const recentTrajectories = useMemo<RecordedFlight[]>(() => {
    const recent = experiments.slice(-4);
    const selected = experiments.find((record) => record.id === selectedExperimentId);
    const source = selected && !recent.some((record) => record.id === selected.id)
      ? [selected, ...recent.slice(-3)]
      : recent;
    return source.map((record, index) => ({
      id: record.id,
      label: `${record.angle}° · ${record.speed.toFixed(1)} m/s`,
      color: index === source.length - 1 ? "#73e9ef" : "#91a8b6",
      flight: simulateFlight(record.settings),
      visible: true,
    }));
  }, [experiments, selectedExperimentId]);

  const currentPoint = flight.trajectory[Math.round((flight.trajectory.length - 1) * progress)];
  const dragActive = environment.drag > 0 && environment.airDensity > 0;

  const changeAxis = (axis: "x" | "y" | "z", key: ExperimentAxisKey) => {
    if (axis === "x") setXAxis(key);
    else if (axis === "y") setYAxis(key);
    else setZAxis(key);
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="../../../../index.html" aria-label="STEM101 프로젝트 목록으로 이동">STEM101</a>
        <div className="title-group">
          <h1>포물선 운동 실험실</h1>
          <span>벡터를 그리고, 조건을 바꾸고, 데이터로 관계를 찾아보세요.</span>
        </div>
        <div className="header-actions">
          <button className="header-reset" type="button" onClick={resetConditions}>조건 초기화</button>
        </div>
      </header>

      <section className="workspace">
        <section className="simulation-panel" aria-label="포물선 운동 시뮬레이션">
          <div className="canvas-toolbar">
            <div className="aim-readout">
              <span>발사 벡터</span>
              <strong>{settings.angle}°</strong>
              <strong>{settings.speed.toFixed(1)} m/s</strong>
            </div>
            <span className="canvas-instruction">발사점에서 클릭·터치한 뒤 드래그</span>
            <label className="vector-toggle">
              <input type="checkbox" checked={showVelocity} onChange={(event) => setShowVelocity(event.target.checked)} />
              속도 벡터
            </label>
          </div>
          <div className="canvas-frame">
            <TrajectoryCanvas
              flight={flight}
              recordedFlights={recentTrajectories}
              progress={progress}
              showVelocity={showVelocity}
              onAimChange={updateAim}
            />
          </div>
          <div className="launch-bar">
            <button className="launch-action" type="button" onClick={launch}>
              {isRunning ? "비행 중…" : progress < 1 ? "계속하기" : "발사하기"}
            </button>
            <button className="secondary-action" type="button" onClick={() => {
              setIsRunning(false);
              animationStart.current = null;
              setMessage("일시정지했습니다. 계속하기를 누르면 같은 실험이 이어집니다.");
            }}>일시정지</button>
            <button className="secondary-action" type="button" onClick={() => {
              stopCurrentFlight();
              setMessage("발사 전 상태로 돌아왔습니다.");
            }}>발사 취소</button>
            <p role="status">{message}</p>
          </div>
        </section>

        <aside className="control-rail" aria-label="실험 조건과 현재 결과">
          <section className="condition-summary">
            <h2>실험 조건</h2>
            <p>환경은 0–5 단계로, 발사 방향과 세기는 장면에서 직접 조절합니다.</p>
          </section>

          <label className="height-control">
            <span>발사 높이 <strong>{settings.startHeight.toFixed(1)} m</strong></span>
            <input type="range" min="0" max="5" step="0.5" value={settings.startHeight} onChange={(event) => updateStartHeight(Number(event.target.value))} />
          </label>

          <LevelControl label="중력 세기" level={environment.gravity} values={GRAVITY_LEVELS} unit="m/s²" onChange={(value) => updateEnvironment("gravity", value)} />
          <LevelControl label="바람 세기" level={environment.wind} values={WIND_LEVELS} unit="m/s" onChange={(value) => updateEnvironment("wind", value)} />
          <LevelControl label="공기 저항" level={environment.drag} values={DRAG_LEVELS} unit="k" onChange={(value) => updateEnvironment("drag", value)} />
          <LevelControl label="공기 밀도" level={environment.airDensity} values={AIR_DENSITY_LEVELS} unit="kg/m³" onChange={(value) => updateEnvironment("airDensity", value)} />

          <p className="physics-link-note">
            {!dragActive
              ? "공기저항 또는 공기밀도가 0이면 바람의 영향도 나타나지 않습니다."
              : "바람과 공기밀도는 공기저항을 통해 궤적에 함께 작용합니다."}
          </p>

          <section className="live-metrics">
            <h2>현재 계산</h2>
            <div><span>비행 거리</span><strong>{formatNumber(flight.distance)} m</strong></div>
            <div><span>최대 높이</span><strong>{formatNumber(flight.peakHeight)} m</strong></div>
            <div><span>비행 시간</span><strong>{formatNumber(flight.duration, 2)} s</strong></div>
            <div><span>현재 속력</span><strong>{formatNumber(currentPoint?.speed ?? 0)} m/s</strong></div>
          </section>
        </aside>
      </section>

      <section className="experiment-lab" aria-label="누적 실험 데이터 탐색">
        <div className="experiment-lab__heading">
          <div>
            <h2>실험 데이터 탐색</h2>
            <p>입력값과 결과값을 축에 놓고, 점들이 만드는 관계를 관찰하세요.</p>
          </div>
          <div className="experiment-lab__tools">
            <strong>저장된 실험 {experiments.length}회</strong>
            <button type="button" disabled={experiments.length === 0} onClick={() => downloadExperimentCsv(experiments)}>CSV 저장</button>
            <button type="button" disabled={experiments.length === 0} onClick={() => {
              if (!window.confirm("저장된 모든 실험 기록을 지울까요? 이 작업은 되돌릴 수 없습니다.")) return;
              setExperiments([]);
              setSelectedExperimentId(null);
              setMessage("저장된 실험 기록을 모두 지웠습니다.");
            }}>전체 기록 지우기</button>
          </div>
        </div>

        <ExperimentPlot
          records={experiments}
          mode={plotMode}
          xAxis={xAxis}
          yAxis={yAxis}
          zAxis={zAxis}
          onModeChange={setPlotMode}
          onAxisChange={changeAxis}
          selectedId={selectedExperimentId}
          onSelect={setSelectedExperimentId}
        />

        <details className="record-table-wrap">
          <summary>전체 실험 기록 표 보기</summary>
          <div className="record-table-scroll">
            <table className="record-table">
              <thead><tr><th>실험</th><th>각도</th><th>속력</th><th>높이</th><th>중력</th><th>바람</th><th>저항</th><th>밀도</th><th>거리</th><th>최대 높이</th><th>시간</th></tr></thead>
              <tbody>
                {[...experiments].reverse().map((record, reverseIndex) => (
                  <tr key={record.id} className={selectedExperimentId === record.id ? "is-selected" : ""}>
                    <th><button type="button" onClick={() => setSelectedExperimentId(record.id)}>#{experiments.length - reverseIndex}</button></th>
                    <td>{record.angle}°</td><td>{record.speed.toFixed(1)}</td><td>{record.startHeight.toFixed(1)}</td>
                    <td>{record.gravityLevel}</td><td>{record.windLevel}</td><td>{record.dragLevel}</td><td>{record.airDensityLevel}</td>
                    <td>{formatNumber(record.distance)}</td><td>{formatNumber(record.peakHeight)}</td><td>{formatNumber(record.duration, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <footer className="model-note">
        공기 저항은 속도의 제곱과 공기밀도에 비례하는 단순 모형입니다. 실제 공의 회전, 모양, 난류와 고도별 밀도 변화는 포함하지 않습니다.
      </footer>
    </main>
  );
}
