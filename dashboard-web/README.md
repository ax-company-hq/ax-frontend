# dashboard-web

담당: 병환 · 포트: 3001 · 연결 API: dashboard-api (8020)

## 1. 역할
캣북스(catbooks) 상담원 화면. [`bxbae/iTshirt-cat`](https://github.com/bxbae/iTshirt-cat)의 Next.js `/admin`에서 Vite로 옮겼고, 앱 루트(`/`)에서 시작한다. 예전 `/admin/...` 주소는 같은 화면으로 넘긴다.

| 경로 | 화면 |
| --- | --- |
| `/` | 대시보드: 문의·클레임 추이, 자주 걸리는 규칙, 답변 대기 문의, 보상 큐 앞줄 |
| `/console` | 상담 콘솔: 문의 목록, 답변 초안(3가지 스타일)·근거·가드 검사, 요약 |
| `/claims` | 클레임 판정: 규칙 엔진 결과 확인, 승인·거절, 입고·검수 |
| `/queue` | 보상 큐: 입고 순서대로 환불·보상 지급 |
| `/reviews` | 후기 관리: 보류 후기 공개·숨김 |
| `/kb` | 지식베이스(정책 문서 조각) |
| `/finance` | 재무 AI: 사람 확인이 필요한 일(진행·멈춤, 10분 지나면 자동 취소), 장애 손실, 재무 AI가 다시 계산한 결과, 처리 내역, 재무 AI가 하는 일, 사람 확인 기준 (safety 8001·finance 8105 조회) |
| `/hr` | 인사 AI: 업무 기록(사람이 확인할 후보 결정, 계획 비교, 인사 AI가 한 일), 인수인계(진행 상황·완성도, 인계자 질문에 답하기), 담당 명부(영역별 담당·교대, 담당 공백). 인수인계 시작·확정은 총괄 AI가 부르므로 버튼이 없다 |
| `/finance/guide` | 재무 AI 관리자 사용법 (결정하는 법, 이유별 판단 기준, 자주 묻는 질문) |

상단 '쇼핑몰 보기'는 루트 `.env`의 `VITE_SHOP_WEB_URL`(기본 `http://localhost:3000`)을 연다.

## 2. 실행 방법
레포 루트에서:

```bash
npm install
npm run dev -w dashboard-web        # http://localhost:3001
npm run build -w dashboard-web
```

API 주소는 루트 `.env`의 `VITE_DASHBOARD_API_URL`로 정한다.

### dashboard-api 목 모드로 띄워 보기
ax-backend `dashboard-api`를 목 데이터로 띄우면 화면을 바로 볼 수 있다 (읽기 화면만).

```bash
# ax-backend
DASHBOARD_MOCK=1 uv run --package ax-dashboard-api uvicorn ax_dashboard_api.main:app --port 8020
# ax-frontend 루트 .env
VITE_DASHBOARD_API_URL=http://localhost:8020
```

브라우저가 3001에서 8020을 부르므로 dashboard-api에 CORS 허용(`http://localhost:3001`)이 있어야 한다.

## 3. API 타입
`@ax/types`(루트 `types/`, 자동 생성)에서 가져오는 것이 원칙이다.
**임시:** dashboard-api의 OpenAPI가 `contracts/openapi/`에 반영되기 전이라 catbooks의 타입을 `src/lib/types.ts`에 그대로 옮겨 두었다.
dashboard-api가 이 API를 열고 `npm run gen:types`로 타입이 생기면 `src/lib/types.ts`를 지우고 `@ax/types/dashboard-api`로 바꾼다.

호출 경로는 `src/lib/api.ts` 한 곳에 있다. 재무·안전 화면만 `src/lib/finance.ts`가 safety(`VITE_SAFETY_API_URL`)·finance(`VITE_FINANCE_AGENT_URL`) 조회 API를 직접 부른다(임시: dashboard-api 경유로 옮길 예정). C 보류 결정은 사람 토큰(`VITE_SAFETY_HUMAN_TOKEN`, 목 모드는 `human:<이름>`)이 있어야 버튼이 켜진다. 응답은 ax-backend 규약 `{data, meta}` / `{error: {code, message}}`로 받는다.

| 메서드 | 경로 | 서버 |
| --- | --- | --- |
| GET | `/api/dashboard/health`, `/api/dashboard/users` | dashboard-api #17 (목 모드) |
| GET | `/api/dashboard/metrics?days`, `/api/dashboard/kpis`, `/api/dashboard/kb-chunks` | 〃 |
| GET | `/api/dashboard/conversations`, `/api/dashboard/conversations/{id}` | 〃 |
| GET | `/api/dashboard/orders?user_id` | 〃 |
| GET | `/api/dashboard/claims?status`, `/api/dashboard/claims/stats`, `/api/dashboard/claims/{id}` | 〃 |
| GET | `/api/dashboard/queue-entries`, `/api/dashboard/reviews` | 〃 |
| POST | `/api/dashboard/conversations`, `/api/dashboard/conversations/{id}/` `customer-messages`, `check`, `agent-messages`, `reject-draft`, `summary`, `status` | 아직 없음 |
| POST | `/api/dashboard/claims/{id}/` `approve`, `reject`, `receive`, `inspection` | 아직 없음 |
| POST | `/api/dashboard/queue-entries/process`, `/api/dashboard/reviews/{id}/status` | 아직 없음 |

쓰기(POST) 경로는 서버가 생기면 그 경로에 맞춰 `api.ts`를 고친다.

ax 구조에서 환불·보상 지급은 고객지원 관문(support 에이전트, `execute()`)을 거쳐야 하므로, dashboard-api가 이 경로를 열 때 승인·지급 계열(`approve`, `queue/process` 등)은 그쪽으로 넘기도록 백엔드에서 정한다.

## 4. common-frontend
`@dejafix/common-frontend`를 git 태그(`git+https://github.com/DejaFix/common-frontend.git#v0.1.0`)로 설치해 두었다.
TODO: common-frontend 버전 태그로 설치 (AppShell 메뉴에 부서 항목, 색은 토큰만)
— 진입점에서 `import '@dejafix/common-frontend/styles.css'` 후 `AppShell`로 감싼다. 색은 디자인 토큰(CSS 변수)만 쓰고 직접 색 값을 넣지 않는다.

**현재 상태:** catbooks 화면은 자체 Tailwind 설정(`tailwind.config.ts`)과 `src/styles.css`의 CSS 변수(라이트·다크)로 그린다. 색 값은 모두 CSS 변수를 거치지만 common-frontend 토큰은 아직 쓰지 않는다.
두 스타일을 한 번에 섞으면 `.btn`·`.card`·`.chip` 클래스 이름이 겹치므로, common-frontend 적용은 별도 PR로 한다.
