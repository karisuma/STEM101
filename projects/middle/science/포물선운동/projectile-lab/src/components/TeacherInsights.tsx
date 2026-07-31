import type { MissionId } from "../simulation/model";

type Props = {
  mission: MissionId;
  submitted: boolean;
  prediction: number | null;
  angle: number;
  close: () => void;
};

const baseline = {
  farthest: { prediction: [7, 11, 6], result: [3, 18, 3], total: 24 },
  complementary: { prediction: [9, 10, 5], result: [5, 14, 5], total: 24 },
  target: { prediction: [6, 12, 6], result: [7, 10, 7], total: 24 },
} as const;

const labels = ["30°", "45°", "60°"];

function BarGroup({ title, values, total }: { title: string; values: readonly number[]; total: number }) {
  const max = Math.max(...values, 1);
  return (
    <section className="insight-chart">
      <h3>{title}</h3>
      {values.map((value, index) => (
        <div className="bar-row" key={labels[index]}>
          <span>{labels[index]}</span>
          <i><b style={{ width: `${(value / max) * 100}%` }} /></i>
          <em>{value}팀 ({Math.round((value / total) * 100)}%)</em>
        </div>
      ))}
    </section>
  );
}

export default function TeacherInsights({ mission, submitted, prediction, angle, close }: Props) {
  const data = baseline[mission];
  const predictionValues = [...data.prediction];
  const resultValues = [...data.result];
  const predictionIndex = prediction ? [30, 45, 60].indexOf(prediction) : -1;
  const resultIndex = angle <= 37 ? 0 : angle >= 53 ? 2 : 1;

  if (submitted) {
    if (predictionIndex >= 0) predictionValues[predictionIndex] += 1;
    resultValues[resultIndex] += 1;
  }

  const total = data.total + (submitted ? 1 : 0);
  const missionTitle = mission === "farthest" ? "가장 먼 각도" : mission === "complementary" ? "보완각 비교" : "목표물 맞히기";

  return (
    <section className="teacher-insights" aria-label="교사 인사이트">
      <div className="insight-head">
        <div>
          <span>교사 인사이트 · 익명</span>
          <strong>{missionTitle} · 실시간 학급 요약</strong>
        </div>
        <button type="button" onClick={close}>닫기</button>
      </div>
      <div className="insight-grid">
        <BarGroup title="학생들이 예상한 각도" values={predictionValues} total={total} />
        <BarGroup title={mission === "target" ? "최종 선택 각도" : "실제로 가장 멀리 간 각도"} values={resultValues} total={total} />
      </div>
      <p className="insight-prompt">
        {mission === "farthest"
          ? "45°를 고른 팀이 많은지 확인한 뒤, 30°와 60°의 결과를 비교해 보게 하세요."
          : mission === "complementary"
            ? "높이와 비행 시간은 다른데 거리가 비슷한 이유를 궤적으로 설명하게 하세요."
            : "성공한 팀이 같은 각도를 고르지 않았는지 확인하고, 오차가 생긴 이유를 묻게 하세요."}
      </p>
    </section>
  );
}
