import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "catalog", "projects.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const projects = catalog.projects ?? catalog;
const failures = [];
const checkedFiles = new Set();

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function localTarget(reference) {
  const clean = reference.split("#")[0].split("?")[0];
  if (!clean || /^(?:[a-z]+:|\/\/|#|data:)/i.test(reference)) return null;
  return decodeURIComponent(clean);
}

async function validateReference(owner, reference) {
  const target = localTarget(reference);
  if (!target) return;
  const resolved = target.startsWith("/")
    ? path.join(root, target.replace(/^\/+/, ""))
    : path.resolve(path.dirname(owner), target);
  if (!(await exists(resolved))) {
    failures.push(`${path.relative(root, owner)} -> ${reference}`);
  }
}

async function validateModule(modulePath) {
  const normalized = path.normalize(modulePath);
  if (checkedFiles.has(normalized) || !(await exists(normalized))) return;
  checkedFiles.add(normalized);
  const source = await readFile(normalized, "utf8");
  const importPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const reference = match[1];
    await validateReference(normalized, reference);
    const target = localTarget(reference);
    if (target?.startsWith(".")) {
      const resolved = path.resolve(path.dirname(normalized), target);
      if (/\.(?:m?js)$/i.test(resolved)) await validateModule(resolved);
    }
  }
}

for (const project of projects) {
  const entryPath = path.resolve(root, project.entry);
  const indexPath = path.extname(entryPath) ? entryPath : path.join(entryPath, "index.html");
  if (!(await exists(indexPath))) {
    failures.push(`${project.id}: 진입 파일 없음 (${project.entry})`);
    continue;
  }

  const html = await readFile(indexPath, "utf8");
  const referencePattern = /<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(referencePattern)) {
    await validateReference(indexPath, match[1]);
    const target = localTarget(match[1]);
    if (target && /\.m?js$/i.test(target)) {
      await validateModule(path.resolve(path.dirname(indexPath), target));
    }
  }

  const metadataPath = path.join(entryPath, "project.json");
  if (await exists(metadataPath)) {
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    if (metadata.id !== project.id) {
      failures.push(`${project.id}: project.json id가 ${metadata.id}입니다.`);
    }
    if (metadata.theme?.primary !== project.theme?.primary || metadata.theme?.secondary !== project.theme?.secondary) {
      failures.push(`${project.id}: project.json과 catalog의 테마 색상이 다릅니다.`);
    }
  }
}

const labDirectories = [];
for (const subject of ["science", "math"]) {
  const subjectRoot = path.join(root, "projects", "middle", subject);
  if (!(await exists(subjectRoot))) continue;
  for (const item of await readdir(subjectRoot, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const metadataPath = path.join(subjectRoot, item.name, "project.json");
    if (await exists(metadataPath)) {
      const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
      if (metadata.classroom?.account === "non-identifying-seat-alias") {
        labDirectories.push(metadataPath);
      }
    }
  }
}

if (labDirectories.length !== 17) {
  failures.push(`공통 실험실 project.json 수가 17개가 아니라 ${labDirectories.length}개입니다.`);
}

if (failures.length) {
  console.error("정적 SITE 검사 실패:\n- " + failures.join("\n- "));
  process.exitCode = 1;
} else {
  console.log(`${projects.length}개 공개 진입점, ${labDirectories.length}개 신규 실험실, ${checkedFiles.size}개 모듈의 정적 경로 검사를 통과했습니다.`);
}
