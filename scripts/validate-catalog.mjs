import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const catalogPath = join(root, "catalog", "projects.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const required = [
  "id",
  "title",
  "level",
  "gradeLabel",
  "subject",
  "subjectLabel",
  "status",
  "statusLabel",
  "technology",
  "summary",
  "entry",
];
const ids = new Set();
const errors = [];

for (const project of catalog.projects) {
  for (const field of required) {
    if (project[field] === undefined || project[field] === "") {
      errors.push(`${project.id || "(id 없음)"}: ${field} 항목이 없습니다.`);
    }
  }

  if (ids.has(project.id)) {
    errors.push(`${project.id}: id가 중복되었습니다.`);
  }
  ids.add(project.id);

  try {
    await access(join(root, project.entry, "index.html"));
  } catch {
    errors.push(`${project.id}: ${project.entry}에서 index.html을 찾을 수 없습니다.`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${catalog.projects.length}개 프로젝트의 카탈로그 검사를 통과했습니다.`);
}
