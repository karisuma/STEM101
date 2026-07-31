import { useEffect, useMemo, useRef, useState } from "react";
import TeacherInsights from "./components/TeacherInsights";
import TrajectoryCanvas from "./components/TrajectoryCanvas";
import {
  DEFAULT_SETTINGS,
  formatNumber,
  getMission,
  simulateFlight,
  TARGET_DISTANCE,
  type Flight,
  type MissionId,
} from "./simulation/model";

const predictionOptions = [30, 45, 60];
const missions: MissionId[] = ["farthest", "complementary", "target"];

export default function App() {
  const [mission, setMission] = useState<MissionId>("farthest");
  const [angle, setAngle] = useState(45);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [previousFlight, setPreviousFlight] = useState<Flight | null>(null);
  const [lastFlight, setLastFlight] = useState<Flight | null>(null);
  const [progress, setProgress] = useState(1);
  const [isFlying, setIsFlying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [teacherMode, setTeacherMode] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [message, setMessage] = useState("먼저 결과를 예상하고, 각도를 바꾸어 발사해 보세요.");
  const animationStart = useRef<number | null>(null);

  const flight = useMemo(
    () => simulateFlight({ ...DEFAULT_SETTINGS, angle }),
    [angle],
  );
  const missionInfo = getMission(mission);
  const targetError = Math.abs(flight.distance - TARGET_DISTANCE);

  useEffect(() => {
    if (!isFlying) return;
    let frame = 0;
    const animate = (now: number) => {
      if (!animationStart.current) animationStart.current = now;
      const next = Math.min(1, (now - animationStart.current) / 1100);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(animate);
      else {
        setIsFlying(false);
        animationStart.current = null;
        setMessage(
          mission === "target"
            ? targetError < 0.6
              ? "목표에 아주 가깝게 도착했어요. 이제 제출해 보세요."
              : `목표와 ${formatNumber(targetError)} m 차이예요. 각도를 다시 조절해 볼까요?`
            : "결과가 나왔어요. 이전 실험과 비교해 보고 이유를 설명해 보세요.",
        );
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isFlying, mission, targetError]);

  const switchMission = (nextMission: MissionId) => {
    setMission(nextMission);
    setAngle(nextMission === "complementary" ? 30 : 45);
    setPrediction(null);
    setPreviousFlight(null);
    setLastFlight(null);
    setProgress(1);
    setSubmitted(false);
    setShowInsights(false);
    setMessage(getMission(nextMission).prompt);
  };

  const launch = () => {
    if (isFlying) return;
    if (lastFlight) setPreviousFlight(lastFlight);
    setLastFlight(flight);
    setSubmitted(false);
    setProgress(0);
    setIsFlying(true);
    setMessage("발사 중이에요. 궤적과 수치를 관찰해 보세요.");
  };

  const compareComplementary = () => {
    if (mission !== "complementary") return;
    setPreviousFlight(simulateFlight({ ...DEFAULT_SETTINGS, angle: 90 - angle }));
    setProgress(1);
    setMessage(`${angle}°와 ${90 - angle}°의 궤적을 겹쳐 보세요. 도달 거리는 같은가요?`);
  };

  const submit = () => {
    if (!prediction) {
      setMessage("먼저 30°, 45°, 60° 중 하나를 예상으로 선택해 주세요.");
      return;
    }
    if (progress < 1) {
      setMessage("발사가 끝난 뒤 결과를 확인하고 제출해 주세요.");
      return;
    }
    setSubmitted(true);
    setShowInsights(true);
    setMessage("제출했어요. 교사 인사이트에서 학급의 익명 결과와 비교해 보세요.");
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="../../../../index.html" aria-label="STEM101 프로젝트 목록으로 이동">STEM101</a>
        <div className="title-group">
          <h1>포물선 운동 실험</h1>
          <span>{missionInfo.number} / 3 · {missionInfo.title}</span>
        </div>
        <div className="header-actions">
          <label className="teacher-switch">
            <input type="checkbox" checked={teacherMode} onChange={(event) => { setTeacherMode(event.target.checked); setShowInsights(event.target.checked); }} />
            <span aria-hidden="true" />
            교사용 시연
          </label>
          <button className="help-button" type="button" aria-label="수업 도움말" title="발사각만 바꿔 비교해 보세요.">?</button>
        </div>
      </header>

      <section className="workspace">
        <section className="simulation-panel" aria-label="포물선 운동 시뮬레이션">
          <div className="canvas-toolbar">
            <div className="trajectory-key"><span className="key-current" />현재 실험 ({angle}°)</div>
            {previousFlight && <div className="trajectory-key"><span className="key-previous" />비교 실험</div>}
            <button type="button" className="reset-button" onClick={() => { setAngle(45); setPreviousFlight(null); setLastFlight(null); setProgress(1); setSubmitted(false); setMessage("조건을 초기화했어요. 다시 예상하고 실험해 보세요."); }}>초기화</button>
          </div>
          <div className="canvas-frame">
            <TrajectoryCanvas flight={flight} previousFlight={previousFlight} progress={progress} showTarget={mission === "target"} />
          </div>
          <div className="stepper" aria-label="탐구 진행 단계">
            {[["예상", 1], ["실험", 2], ["비교", 3], ["설명", 4]].map(([label, order]) => {
              const active = submitted ? 4 : isFlying ? 2 : previousFlight ? 3 : prediction ? 2 : 1;
              return <div className={Number(order) <= active ? "step is-active" : "step"} key={String(label)}><b>{order}</b><span>{label}</span></div>;
            })}
          </div>
          <p className="experiment-message" role="status">{message}</p>
          {showInsights && <TeacherInsights mission={mission} submitted={submitted} prediction={prediction} angle={angle} close={() => setShowInsights(false)} />}
        </section>

        <aside className="control-rail" aria-label="실험 조절 패널">
          <nav className="mission-tabs" aria-label="수업 미션">
            {missions.map((item) => (
              <button type="button" key={item} className={item === mission ? "selected" : ""} onClick={() => switchMission(item)}>
                미션 {getMission(item).number}
              </button>
            ))}
          </nav>
          <div className="question-block">
            <h2>{missionInfo.prompt}</h2>
            <p>같은 초기 속도, 같은 중력, 같은 발사·착지 높이에서 비교합니다.</p>
          </div>

          <fieldset className="prediction-field">
            <legend>예상 선택</legend>
            <div className="prediction-options">
              {predictionOptions.map((option) => <button type="button" key={option} className={prediction === option ? "selected" : ""} onClick={() => { setPrediction(option); setMessage(`${option}°를 예상으로 골랐어요. 발사해 확인해 보세요.`); }}>{option}°</button>)}
            </div>
          </fieldset>

          <section className="angle-control">
            <div><span>발사 각도</span><strong>{angle}°</strong></div>
            <input type="range" min="15" max="75" step="1" value={angle} onChange={(event) => { setAngle(Number(event.target.value)); setProgress(1); setSubmitted(false); }} aria-label="발사 각도" />
            <div className="range-ends"><span>15°</span><span>75°</span></div>
          </section>

          <section className="metrics" aria-label="실험 결과">
            <div><span>수평 도달 거리</span><strong>{formatNumber(flight.distance)} m</strong></div>
            <div><span>최고 높이</span><strong>{formatNumber(flight.peakHeight)} m</strong></div>
            <div><span>공중 체류 시간</span><strong>{formatNumber(flight.duration, 2)} s</strong></div>
            {mission === "target" && <div><span>목표와의 차이</span><strong>{formatNumber(targetError)} m</strong></div>}
          </section>

          <div className="control-actions">
            <button className="secondary-action" type="button" onClick={mission === "complementary" ? compareComplementary : () => { setPreviousFlight(flight); setLastFlight(flight); setMessage("현재 궤적을 비교 실험으로 남겼어요. 각도를 바꾸어 다시 발사해 보세요."); }}>
              {mission === "complementary" ? "보완각 궤적 비교" : "현재 실험을 비교 기준으로"}
            </button>
            <button className="launch-action" type="button" onClick={launch} disabled={isFlying}>{isFlying ? "발사 중…" : "발사하기"}</button>
            <button className="submit-action" type="button" onClick={submit}>{missionInfo.action}</button>
          </div>

          <section className="teacher-note">
            <strong>{teacherMode ? "교사용 발문" : "탐구 도움말"}</strong>
            <p>{teacherMode ? "정답을 먼저 말하지 말고, 30°와 60°의 높이·시간·거리를 각각 비교하게 하세요." : "한 번에 한 조건만 바꾸고, 이전 궤적과 차이를 관찰해 보세요."}</p>
          </section>
        </aside>
      </section>

      <footer className="model-note">이 시뮬레이션은 공기 저항을 계산하지 않는 개념 모델입니다. 실제 공의 움직임은 바람·회전·공기 저항에 따라 달라질 수 있습니다.</footer>
    </main>
  );
}
