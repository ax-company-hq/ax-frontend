# ax-frontend

AX 가상회사(e커머스) 프론트엔드. npm workspaces 모노레포이며, 백엔드 [`ax-company-hq/ax-backend`](https://github.com/ax-company-hq/ax-backend)와 API로만 연결한다.

| 폴더 | 내용 | 담당 | 포트 | 연결 API |
| --- | --- | --- | --- | --- |
| `shop-web/` | 판매 사이트 화면 | 재헌 | 3000 | shop-api (8010) |
| `dashboard-web/` | 대시보드(업무 시스템) 화면. 부서 탭: 재무 AI `/finance`, 기획개발 AI `/planning` | 병환 (부서 탭은 각 부서) | 3001 | dashboard-api (8020), `/planning`은 planning (8101) |
| `planning-web/` | 옛 기획개발 단독 화면. 지금은 `dashboard-web` `/planning`(기획개발 AI 탭)으로 옮겼고, 정리 전까지만 남겨 둔다. 목 데이터·연동 버스(8790)·다른 부서 시뮬레이터(3003)는 이 폴더에만 있고, 기획개발 AI 탭은 쓰지 않는다 | 예진 | 3002 | 목 연동 버스 (8790) |
| `orchestrator-web/` | 통합 에이전트(총괄) **시연 콘솔** (개발·시연용: 장애 주입 → 사건 흐름. 운영 화면은 `dashboard-web` 관리자) | 준하 | 3004 | orchestrator (8000, 개발 서버 프록시) |

> **포트 계획:** 판매 사이트(`shop-web`, 3000)만 따로 두고, 나머지 화면(대시보드·부서 화면)은 나중에 **업무 시스템 하나로 합쳐 같은 포트**를 쓴다. 로그인하면 자기 부서 탭으로 들어가는 구조다. 기획개발은 이미 합쳤다: `http://localhost:3001/planning`(게이트웨이에서는 `/admin/planning`). `planning-web`의 3002·3003은 정리 전까지 남은 옛 포트다.
| `types/` | API 타입 (자동 생성, 직접 수정 금지) | — | — | — |

스택: React 19 · Vite · TypeScript · Node 22.23.4 이상 (`.nvmrc`, 2026-10 보안 릴리스 반영). 공용 UI는 [`DejaFix/common-frontend`](https://github.com/DejaFix/common-frontend)를 git 태그로 설치한다.

## 실행 방법

```bash
nvm use                   # Node 22.23.4
cp .env.example .env      # 백엔드 API 주소
npm install
npm run dev:shop          # http://localhost:3000
npm run dev:dashboard     # http://localhost:3001
npm run dev:planning      # http://localhost:3002 옛 기획개발 단독 화면 (기획개발 AI 탭은 3001/planning, 기획개발 백엔드 8101 필요)
npm run dev:orchestrator  # http://localhost:3004 (총괄 백엔드를 먼저 켠다, 아래 "통합 에이전트 시연 콘솔 접속")
npm run typecheck         # 앱 타입 검사
npm run build             # 앱 빌드
```

백엔드까지 함께 띄우려면 두 레포를 같은 폴더에 나란히 clone하고, `ax-backend`에서 `docker compose -f infra/compose.yml up`을 실행한다.

## 통합 에이전트 시연 콘솔 접속 (터미널 2개)

통합 에이전트(총괄) 시연 콘솔은 총괄 백엔드가 떠 있어야 동작한다. 자세한 설명과 문제 해결은 [`orchestrator-web/README.md`](orchestrator-web/README.md).

```bash
# 터미널 1 — 총괄 백엔드 (ax-backend, dev 브랜치)
cd ax-backend && git switch dev && git pull && uv sync
uv run python -m ax_orchestrator --port 8000 --no-browser

# 터미널 2 — 화면 (ax-frontend)
cd ax-frontend && npm install
npm run dev:orchestrator
```

브라우저에서 **http://localhost:3004** 를 열고 "결제 장애 주입"을 누른다. 8000번이 이미 쓰이고 있으면 백엔드를 `--port` 없이 켜서 터미널에 나온 포트를 확인하고, 화면은 `ORCHESTRATOR_PROXY_TARGET=http://localhost:<포트> npm run dev:orchestrator`로 켠다 (Windows PowerShell: `$env:ORCHESTRATOR_PROXY_TARGET="http://localhost:<포트>"; npm run dev:orchestrator`). 내 에이전트만 실제로 붙여 보는 방법은 `ax-backend/docs/notes/orchestrator/department-guide.md`.

```
ax-company-hq/
├─ ax-backend/
└─ ax-frontend/
```

## 타입 생성 방법

API 타입은 손으로 쓰지 않는다. 백엔드의 특정 ref(버전 태그 또는 커밋 SHA)에 있는 `contracts/openapi/*.json`에서 생성한다.

```bash
npm run gen:types -- v0.20261021.0900     # 또는 커밋 SHA
```

- `scripts/gen-types.sh`가 `raw.githubusercontent.com`에서 `shop-api.json`, `dashboard-api.json`을 받아 `openapi-typescript`로 `types/src/*.ts`를 만든다.
- 백엔드에 아직 파일이 없으면 "백엔드 openapi.json이 아직 없음"을 출력하고 그냥 끝난다.
- 생성된 파일은 그대로 커밋한다. 직접 수정하지 않는다.

## CI

`.github/workflows/ci.yml` (잡 이름 `ci`): Node 22.23.4(`.nvmrc`) → `npm ci` → 두 앱 typecheck + build.
