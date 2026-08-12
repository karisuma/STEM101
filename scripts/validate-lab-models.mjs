import { motionLab, energyLab, circuitLab, gravityLab, thermalLab, opticsLab, gasLab } from "../shared/topics/physics-labs.js";
import { atomLab, acidBaseLab, reactionLab } from "../shared/topics/chemistry-labs.js";
import { ecologyLab, moonLab, geneticsLab, seasonsLab } from "../shared/topics/life-earth-labs.js";
import { probabilityLab, functionLab } from "../shared/topics/math-labs.js";

const labs = [motionLab, energyLab, circuitLab, gravityLab, thermalLab, opticsLab, gasLab, atomLab, acidBaseLab, reactionLab, ecologyLab, moonLab, geneticsLab, seasonsLab, probabilityLab, functionLab];
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function near(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: 기대 ${expected}, 실제 ${actual}`);
}

for (const lab of labs) {
  const values = Object.fromEntries(lab.variables.map((item) => [item.key, item.default]));
  let result;
  try {
    result = lab.compute(values, lab.duration || 10, lab.views[0].id, "H2", null);
  } catch (error) {
    errors.push(`${lab.id}: 기본 계산 실패 — ${error.message}`);
    continue;
  }
  for (const output of lab.outputs) {
    const value = result[output.key];
    if (typeof value === "number") assert(Number.isFinite(value), `${lab.id}.${output.key}: 기본 출력이 유한수가 아닙니다.`);
    else assert(value !== undefined, `${lab.id}.${output.key}: 기본 출력이 없습니다.`);
  }
  for (const variable of lab.variables.filter((item) => !item.options)) {
    for (const edge of [variable.min, variable.max]) {
      const edgeValues = { ...values, [variable.key]: edge };
      try {
        const edgeResult = lab.compute(edgeValues, lab.duration || 10, lab.views[0].id, "H2", null);
        for (const output of lab.outputs) if (typeof edgeResult[output.key] === "number") assert(Number.isFinite(edgeResult[output.key]), `${lab.id}.${output.key}: ${variable.key}=${edge}에서 유한수가 아닙니다.`);
      } catch (error) {
        errors.push(`${lab.id}: ${variable.key}=${edge} 경계 계산 실패 — ${error.message}`);
      }
    }
  }
}

const motion = motionLab.compute({ speed: 20, angle: 45, height: 0, gravity: "9.81", drag: 0 }, 10, "trajectory", "H2");
near(motion.range, 400 / 9.81, 0.05, "포물선 45° 도달거리");

const energy = energyLab.compute({ mass: 10, height: 2, angle: 30, friction: 0, supports: 4, efficiency: 100 }, 10, "pulley", "H2");
near(energy.useful, 196.2, 0.01, "위치에너지 mgh"); near(energy.inputForce, 24.525, 0.01, "이상 도르래 입력힘");

const series = circuitLab.compute({ voltage: 12, r1: 10, r2: 20, topology: "series", internal: 0, switchOn: "on" }, 0, "circuit", "H2");
const parallel = circuitLab.compute({ voltage: 12, r1: 10, r2: 20, topology: "parallel", internal: 0, switchOn: "on" }, 0, "circuit", "H2");
near(series.totalCurrent, 0.4, 1e-9, "직렬 전류"); near(parallel.totalCurrent, 1.8, 1e-9, "병렬 전류");

const orbit = gravityLab.compute({ body: "earth", altitude: 400, speedFactor: 1, mass: 500, direction: 0 }, 0, "orbit", "H2");
assert(orbit.specificEnergy < 0, "원궤도 총에너지는 음수여야 합니다."); near(orbit.escapeSpeed / orbit.speed, Math.SQRT2, 0.002, "탈출/원궤도 속력비");

const thermal = thermalLab.compute({ hotTemp: 60, coldTemp: 60, hotMass: 100, coldMass: 500, hotMaterial: "copper", coldMaterial: "water", conductance: 20, ambientLoss: 0 }, 20);
near(thermal.equilibrium, 60, 1e-9, "같은 초기온도의 평형");

const optics = opticsLab.compute({ focal: 12, objectDistance: 28, objectHeight: 6, wavelength: 540, slitGap: 0.18, screenDistance: 2 });
near(optics.imageDistance, 21, 1e-9, "얇은 렌즈 상거리");

const gas = gasLab.compute({ temperature: 300, volume: 8, amount: 0.4, molarMass: "0.028", realGas: 0 });
near(gas.pressure, 0.4 * 8.314 * 300 / 0.008 / 1000, 1e-9, "이상기체 압력");

const ion = atomLab.compute({ atomicNumber: 11, massNumber: 23, charge: 1, transition: "3-2", field: 0 }, 0, "shells");
assert(ion.element.symbol === "Na" && ion.electrons === 10 && ion.netCharge === 1, "Na⁺ 입자 장부가 맞지 않습니다.");

const neutral = acidBaseLab.compute({ acidVolume: 50, acidConcentration: 0.1, acidType: "strong", baseVolume: 50, baseConcentration: 0.1, indicator: "btb" });
near(neutral.pH, 7, 1e-9, "강산-강염기 당량점 pH");

const reaction = reactionLab.compute({ nitrogen: 2, hydrogen: 6, temperature: 650, catalyst: "on", closed: "closed", activation: 75 }, 100, "particles");
near(reaction.maxProduct, 4, 1e-9, "암모니아 반응비 최대 생성량"); near(reaction.leftover, 0, 1e-9, "정확한 반응비 잔량");

const newMoon = moonLab.compute({ age: 0, latitude: 37, inclination: 5.1, nodeOffset: 0, distance: 384 });
const fullMoon = moonLab.compute({ age: 14.75, latitude: 37, inclination: 5.1, nodeOffset: 0, distance: 384 });
near(newMoon.illumination, 0, 1e-9, "삭 밝은 비율"); near(fullMoon.illumination, 100, 1e-9, "보름 밝은 비율");

const genetics = geneticsLab.compute({ parent1: "Aa", parent2: "Aa", inheritance: "dominant", offspring: 400, seed: 17, mutation: 0 }, 0, "punnett");
near(genetics.recessiveProbability, 25, 1e-9, "Aa×Aa 열성 확률"); near(genetics.heterozygous, 50, 1e-9, "Aa×Aa 이형접합 확률");

const northSummer = seasonsLab.compute({ day: 172, latitude: 37, tilt: 23.5, eccentricity: 0.0167, albedo: 30 });
const southSummer = seasonsLab.compute({ day: 172, latitude: -37, tilt: 23.5, eccentricity: 0.0167, albedo: 30 });
assert(northSummer.noonAltitude > southSummer.noonAltitude && northSummer.dayLength > southSummer.dayLength, "하지 두 반구의 태양고도·낮 길이 순서가 맞지 않습니다.");

const probabilityA = probabilityLab.compute({ scenario: "coin", probability: 50, sampleSize: 100, repetitions: 100, seed: 42, confidence: "0.95" });
const probabilityB = probabilityLab.compute({ scenario: "coin", probability: 50, sampleSize: 100, repetitions: 100, seed: 42, confidence: "0.95" });
assert(probabilityA.successes === probabilityB.successes && probabilityA.observed === probabilityB.observed, "같은 난수 시드의 표본이 재현되지 않습니다.");

const quadratic = functionLab.compute({ family: "quadratic", a: 1, b: 2, h: 0, k: 0, probeX: 2 }, 0, "graph", "H2", null);
near(quadratic.y, 4, 1e-9, "이차함수 값"); near(quadratic.slope, 4, 0.001, "이차함수 수치미분");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${labs.length}개 실험실 계산 모형과 핵심 불변식 검사를 통과했습니다.`);
}
