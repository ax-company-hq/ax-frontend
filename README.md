# ax-frontend

AX 가상회사(e커머스) 프론트엔드. npm workspaces 모노레포이며, 백엔드 [`ax-company-hq/ax-backend`](https://github.com/ax-company-hq/ax-backend)와 API로만 연결한다.

| 폴더 | 내용 | 담당 | 포트 | 연결 API |
| --- | --- | --- | --- | --- |
| `shop-web/` | 판매 사이트 화면 | 재헌 | 3000 | shop-api (8010) |
| `dashboard-web/` | 대시보드 화면 | 병환 | 3001 | dashboard-api (8020) |
| `types/` | API 타입 (자동 생성, 직접 수정 금지) | — | — | — |

스택: React 19 · Vite · TypeScript · Node 22 (`.nvmrc`). 공용 UI는 [`DejaFix/common-frontend`](https://github.com/DejaFix/common-frontend)를 git 태그로 설치한다.

## 실행 방법

```bash
nvm use                   # Node 22
cp .env.example .env      # 백엔드 API 주소
npm install
npm run dev:shop          # http://localhost:3000
npm run dev:dashboard     # http://localhost:3001
npm run typecheck         # 두 앱 타입 검사
npm run build             # 두 앱 빌드
```

백엔드까지 함께 띄우려면 두 레포를 같은 폴더에 나란히 clone하고, `ax-backend`에서 `docker compose -f infra/compose.yml up`을 실행한다.

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

`.github/workflows/ci.yml` (잡 이름 `ci`): Node 22 → `npm ci` → 두 앱 typecheck + build.
