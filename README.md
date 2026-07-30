# STEM101

학생과 선생님이 수학·과학 질문을 정하고, 바이브코딩으로 시뮬레이터를 직접 만들고, 테스트와 수정을 거쳐 원리를 설명하는 제작형 수업 프로젝트입니다.

완성된 학습자료를 모아 제공하는 저장소가 아닙니다. 각 폴더에는 수업에서 함께 만든 시뮬레이터와 질문, 제작 과정, 테스트 기록을 축적합니다.

## 프로젝트 구조

```text
.
├─ index.html                    # 전체 프로젝트 스튜디오
├─ assets/                       # 포털 공용 자산
├─ catalog/projects.json         # 제작 프로젝트 목록
├─ docs/                         # 수업·제작·테스트 기준
├─ projects/
│  ├─ elementary/
│  │  ├─ math/
│  │  └─ science/
│  └─ middle/
│     ├─ math/
│     └─ science/
│        └─ 조석시뮬레이션/
└─ shared/                       # 여러 탐구가 함께 쓰는 코드
```

## 로컬에서 보기

정적 파일 서버로 저장소 루트를 열면 됩니다.

```bash
node scripts/serve.mjs
```

브라우저에서 `http://localhost:4173`으로 접속합니다.

## 프로젝트 추가하기

1. 학생과 선생님이 함께 만들 질문과 테스트 기준을 정합니다.
2. 학년군과 과목에 맞는 `projects/` 하위 폴더를 만듭니다.
3. 해당 폴더에 `project.json`과 실행 가능한 `index.html`을 둡니다.
4. 예상, 테스트 결과, 수정 과정을 프로젝트 문서에 기록합니다.
5. `catalog/projects.json`에 프로젝트 정보를 추가합니다.
6. `node scripts/validate-catalog.mjs`로 링크와 필수 항목을 검사합니다.

자세한 기준은 [콘텐츠 가이드](docs/content-guide.md)를 참고하세요.
