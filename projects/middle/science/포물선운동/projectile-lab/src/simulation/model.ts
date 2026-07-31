export type MissionId = "farthest" | "complementary" | "target";

export type LaunchSettings = {
  angle: number;
  speed: number;
  gravity: number;
  startHeight: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Flight = {
  duration: number;
  distance: number;
  peakHeight: number;
  trajectory: Point[];
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const DEFAULT_SETTINGS: LaunchSettings = {
  angle: 45,
  speed: 18,
  gravity: 9.8,
  startHeight: 0,
};

export const TARGET_DISTANCE = 25;

export const simulateFlight = (settings: LaunchSettings): Flight => {
  const radians = toRadians(settings.angle);
  const horizontalSpeed = settings.speed * Math.cos(radians);
  const verticalSpeed = settings.speed * Math.sin(radians);
  const discriminant = verticalSpeed ** 2 + 2 * settings.gravity * settings.startHeight;
  const duration = (verticalSpeed + Math.sqrt(discriminant)) / settings.gravity;
  const distance = horizontalSpeed * duration;
  const peakHeight =
    settings.startHeight + verticalSpeed ** 2 / (2 * settings.gravity);
  const samples = 96;
  const trajectory = Array.from({ length: samples + 1 }, (_, index) => {
    const time = (duration * index) / samples;
    return {
      x: horizontalSpeed * time,
      y: Math.max(
        0,
        settings.startHeight + verticalSpeed * time - 0.5 * settings.gravity * time ** 2,
      ),
    };
  });

  return { duration, distance, peakHeight, trajectory };
};

export const positionAt = (flight: Flight, progress: number): Point => {
  const index = Math.min(
    flight.trajectory.length - 1,
    Math.max(0, Math.round(progress * (flight.trajectory.length - 1))),
  );
  return flight.trajectory[index];
};

export const getMission = (mission: MissionId) => {
  if (mission === "complementary") {
    return {
      number: 2,
      title: "쌍을 이루는 각도",
      prompt: "30°와 60°의 궤적은 어떻게 다르고, 도달 거리는 어떨까요?",
      action: "30°와 60° 비교하기",
    };
  }

  if (mission === "target") {
    return {
      number: 3,
      title: "목표물 맞히기",
      prompt: `${TARGET_DISTANCE} m 목표물에 가장 가깝게 착지해 보세요.`,
      action: "목표물 도전 제출",
    };
  }

  return {
    number: 1,
    title: "가장 먼 각도 찾기",
    prompt: "같은 힘으로 공을 던질 때, 어떤 각도에서 가장 멀리 갈까요?",
    action: "미션 1 제출",
  };
};

export const formatNumber = (value: number, digits = 1) =>
  value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
