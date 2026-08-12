import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClassroomServer } from "../server/classroom-server.mjs";

const tempRoot = await mkdtemp(join(tmpdir(), "stem101-classroom-test-"));
const databasePath = resolve(tempRoot, "classroom.sqlite");
const env = {
  STEM101_ADMIN_PASSWORD: "test-admin-password-2026",
  STEM101_ADMIN_CODE: "system-admin",
  STEM101_ALLOWED_ORIGINS: "http://127.0.0.1:4180",
};

const { server, db } = createClassroomServer({ databasePath, env });
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const health = await request("/api/health");
  assert(health.status === 200 && health.payload.ok, "health endpoint 실패");

  const adminLogin = await request("/api/auth/admin", { method: "POST", body: JSON.stringify({ code: "system-admin", password: env.STEM101_ADMIN_PASSWORD }) });
  assert(adminLogin.status === 200 && adminLogin.payload.token, "시스템 관리자 로그인 실패");

  const supervisorCreate = await request("/api/admin/supervisors", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminLogin.payload.token}` },
    body: JSON.stringify({ code: "school-01", password: "teacher-pass-2026", seatLimit: 3 }),
  });
  assert(supervisorCreate.status === 201 && supervisorCreate.payload.supervisor.seatLimit === 3, "감독자 라이선스 생성 실패");

  const supervisorLogin = await request("/api/auth/supervisor", { method: "POST", body: JSON.stringify({ code: "school-01", password: "teacher-pass-2026" }) });
  assert(supervisorLogin.status === 200 && supervisorLogin.payload.token, "감독자 로그인 실패");
  const supervisorHeaders = { Authorization: `Bearer ${supervisorLogin.payload.token}` };

  const classCreate = await request("/api/classes", {
    method: "POST", headers: supervisorHeaders,
    body: JSON.stringify({ code: "1반-과학", prefix: "1반-", seatCount: 3 }),
  });
  assert(classCreate.status === 201 && classCreate.payload.seats.length === 3, "비식별 좌석 생성 실패");
  assert(classCreate.payload.seats.map((seat) => seat.alias).join(",") === "1반-1,1반-2,1반-3", "좌석 별칭 형식 오류");

  const overQuota = await request("/api/classes", {
    method: "POST", headers: supervisorHeaders,
    body: JSON.stringify({ code: "2반-과학", prefix: "2반-", seatCount: 1 }),
  });
  assert(overQuota.status === 409, "좌석 라이선스 한도 초과가 차단되지 않았습니다.");

  const seatOne = classCreate.payload.seats[0];
  const seatTwo = classCreate.payload.seats[1];
  const settingsSave = await request(`/api/classes/${classCreate.payload.classroom.id}/settings`, {
    method: "PUT", headers: supervisorHeaders,
    body: JSON.stringify({ labId: "circuit-lab", mission: "led", depth: "H1", locks: { voltage: true } }),
  });
  assert(settingsSave.status === 200 && settingsSave.payload.settings.locks.voltage, "감독자 수업 설정 저장 실패");
  const studentSession = await request("/api/classroom/session", { headers: { Authorization: `Seat ${seatOne.token}` } });
  assert(studentSession.status === 200 && studentSession.payload.settings.depth === "H1" && studentSession.payload.settings.mission === "led", "학생 수업 설정 동기화 실패");
  const payloadOne = { id: "local-a", values: { probability: 10 }, outputs: { observed: 12 }, metric: 12 };
  const payloadTwo = { id: "local-b", values: { probability: 10 }, outputs: { observed: 8 }, metric: 8 };
  const submitOne = await request("/api/classroom/trials", {
    method: "POST", headers: { Authorization: `Seat ${seatOne.token}` },
    body: JSON.stringify({ labId: "probability-statistics-lab", modelVersion: "1.0.0", mission: "loot", payload: payloadOne }),
  });
  const submitTwo = await request("/api/classroom/trials", {
    method: "POST", headers: { Authorization: `Seat ${seatTwo.token}` },
    body: JSON.stringify({ labId: "probability-statistics-lab", modelVersion: "1.0.0", mission: "loot", payload: payloadTwo }),
  });
  assert(submitOne.status === 201 && submitTwo.status === 201, "학생 표본 제출 실패");

  const classTrials = await request("/api/classroom/trials?labId=probability-statistics-lab", { headers: { Authorization: `Seat ${seatOne.token}` } });
  assert(classTrials.status === 200 && classTrials.payload.trials.length === 2, "학생 학급 표본 조회 실패");
  assert(classTrials.payload.trials.every((trial) => /^1반-[12]$/.test(trial.seat)), "학급 표본에 비식별 좌석 외 정보가 포함되었습니다.");

  const teacherTrials = await request(`/api/classes/${classCreate.payload.classroom.id}/trials?labId=probability-statistics-lab`, { headers: supervisorHeaders });
  assert(teacherTrials.status === 200 && teacherTrials.payload.trials.length === 2, "감독자 학급 표본 조회 실패");

  const columns = Object.fromEntries(["supervisors", "classes", "seats", "trials"].map((table) => [table, db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name)]));
  const forbidden = ["name", "email", "phone", "birthday", "address"];
  assert(Object.values(columns).flat().every((column) => !forbidden.includes(column)), "개인정보 필드가 DB 스키마에 존재합니다.");

  console.log("관리자→감독자 라이선스→비식별 좌석 3개→학생 제출→학급 조회 통합 검사를 통과했습니다.");
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(tempRoot, { recursive: true, force: true });
}
