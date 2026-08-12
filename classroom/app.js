import { motionLab, energyLab, circuitLab, gravityLab, thermalLab, opticsLab, gasLab } from "../shared/topics/physics-labs.js";
import { atomLab, acidBaseLab, reactionLab } from "../shared/topics/chemistry-labs.js";
import { ecologyLab, moonLab, geneticsLab, seasonsLab } from "../shared/topics/life-earth-labs.js";
import { probabilityLab, functionLab } from "../shared/topics/math-labs.js";

const LAB_CONFIGS = [motionLab, energyLab, circuitLab, probabilityLab, gravityLab, functionLab, atomLab, ecologyLab, moonLab, acidBaseLab, thermalLab, opticsLab, gasLab, reactionLab, geneticsLab, seasonsLab];

const elements = {
  login: document.querySelector("[data-login]"),
  loginForm: document.querySelector("[data-login-form]"),
  loginStatus: document.querySelector("[data-login-status]"),
  admin: document.querySelector("[data-admin]"),
  supervisor: document.querySelector("[data-supervisor]"),
  logout: document.querySelector("[data-logout]"),
  supervisorForm: document.querySelector("[data-supervisor-form]"),
  supervisors: document.querySelector("[data-supervisors]"),
  classForm: document.querySelector("[data-class-form]"),
  classes: document.querySelector("[data-classes]"),
  licenseSummary: document.querySelector("[data-license-summary]"),
  licenseBar: document.querySelector("[data-license-bar]"),
  labSelect: document.querySelector("[data-lab-select]"),
  delivery: document.querySelector("[data-delivery]"),
  seatLinks: document.querySelector("[data-seat-links]"),
  copyAll: document.querySelector("[data-copy-all]"),
  status: document.querySelector("[data-status]"),
  classSettings: document.querySelector("[data-class-settings]"),
  settingsClass: document.querySelector("[data-settings-class]"),
  settingsForm: document.querySelector("[data-settings-form]"),
  settingsLab: document.querySelector("[data-settings-lab]"),
  settingsMission: document.querySelector("[data-settings-mission]"),
  settingsLocks: document.querySelector("[data-settings-locks]"),
};

const state = {
  apiBase: sessionStorage.getItem("stem101:api") || "http://localhost:8787",
  token: sessionStorage.getItem("stem101:token") || "",
  role: sessionStorage.getItem("stem101:role") || "",
  labs: [],
  deliveredLinks: [],
  selectedClass: null,
};

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.style.color = error ? "#ff7557" : "";
}

