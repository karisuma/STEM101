# 상세 시뮬레이션 시작 골격

1. 이 폴더의 `index.html` 구조를 프로젝트 프레임워크에 맞게 옮긴다.
2. 주제에 맞는 주색·부색을 정하고 `--sim-color-primary`, `--sim-color-secondary`를 교체한다.
3. 같은 색상 쌍을 `catalog/projects.json`의 프로젝트 항목에 기록한다.
4. 필요 없는 영역은 제거할 수 있지만 `조작 → 즉시 변화 → 검증` 흐름은 유지한다.
5. 세부 규칙은 `docs/simulation-design-system.md`를 따른다.
6. 완료 후 `node scripts/validate-catalog.mjs`를 실행한다.
