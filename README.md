# STEM101

STEM101은 중·고등학교에서 판매·운영할 수 있도록 만든 과학·수학 디지털 실험 교구 모음입니다. 학생은 현상을 먼저 예측하고, 변수를 조작하고, A/B 시행과 학급 표본을 비교해 원리를 검증합니다. 선생님은 설명 깊이·미션·변수 잠금과 비식별 좌석 계정을 관리합니다.

조석 실험실을 기준으로 16개 전문 실험실을 추가했으며, 모든 신규 실험실은 중등 직관부터 고등 심화까지의 설명, 정량 그래프, 실제 관심 사례, 60분 수업 미션과 모형의 한계를 포함합니다. 회로·광학·기계·원자·반응·생태·유전·함수는 부품을 자유롭게 놓고 연결하는 제작 샌드박스를 제공합니다.

## 프로젝트 구조

```text
.
├─ index.html                    # 공개 수업용 실험실 카탈로그
├─ assets/                       # 포털 공용 자산
├─ catalog/projects.json         # 공개 실험실 목록
├─ classroom/                    # 시스템 관리자·감독자 수업 콘솔
├─ server/                       # 비식별 좌석 라이선스·학급 표본 API
├─ docs/                         # 교과·수업·UI·상호작용·검수 기준
├─ projects/
│  ├─ elementary/
│  │  ├─ math/
│  │  └─ science/
│  └─ middle/
│     ├─ math/
│     └─ science/
│        ├─ 조석시뮬레이션/
│        └─ 주제별 독립 실험실/
├─ shared/                       # 공통 실험 엔진·UI·주제 계산 모형
├─ templates/                    # 새 상세 페이지 시작 골격
└─ scripts/                      # 카탈로그·과학 모형·서버 통합 검사
```

## 로컬에서 보기

정적 파일 서버로 저장소 루트를 열면 됩니다.

```bash
node scripts/serve.mjs
```

브라우저에서 `http://localhost:4173`으로 접속합니다.

## 수업용 학급 서버

정적 SITE만으로도 개인·한 브라우저 학급 데모를 사용할 수 있습니다. 여러 학생 기기의 표본을 실제로 동기화하려면 [비식별 학급 서버](server/README.md)를 운영하고 `classroom/` 관리 콘솔에서 감독자 라이선스와 좌석 링크를 발급합니다. 학생 이름·이메일·전화번호는 입력하거나 저장하지 않습니다.

## 검증

```bash
node scripts/validate-catalog.mjs
node scripts/validate-lab-models.mjs
node --no-warnings scripts/test-classroom-server.mjs
```

## 실험실 추가하기

1. 교육과정 성취기준, 빈번한 오개념과 검증 가능한 질문을 정합니다.
2. 학년군과 과목에 맞는 `projects/` 하위 폴더를 만듭니다.
3. 해당 폴더에 `project.json`과 실행 가능한 `index.html`을 둡니다.
4. 조작 변수, 판독값, 내장 미션, 60분 수업안과 모형 한계를 기록합니다.
5. `catalog/projects.json`에 프로젝트 정보를 추가합니다.
6. `node scripts/validate-catalog.mjs`로 링크와 필수 항목을 검사합니다.

전체 제품 기획은 [판매용 실험실 세부 기획](docs/commercial-simulation-labs-plan.md), 수업·계정·통계 사양은 [상호작용과 학급 운영 사양](docs/commercial-simulation-interaction-classroom-spec.md), 화면 기준은 [시뮬레이션 디자인 시스템](docs/simulation-design-system.md)을 참고하세요.
