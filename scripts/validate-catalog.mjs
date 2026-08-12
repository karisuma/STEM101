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
  "theme",
  "entry",
];
const ids = new Set();
const themePairs = new Map();
const errors = [];
const hexColor = /^#[0-9a-f]{6}$/i;

function colorLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
  const light = Math.max(colorLuminance(first), colorLuminance(second));
  const dark = Math.min(colorLuminance(first), colorLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

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

  if (project.theme !== undefined) {
    const primary = project.theme?.primary;
    const secondary = project.theme?.secondary;

    if (!hexColor.test(primary || "")) {
      errors.push(`${project.id}: theme.primary는 #RRGGBB 형식이어야 합니다.`);
    }
    if (!hexColor.test(secondary || "")) {
      errors.push(`${project.id}: theme.secondary는 #RRGGBB 형식이어야 합니다.`);
    }

    if (hexColor.test(primary || "") && hexColor.test(secondary || "")) {
      const normalized = [primary.toUpperCase(), secondary.toUpperCase()].sort();
      const pairKey = normalized.join("+");

      if (normalized[0] === normalized[1]) {
        errors.push(`${project.id}: 두 테마 색상은 서로 달라야 합니다.`);
      }

      if (contrastRatio(primary, secondary) < 3) {
        errors.push(
          `${project.id}: 두 테마 색상의 대비는 3:1 이상이어야 합니다.`,
        );
      }

      if (themePairs.has(pairKey)) {
        errors.push(
          `${project.id}: ${themePairs.get(pairKey)}와 같은 테마 색상 쌍을 사용하고 있습니다.`,
        );
      } else {
        themePairs.set(pairKey, project.id);
      }
    }
  }

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