async function api(path, options = {}) {
  const response = await fetch(`${state.apiBase.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function showRole(role) {
  elements.login.hidden = Boolean(role);
  elements.admin.hidden = role !== "admin";
  elements.supervisor.hidden = role !== "supervisor";
  elements.logout.hidden = !role;
}

async function loadLabs() {
  const response = await fetch("../catalog/projects.json");
  const catalog = await response.json();
  state.labs = catalog.projects.filter((project) => project.status === "complete" && !["tide-lab", "projectile-lab"].includes(project.id));
  elements.labSelect.replaceChildren(...state.labs.map((lab) => {
    const option = document.createElement("option"); option.value = lab.id; option.textContent = lab.title; return option;
  }));
}

function labById(id) {
  return state.labs.find((lab) => lab.id === id) || state.labs[0];
}

function configById(id) {
  return LAB_CONFIGS.find((config) => config.id === id) || LAB_CONFIGS[0];
}

function fillSettingsForLab(settings = {}) {
  const config = configById(elements.settingsLab.value);
  elements.settingsMission.replaceChildren(...config.missions.map((mission) => {
    const option = document.createElement("option"); option.value = mission.id; option.textContent = mission.title; return option;
  }));
  if (config.missions.some((mission) => mission.id === settings.mission)) elements.settingsMission.value = settings.mission;
  elements.settingsLocks.replaceChildren(...config.variables.map((variable) => {
    const label = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.name = `lock:${variable.key}`; input.checked = Boolean(settings.locks?.[variable.key]); const span = document.createElement("span"); span.textContent = variable.label; label.append(input, span); return label;
  }));
}

function openClassSettings(classroom) {
  state.selectedClass = classroom;
  elements.settingsForm.elements.classId.value = classroom.id;
  elements.settingsClass.textContent = classroom.code;
  const targetLab = configById(classroom.settings?.labId).id;
  elements.settingsLab.value = targetLab;
  elements.settingsForm.elements.depth.value = classroom.settings?.depth || "M2";
  fillSettingsForLab(classroom.settings || {});
  elements.classSettings.hidden = false;
  elements.classSettings.scrollIntoView({ behavior: "smooth", block: "start" });
}

function studentLink(classroom, seat, labId) {
  const lab = labById(labId);
  const url = new URL(`../${lab.entry}`, location.href);
  url.searchParams.set("api", state.apiBase);
  url.searchParams.set("class", classroom.code);
  url.searchParams.set("seat", seat.alias);
  url.searchParams.set("seatToken", seat.token);
  return url.href;
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  setStatus("클립보드에 복사했습니다.");
}

function renderDelivery(classroom, seats, labId) {
  state.deliveredLinks = seats.map((seat) => ({ alias: seat.alias, url: studentLink(classroom, seat, labId) }));
  elements.seatLinks.replaceChildren(...state.deliveredLinks.map((item) => {
    const row = document.createElement("div"); row.className = "seat-link";
    const alias = document.createElement("strong"); alias.textContent = item.alias;
    const code = document.createElement("code"); code.textContent = item.url;
    const button = document.createElement("button"); button.type = "button"; button.textContent = "링크 복사"; button.addEventListener("click", () => copyText(item.url));
    row.append(alias, code, button); return row;
  }));
  elements.delivery.hidden = false;
  elements.delivery.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshSupervisors() {
  const payload = await api("/api/admin/supervisors");
  elements.supervisors.replaceChildren(...payload.supervisors.map((item) => {
    const row = document.createElement("div"); row.className = "data-row";
    const code = document.createElement("strong"); code.textContent = item.code;
    const seats = document.createElement("span"); seats.textContent = `${item.usedSeats}/${item.seatLimit}석`;
    const expiry = document.createElement("span"); expiry.textContent = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("ko-KR") : "만료 없음";
    const button = document.createElement("button"); button.type = "button"; button.textContent = item.active ? "비활성화" : "활성화";
    button.addEventListener("click", async () => { await api(`/api/admin/supervisors/${item.id}/status`, { method: "PUT", body: JSON.stringify({ active: !item.active }) }); await refreshSupervisors(); });
    row.append(code, seats, expiry, button); return row;
  }));
}

async function refreshClasses() {
  const payload = await api("/api/classes");
  const { seatLimit, usedSeats, remainingSeats } = payload.license;
  elements.licenseSummary.textContent = `사용 ${usedSeats}석 / 허용 ${seatLimit}석 · 남은 좌석 ${remainingSeats}석`;
  elements.licenseBar.style.width = `${Math.min(100, usedSeats / Math.max(1, seatLimit) * 100)}%`;
  elements.classes.replaceChildren(...payload.classes.map((item) => {
    const row = document.createElement("div"); row.className = "data-row";
    const code = document.createElement("strong"); code.textContent = item.code;
    const seats = document.createElement("span"); seats.textContent = `${item.seatCount}석`;
    const stateLabel = document.createElement("span"); stateLabel.textContent = item.archived ? "보관됨" : "진행 가능";
    const seatButton = document.createElement("button"); seatButton.type = "button"; seatButton.textContent = "좌석 보기";
    seatButton.addEventListener("click", async () => { const response = await api(`/api/classes/${item.id}/seats`); setStatus(`${item.code}: ${response.seats.map((seat) => seat.alias).join(", ")} · 토큰을 잃은 좌석은 서버 API에서 재발급할 수 있습니다.`); });
    const settingsButton = document.createElement("button"); settingsButton.type = "button"; settingsButton.textContent = "수업 설정"; settingsButton.addEventListener("click", () => openClassSettings(item));
    row.append(code, seats, stateLabel, seatButton, settingsButton); return row;
  }));
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const data = new FormData(event.currentTarget);
  state.apiBase = String(data.get("apiBase")).replace(/\/$/, ""); const role = String(data.get("role"));
  elements.loginStatus.textContent = "서버에 연결하는 중…";
  try {
    const payload = await api(`/api/auth/${role}`, { method: "POST", body: JSON.stringify({ code: data.get("code"), password: data.get("password") }) });
    state.token = payload.token; state.role = payload.role;
    sessionStorage.setItem("stem101:api", state.apiBase); sessionStorage.setItem("stem101:token", state.token); sessionStorage.setItem("stem101:role", state.role);
    showRole(state.role); setStatus("로그인했습니다.");
    if (state.role === "admin") await refreshSupervisors(); else await refreshClasses();
  } catch (error) { elements.loginStatus.textContent = error.message; }
});

elements.logout.addEventListener("click", () => { sessionStorage.removeItem("stem101:token"); sessionStorage.removeItem("stem101:role"); state.token = ""; state.role = ""; showRole(""); });

elements.supervisorForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  try {
    await api("/api/admin/supervisors", { method: "POST", body: JSON.stringify({ code: data.get("code"), password: data.get("password"), seatLimit: Number(data.get("seatLimit")), expiresAt: data.get("expiresAt") ? new Date(String(data.get("expiresAt"))).toISOString() : null }) });
    form.reset(); setStatus("감독자 라이선스를 발급했습니다."); await refreshSupervisors();
  } catch (error) { setStatus(error.message, true); }
});

elements.classForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  try {
    const payload = await api("/api/classes", { method: "POST", body: JSON.stringify({ code: data.get("code"), prefix: data.get("prefix"), seatCount: Number(data.get("seatCount")) }) });
    const config = configById(String(data.get("labId")));
    await api(`/api/classes/${payload.classroom.id}/settings`, { method: "PUT", body: JSON.stringify({ labId: config.id, mission: config.missions[0].id, depth: "M2", locks: {} }) });
    renderDelivery(payload.classroom, payload.seats, String(data.get("labId"))); setStatus("비식별 좌석 계정을 만들었습니다."); await refreshClasses();
  } catch (error) { setStatus(error.message, true); }
});

elements.settingsLab.replaceChildren(...LAB_CONFIGS.map((config) => { const option = document.createElement("option"); option.value = config.id; option.textContent = config.title; return option; }));
elements.settingsLab.addEventListener("change", () => fillSettingsForLab({}));
elements.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const config = configById(String(data.get("labId"))); const locks = {};
  config.variables.forEach((variable) => { if (data.get(`lock:${variable.key}`)) locks[variable.key] = true; });
  try {
    const payload = await api(`/api/classes/${Number(data.get("classId"))}/settings`, { method: "PUT", body: JSON.stringify({ labId: config.id, mission: data.get("mission"), depth: data.get("depth"), locks }) });
    setStatus(`수업 설정을 저장했습니다 · ${config.title} · 잠금 ${Object.keys(locks).length}개`); state.selectedClass.settings = payload.settings; await refreshClasses();
  } catch (error) { setStatus(error.message, true); }
});

elements.copyAll.addEventListener("click", () => copyText(state.deliveredLinks.map((item) => `${item.alias}\t${item.url}`).join("\n")));

await loadLabs();
elements.loginForm.elements.apiBase.value = state.apiBase;
showRole(state.role);
if (state.role === "admin") refreshSupervisors().catch(() => showRole(""));
if (state.role === "supervisor") refreshClasses().catch(() => showRole(""));
