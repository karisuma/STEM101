const projectList = document.querySelector("#project-list");
const projectTemplate = document.querySelector("#project-template");
const resultCount = document.querySelector("#result-count");

const filters = {
  level: "all",
  subject: "all",
};

let projects = [];

function renderProjects() {
  const visibleProjects = projects.filter((project) => {
    const levelMatches =
      filters.level === "all" || project.level === filters.level;
    const subjectMatches =
      filters.subject === "all" || project.subject === filters.subject;
    return levelMatches && subjectMatches;
  });

  projectList.replaceChildren();
  resultCount.textContent = `${visibleProjects.length}개의 프로젝트`;

  if (!visibleProjects.length) {
    const message = document.createElement("p");
    message.className = "empty-state";
    message.textContent = "이 조건에 맞는 프로젝트를 함께 준비하고 있어요.";
    projectList.append(message);
    return;
  }

  for (const project of visibleProjects) {
    const row = projectTemplate.content.cloneNode(true);
    row.querySelector("h3").textContent = project.title;
    row.querySelector(".metadata").textContent = [
      project.gradeLabel,
      project.subjectLabel,
      project.seriesLabel || `${project.durationMinutes}분`,
    ].join(" · ");
    row.querySelector(".summary").textContent = project.summary;

    const link = row.querySelector(".project-action");
    link.href = project.entry;
    link.setAttribute("aria-label", `${project.title} 프로젝트 보기`);
    projectList.append(row);
  }
}

function bindFilters() {
  document.querySelectorAll("[data-filter-group]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button) return;

      const filterName = group.dataset.filterGroup;
      filters[filterName] = button.dataset.value;

      group.querySelectorAll("button").forEach((candidate) => {
        const selected = candidate === button;
        candidate.classList.toggle("selected", selected);
        candidate.setAttribute("aria-pressed", String(selected));
      });

      renderProjects();
    });
  });
}

async function loadProjects() {
  try {
    const response = await fetch("catalog/projects.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    projects = catalog.projects;
    renderProjects();
  } catch (error) {
    console.error("프로젝트 목록을 불러오지 못했습니다.", error);
    projectList.innerHTML =
      '<p class="error-state">프로젝트 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
    resultCount.textContent = "";
  }
}

bindFilters();
loadProjects();
