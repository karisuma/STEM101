import assert from "node:assert/strict";
import {
  AU_KM,
  BODIES,
  BODY_BY_ID,
  LIGHT_SPEED_M_S,
  getScale,
  modelLightSpeed,
  modelRows,
  orbitRange,
  scaleInvariantReport,
} from "../projects/middle/science/우주규모비교실험실/data.js";

const closeTo = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
};

const sun22State = { basis: "diameter", referenceId: "sun", modelValueM: 0.22 };
const earth6State = { basis: "diameter", referenceId: "earth", modelValueM: 0.006 };
const sun22 = getScale(sun22State);
const earth6 = getScale(earth6State);
const sunRows = Object.fromEntries(modelRows(sun22).map((body) => [body.id, body]));
const earthRows = Object.fromEntries(modelRows(earth6).map((body) => [body.id, body]));

closeTo(sun22, 1.5811412965358633e-10, 1e-24, "태양 22 cm 축척");
closeTo(sunRows.sun.diameterM, 0.22, 1e-14, "기준 태양 지름");
closeTo(sunRows.earth.diameterM, 0.0020169470346413685, 1e-15, "지구 모형 지름");
closeTo(sunRows.earth.distanceM, 23.653537123760245, 1e-12, "지구 모형 거리");
closeTo(sunRows.moon.distanceM, 0.06077907143883859, 1e-14, "달 모형 거리");
closeTo(sunRows.proxima.distanceM, 6_352_233.886300965, 1e-6, "프록시마 모형 거리");

closeTo(earth6, 4.703568123642883e-10, 1e-24, "지구 6 mm 축척");
closeTo(earthRows.earth.diameterM, 0.006, 1e-14, "기준 지구 지름");
closeTo(earthRows.sun.diameterM, 0.6544544687236707, 1e-13, "태양 모형 지름");
closeTo(earthRows.earth.distanceM, 70.36437759893697, 1e-12, "지구 모형 거리");
closeTo(earth6 / sun22, 2.974793039653049, 1e-14, "두 비유의 축척비");
const predictionReport = scaleInvariantReport({ ...sun22State, predictionExponent: 4 });
closeTo(predictionReport.earthDiameterDistanceRatio, 11_727.396266489493, 1e-9, "지구 지름 단위 거리비");
closeTo(predictionReport.predictionRatio, 10_000, 1e-10, "예측 지수 변환");

assert.equal(BODY_BY_ID.moon.parent, "earth", "달 거리의 부모는 지구여야 한다.");
closeTo(AU_KM * 1_000 / LIGHT_SPEED_M_S, 499.00478383615643, 1e-9, "1 AU 빛 시간");
closeTo(modelLightSpeed(sun22), 0.047401423573379335, 1e-14, "모형 빛 속도");
closeTo(sunRows.earth.distanceM / modelLightSpeed(sun22), sunRows.earth.lightSeconds, 1e-10, "빛 시간 보존");

for (const body of BODIES) {
  closeTo(sunRows[body.id].diameterM / earthRows[body.id].diameterM, sun22 / earth6, 1e-13, `${body.name} 지름비 보존`);
  if (body.distanceKm > 0) {
    closeTo(sunRows[body.id].distanceM / earthRows[body.id].distanceM, sun22 / earth6, 1e-13, `${body.name} 거리비 보존`);
  }
  if (body.eccentricity != null && body.distanceKm > 0) {
    const range = orbitRange(body);
    assert.ok(range.minKm < body.distanceKm && body.distanceKm < range.maxKm, `${body.name} 궤도 범위 순서`);
  }
}

console.log("우주 규모 비교 실험실의 데이터·축척·빛 시간 불변식을 통과했습니다.");
