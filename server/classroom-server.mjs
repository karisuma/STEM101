import { createServer } from "node:http";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const JSON_LIMIT = 1024 * 1024;

function nowIso() {
  return new Date().toISOString();
}

function futureIso(hours = 12) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function passwordRecord(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

function passwordMatches(password, salt, expectedHex) {
  const actual = Buffer.from(passwordRecord(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function opaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function safeCode(value, fallback = "CLASS-01") {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[^가-힣A-Za-z0-9_.-]/g, "")
    .slice(0, 32);
  return cleaned || fallback;
}

function safeAlias(value, fallback = "학생") {
  return safeCode(value, fallback).slice(0, 18);
}

function openDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY,
      login_code TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS supervisors (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      seat_limit INTEGER NOT NULL CHECK(seat_limit > 0),
      active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY,
      supervisor_id INTEGER NOT NULL REFERENCES supervisors(id),
      code TEXT NOT NULL UNIQUE,
      seat_count INTEGER NOT NULL CHECK(seat_count > 0),
      archived INTEGER NOT NULL DEFAULT 0,
      settings_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY,
      class_id INTEGER NOT NULL REFERENCES classes(id),
      alias TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(class_id, alias)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('admin', 'supervisor')),
      owner_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trials (
      id INTEGER PRIMARY KEY,
      class_id INTEGER NOT NULL REFERENCES classes(id),
      seat_id INTEGER NOT NULL REFERENCES seats(id),
      lab_id TEXT NOT NULL,
      model_version TEXT NOT NULL,
      mission TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS trials_class_lab_created ON trials(class_id, lab_id, created_at);
  `);
  return db;
}

function seedAdmin(db, env) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM admins").get().count;
  if (count) return;
  const password = env.STEM101_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("첫 실행에는 12자 이상의 STEM101_ADMIN_PASSWORD 환경 변수가 필요합니다.");
  }
  const loginCode = safeCode(env.STEM101_ADMIN_CODE || "system-admin", "system-admin");
  const record = passwordRecord(password);
  db.prepare("INSERT INTO admins (login_code, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)")
    .run(loginCode, record.hash, record.salt, nowIso());
}

function parseOrigins(env) {
  return new Set(String(env.STEM101_ALLOWED_ORIGINS || [
    "http://127.0.0.1:4173",
    "http://127.0.0.1:4180",
    "http://localhost:4173",
    "http://localhost:4180",
    "https://karisuma.github.io",
  ].join(",")).split(",").map((item) => item.trim()).filter(Boolean));
}

function responseHeaders(origin, allowedOrigins) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS";
  }
  return headers;
}

function send(response, status, payload, headers) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > JSON_LIMIT) throw Object.assign(new Error("요청이 너무 큽니다."), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON 형식이 올바르지 않습니다."), { status: 400 });
  }
}

function sessionFromRequest(db, request, requiredRole) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("감독자 인증이 필요합니다."), { status: 401 });
  const session = db.prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?").get(sha256(match[1]), nowIso());
  if (!session || (requiredRole && session.role !== requiredRole)) throw Object.assign(new Error("인증이 만료되었거나 권한이 없습니다."), { status: 403 });
  return session;
}

function seatFromRequest(db, request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Seat\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("수업 좌석 토큰이 필요합니다."), { status: 401 });
  const seat = db.prepare(`
    SELECT seats.id, seats.alias, seats.class_id, classes.code AS class_code,
           classes.settings_json, supervisors.active AS supervisor_active,
           supervisors.expires_at
    FROM seats
    JOIN classes ON classes.id = seats.class_id
    JOIN supervisors ON supervisors.id = classes.supervisor_id
    WHERE seats.token_hash = ? AND seats.active = 1 AND classes.archived = 0
  `).get(sha256(match[1]));
  if (!seat || !seat.supervisor_active || (seat.expires_at && seat.expires_at <= nowIso())) {
    throw Object.assign(new Error("좌석 계정이 비활성화되었거나 라이선스가 만료되었습니다."), { status: 403 });
  }
  return seat;
}

function issueSession(db, role, ownerId, hours = 12) {
  const token = opaqueToken();
  db.prepare("INSERT INTO sessions (token_hash, role, owner_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(sha256(token), role, ownerId, futureIso(hours), nowIso());
  return token;
}

function publicSupervisor(row) {
  return {
    id: row.id,
    code: row.code,
    seatLimit: row.seat_limit,
    active: Boolean(row.active),
    expiresAt: row.expires_at,
    usedSeats: Number(row.used_seats || 0),
    createdAt: row.created_at,
  };
}

function assertSupervisorOwnsClass(db, supervisorId, classId) {
  const classroom = db.prepare("SELECT * FROM classes WHERE id = ? AND supervisor_id = ?").get(classId, supervisorId);
  if (!classroom) throw Object.assign(new Error("이 감독자가 관리하는 수업이 아닙니다."), { status: 404 });
  return classroom;
}

function createSeats(db, classId, prefix, count) {
  const insert = db.prepare("INSERT INTO seats (class_id, alias, token_hash, created_at) VALUES (?, ?, ?, ?)");
  const seats = [];
  for (let index = 0; index < count; index += 1) {
    const token = opaqueToken(24);
    const alias = `${prefix}${index + 1}`;
    const result = insert.run(classId, alias, sha256(token), nowIso());
    seats.push({ id: Number(result.lastInsertRowid), alias, token });
  }
  return seats;
}

function rateLimiter() {
  const buckets = new Map();
  return (key, limit = 240) => {
    const minute = Math.floor(Date.now() / 60_000);
    const item = buckets.get(key);
    if (!item || item.minute !== minute) {
      buckets.set(key, { minute, count: 1 });
      return true;
    }
    item.count += 1;
    return item.count <= limit;
  };
}

export function createClassroomServer(options = {}) {
  const env = options.env || process.env;
  const databasePath = resolve(options.databasePath || env.STEM101_DB_PATH || "server/data/classroom.sqlite");
  const db = openDatabase(databasePath);
  seedAdmin(db, env);
  const allowedOrigins = parseOrigins(env);
  const allowRequest = rateLimiter();

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    const headers = responseHeaders(origin, allowedOrigins);
    if (origin && !allowedOrigins.has(origin)) return send(response, 403, { error: "허용되지 않은 출처입니다." }, headers);
    if (request.method === "OPTIONS") {
      response.writeHead(204, headers);
      return response.end();
    }
    const ip = request.socket.remoteAddress || "unknown";
    if (!allowRequest(ip)) return send(response, 429, { error: "요청이 너무 많습니다. 잠시 뒤 다시 시도하세요." }, headers);

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (request.method === "GET" && path === "/api/health") {
        return send(response, 200, { ok: true, service: "stem101-classroom", time: nowIso() }, headers);
      }

      if (request.method === "POST" && path === "/api/auth/admin") {
        if (!allowRequest(`auth:${ip}`, 20)) throw Object.assign(new Error("로그인 시도가 너무 많습니다."), { status: 429 });
        const body = await readJson(request);
        const admin = db.prepare("SELECT * FROM admins WHERE login_code = ?").get(safeCode(body.code, ""));
        if (!admin || !passwordMatches(String(body.password || ""), admin.password_salt, admin.password_hash)) throw Object.assign(new Error("관리자 인증 정보가 맞지 않습니다."), { status: 401 });
        return send(response, 200, { token: issueSession(db, "admin", admin.id, 4), role: "admin", expiresInHours: 4 }, headers);
      }

      if (request.method === "POST" && path === "/api/auth/supervisor") {
        if (!allowRequest(`auth:${ip}`, 20)) throw Object.assign(new Error("로그인 시도가 너무 많습니다."), { status: 429 });
        const body = await readJson(request);
        const supervisor = db.prepare("SELECT * FROM supervisors WHERE code = ?").get(safeCode(body.code, ""));
        if (!supervisor || !supervisor.active || (supervisor.expires_at && supervisor.expires_at <= nowIso()) || !passwordMatches(String(body.password || ""), supervisor.password_salt, supervisor.password_hash)) {
          throw Object.assign(new Error("감독자 코드·암호가 맞지 않거나 라이선스가 비활성화되었습니다."), { status: 401 });
        }
        return send(response, 200, { token: issueSession(db, "supervisor", supervisor.id, 12), role: "supervisor", expiresInHours: 12, seatLimit: supervisor.seat_limit }, headers);
      }

      if (request.method === "GET" && path === "/api/admin/supervisors") {
        sessionFromRequest(db, request, "admin");
        const rows = db.prepare(`SELECT supervisors.*, COALESCE(SUM(CASE WHEN classes.archived = 0 THEN classes.seat_count ELSE 0 END), 0) AS used_seats FROM supervisors LEFT JOIN classes ON classes.supervisor_id = supervisors.id GROUP BY supervisors.id ORDER BY supervisors.id DESC`).all();
        return send(response, 200, { supervisors: rows.map(publicSupervisor) }, headers);
      }

      if (request.method === "POST" && path === "/api/admin/supervisors") {
        sessionFromRequest(db, request, "admin");
        const body = await readJson(request);
        const code = safeCode(body.code, "");
        const password = String(body.password || "");
        const seatLimit = clampInteger(body.seatLimit, 1, 5000);
        if (!code || password.length < 10) throw Object.assign(new Error("감독자 코드와 10자 이상의 초기 암호가 필요합니다."), { status: 400 });
        const record = passwordRecord(password);
        const result = db.prepare("INSERT INTO supervisors (code, password_hash, password_salt, seat_limit, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(code, record.hash, record.salt, seatLimit, body.expiresAt || null, nowIso());
        const row = db.prepare("SELECT *, 0 AS used_seats FROM supervisors WHERE id = ?").get(result.lastInsertRowid);
        return send(response, 201, { supervisor: publicSupervisor(row) }, headers);
      }

      const supervisorMatch = path.match(/^\/api\/admin\/supervisors\/(\d+)\/status$/);
      if (request.method === "PUT" && supervisorMatch) {
        sessionFromRequest(db, request, "admin");
        const body = await readJson(request);
        db.prepare("UPDATE supervisors SET active = ? WHERE id = ?").run(body.active ? 1 : 0, Number(supervisorMatch[1]));
        return send(response, 200, { ok: true }, headers);
      }

      if (request.method === "GET" && path === "/api/classes") {
        const session = sessionFromRequest(db, request, "supervisor");
        const supervisor = db.prepare("SELECT * FROM supervisors WHERE id = ?").get(session.owner_id);
        const classes = db.prepare("SELECT id, code, seat_count, archived, settings_json, created_at FROM classes WHERE supervisor_id = ? ORDER BY id DESC").all(session.owner_id)
          .map((row) => ({ id: row.id, code: row.code, seatCount: row.seat_count, archived: Boolean(row.archived), settings: JSON.parse(row.settings_json), createdAt: row.created_at }));
        const usedSeats = classes.filter((item) => !item.archived).reduce((sum, item) => sum + item.seatCount, 0);
        return send(response, 200, { classes, license: { seatLimit: supervisor.seat_limit, usedSeats, remainingSeats: supervisor.seat_limit - usedSeats, expiresAt: supervisor.expires_at } }, headers);
      }

      if (request.method === "POST" && path === "/api/classes") {
        const session = sessionFromRequest(db, request, "supervisor");
        const body = await readJson(request);
        const code = safeCode(body.code, "");
        const prefix = safeAlias(body.prefix, "학생");
        const count = clampInteger(body.seatCount, 1, 200);
        if (!code) throw Object.assign(new Error("수업 코드가 필요합니다."), { status: 400 });
        db.exec("BEGIN IMMEDIATE");
        try {
          const supervisor = db.prepare("SELECT * FROM supervisors WHERE id = ? AND active = 1").get(session.owner_id);
          if (!supervisor || (supervisor.expires_at && supervisor.expires_at <= nowIso())) throw Object.assign(new Error("감독자 라이선스가 만료되었습니다."), { status: 403 });
          const used = db.prepare("SELECT COALESCE(SUM(seat_count), 0) AS used FROM classes WHERE supervisor_id = ? AND archived = 0").get(session.owner_id).used;
          if (used + count > supervisor.seat_limit) throw Object.assign(new Error(`좌석 한도를 ${used + count - supervisor.seat_limit}석 초과합니다.`), { status: 409 });
          const result = db.prepare("INSERT INTO classes (supervisor_id, code, seat_count, settings_json, created_at) VALUES (?, ?, ?, '{}', ?)").run(session.owner_id, code, count, nowIso());
          const seats = createSeats(db, Number(result.lastInsertRowid), prefix, count);
          db.exec("COMMIT");
          return send(response, 201, { classroom: { id: Number(result.lastInsertRowid), code, seatCount: count }, seats, notice: "좌석 토큰은 지금 한 번만 표시됩니다. 링크를 안전하게 배포하세요." }, headers);
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      }

      const seatListMatch = path.match(/^\/api\/classes\/(\d+)\/seats$/);
      if (request.method === "GET" && seatListMatch) {
        const session = sessionFromRequest(db, request, "supervisor");
        const classId = Number(seatListMatch[1]);
        assertSupervisorOwnsClass(db, session.owner_id, classId);
        const seats = db.prepare("SELECT id, alias, active, created_at FROM seats WHERE class_id = ? ORDER BY id").all(classId).map((row) => ({ id: row.id, alias: row.alias, active: Boolean(row.active), createdAt: row.created_at }));
        return send(response, 200, { seats }, headers);
      }

      const rotateMatch = path.match(/^\/api\/classes\/(\d+)\/seats\/(\d+)\/rotate$/);
      if (request.method === "POST" && rotateMatch) {
        const session = sessionFromRequest(db, request, "supervisor");
        const classId = Number(rotateMatch[1]); const seatId = Number(rotateMatch[2]);
        const classroom = assertSupervisorOwnsClass(db, session.owner_id, classId);
        const token = opaqueToken(24);
        const result = db.prepare("UPDATE seats SET token_hash = ? WHERE id = ? AND class_id = ?").run(sha256(token), seatId, classId);
        if (!result.changes) throw Object.assign(new Error("좌석을 찾을 수 없습니다."), { status: 404 });
        const seat = db.prepare("SELECT id, alias FROM seats WHERE id = ?").get(seatId);
        return send(response, 200, { classCode: classroom.code, seat: { ...seat, token } }, headers);
      }

      const settingsMatch = path.match(/^\/api\/classes\/(\d+)\/settings$/);
      if (request.method === "PUT" && settingsMatch) {
        const session = sessionFromRequest(db, request, "supervisor");
        const classId = Number(settingsMatch[1]);
        assertSupervisorOwnsClass(db, session.owner_id, classId);
        const body = await readJson(request);
        const settings = {
          labId: safeCode(body.labId, ""),
          mission: safeCode(body.mission, ""),
          depth: ["M1", "M2", "H1", "H2"].includes(body.depth) ? body.depth : "M2",
          locks: typeof body.locks === "object" && body.locks ? body.locks : {},
        };
        db.prepare("UPDATE classes SET settings_json = ? WHERE id = ?").run(JSON.stringify(settings), classId);
        return send(response, 200, { settings }, headers);
      }

      const archiveMatch = path.match(/^\/api\/classes\/(\d+)\/archive$/);
      if (request.method === "POST" && archiveMatch) {
        const session = sessionFromRequest(db, request, "supervisor");
        const classId = Number(archiveMatch[1]);
        assertSupervisorOwnsClass(db, session.owner_id, classId);
        db.prepare("UPDATE classes SET archived = 1 WHERE id = ?").run(classId);
        return send(response, 200, { ok: true, recoverable: true }, headers);
      }

      if (request.method === "GET" && path === "/api/classroom/session") {
        const seat = seatFromRequest(db, request);
        return send(response, 200, { classCode: seat.class_code, seat: seat.alias, settings: JSON.parse(seat.settings_json || "{}") }, headers);
      }

      if (request.method === "POST" && path === "/api/classroom/trials") {
        const seat = seatFromRequest(db, request);
        const body = await readJson(request);
        const labId = safeCode(body.labId, "");
        if (!labId || typeof body.payload !== "object" || body.payload == null) throw Object.assign(new Error("실험 ID와 결과 payload가 필요합니다."), { status: 400 });
        const payloadText = JSON.stringify(body.payload);
        if (Buffer.byteLength(payloadText) > 128 * 1024) throw Object.assign(new Error("실험 결과가 너무 큽니다."), { status: 413 });
        const result = db.prepare("INSERT INTO trials (class_id, seat_id, lab_id, model_version, mission, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(seat.class_id, seat.id, labId, safeCode(body.modelVersion, "1.0.0"), safeCode(body.mission, ""), payloadText, nowIso());
        return send(response, 201, { id: Number(result.lastInsertRowid), createdAt: nowIso() }, headers);
      }

      if (request.method === "GET" && path === "/api/classroom/trials") {
        const seat = seatFromRequest(db, request);
        const labId = safeCode(url.searchParams.get("labId"), "");
        if (!labId) throw Object.assign(new Error("labId가 필요합니다."), { status: 400 });
        const rows = db.prepare(`SELECT trials.id, seats.alias, trials.model_version, trials.mission, trials.payload_json, trials.created_at FROM trials JOIN seats ON seats.id = trials.seat_id WHERE trials.class_id = ? AND trials.lab_id = ? ORDER BY trials.id DESC LIMIT 500`).all(seat.class_id, labId);
        return send(response, 200, { trials: rows.reverse().map((row) => ({ id: row.id, seat: row.alias, modelVersion: row.model_version, mission: row.mission, payload: JSON.parse(row.payload_json), createdAt: row.created_at })) }, headers);
      }

      const teacherTrialsMatch = path.match(/^\/api\/classes\/(\d+)\/trials$/);
      if (request.method === "GET" && teacherTrialsMatch) {
        const session = sessionFromRequest(db, request, "supervisor");
        const classId = Number(teacherTrialsMatch[1]);
        assertSupervisorOwnsClass(db, session.owner_id, classId);
        const labId = safeCode(url.searchParams.get("labId"), "");
        const rows = db.prepare(`SELECT trials.id, seats.alias, trials.lab_id, trials.model_version, trials.mission, trials.payload_json, trials.created_at FROM trials JOIN seats ON seats.id = trials.seat_id WHERE trials.class_id = ? AND (? = '' OR trials.lab_id = ?) ORDER BY trials.id DESC LIMIT 2000`).all(classId, labId, labId);
        return send(response, 200, { trials: rows.map((row) => ({ id: row.id, seat: row.alias, labId: row.lab_id, modelVersion: row.model_version, mission: row.mission, payload: JSON.parse(row.payload_json), createdAt: row.created_at })) }, headers);
      }

      return send(response, 404, { error: "API 경로를 찾을 수 없습니다." }, headers);
    } catch (error) {
      const status = Number(error.status) || (String(error.message).includes("UNIQUE constraint") ? 409 : 500);
      if (status >= 500) console.error(error);
      return send(response, status, { error: status >= 500 ? "서버에서 요청을 처리하지 못했습니다." : error.message }, headers);
    }
  });

  server.on("close", () => db.close());
  return { server, db, databasePath };
}

function clampInteger(value, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const port = clampInteger(process.env.PORT || 8787, 1, 65535);
  try {
    const { server, databasePath } = createClassroomServer();
    server.listen(port, () => console.log(`STEM101 classroom API: http://localhost:${port} · DB ${databasePath}`));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
