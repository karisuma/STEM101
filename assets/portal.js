const rowsContainer = document.querySelector("#project-rows");
const projectTemplate = document.querySelector("#project-template");
const resultCount = document.querySelector("#result-count");
const searchInput = document.querySelector("#project-search");

const filters = {
  level: "all",
  subject: "all",
  status: "all",
  search: "",
};

let projects = [];

function updateStatistics() {
  const complete = projects.filter((project) => project.status === "complete").length;
  const inProgress = projects.filter(
    (project) => project.status === "in-progress",
  ).length;
  const subjects = new Set(projects.map((project) => project.subject)).size;

  document.querySelector("#stat-total").textContent = projects.length;
  document.querySelector("#stat-complete").textContent = complete;
  document.querySelector("#stat-progress").textContent = inProgress;
  document.querySelector("#stat-subjects").textContent = subjects;
}

function matchesFilters(project) {
  const query = filters.search.trim().toLocaleLowerCase("ko");
  const searchable = [
    project.title,
    project.summary,
    project.gradeLabel,
    project.subjectLabel,
    project.technology,
  ]
    .join(" ")
    .toLocaleLowerCase("ko");

  return (
    (filters.level === "all" || String(project.level).split("-").includes(filters.level)) &&
    (filters.subject === "all" || project.subject === filters.subject) &&
    (filters.status === "all" || project.status === filters.status) &&
    (!query || searchable.includes(query))
  );
}

function renderProjects() {
  const visibleProjects = projects.filter(matchesFilters);
  rowsContainer.replaceChildren();
  resultCount.textContent = `${visibleProjects.length}개`;

  if (!visibleProjects.length) {
    const message = document.createElement("p");
    message.className = "message";
    message.textContent = "조건에 맞는 실험실이 없습니다.";
    rowsContainer.append(message);
    return;
  }

  for (const project of visibleProjects) {
    const row = projectTemplate.content.cloneNode(true);
    row.querySelector(".project-name strong").textContent = project.title;
    row.querySelector(".project-name small").textContent = project.id;
    row.querySelector(".grade").textContent = project.gradeLabel;
    row.querySelector(".subject").textContent = project.subjectLabel;
    row.querySelector(".status").textContent = project.statusLabel;
    row.querySelector(".technology").textContent = project.technology;

    const link = row.querySelector(".open-project");
    link.href = project.entry;
    link.setAttribute("aria-label", `${project.title} 열기`);
    rowsContainer.append(row);
  }
}

document.querySelectorAll("[data-filter-group]").forEach((group) => {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;

    filters[group.dataset.filterGroup] = button.dataset.value;
    group.querySelectorAll("button").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    renderProjects();
  });
});

searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  renderProjects();
});

async function loadProjects() {
  try {
    const response = await fetch("catalog/projects.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    projects = catalog.projects;
    updateStatistics();
    renderProjects();
  } catch (error) {
    console.error("실험실 목록을 불러오지 못했습니다.", error);
    rowsContainer.innerHTML =
      '<p class="message">실험실 목록을 불러오지 못했습니다.</p>';
    resultCount.textContent = "";
  }
}

loadProjects();
