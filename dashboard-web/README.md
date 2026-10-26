# dashboard-web

담당: 병환 · 포트: 3001 · 연결 API: dashboard-api (8020)

## 1. 역할
캣북스(catbooks) 상담원 화면. [`bxbae/iTshirt-cat`](https://github.com/bxbae/iTshirt-cat)의 Next.js `/admin`에서 Vite로 옮겼고, 앱 루트(`/`)에서 시작한다. 예전 `/admin/...` 주소는 같은 화면으로 넘긴다.

| 경로 | 화면 |
| --- | --- |
| `/` | 대시보드: 문의·클레임 추이, 자주 걸리는 규칙, 부서별 호출 현황(총괄이 부서를 부른 횟수·오류·성공률·평균 응답, skill별 표·최근 호출), 오늘의 브리핑, 답변 대기 문의, 보상 큐 앞줄 |
| `/orchestrator` | 총괄: 총괄 에이전트가 연 사건 목록과 상세(15단계 진행, 부서별 상태, 사람 승인 대기, 진행 기록). 읽기 전용 |
| `/console` | 상담 콘솔: 문의 목록, 답변 초안(3가지 스타일)·근거·가드 검사, 요약 |
| `/claims` | 클레임 판정: 규칙 엔진 결과 확인, 승인·거절, 입고·검수 |
| `/queue` | 보상 큐: 입고 순서대로 환불·보상 지급 |
| `/reviews` | 후기 관리: 보류 후기 공개·숨김 |
| `/kb` | 지식베이스(정책 문서 조각) |
| `/finance` | 재무 AI(캣북스 재무팀): 지금 사람이 할 일, 오늘의 재무, ① 결산·리포트 ② 매출·PG 대사 ③ 판매자 정산 ⑤ 예산·한도 정책 ⑦ 내부통제·감사, 안전 장치 보류 큐(진행·멈춤), 장애 손실 (finance 8105·safety 8001) |
| `/hr` | 인사 AI: 업무 기록(사람이 확인할 후보 결정, 계획 비교, 인사 AI가 한 일), 인수인계(진행 상황·완성도, 인계자 질문에 답하기), 담당 명부(영역별 담당·교대, 담당 공백). 인수인계 시작·확정은 총괄 AI가 부르므로 버튼이 없다 |
| `/finance/guide` | 재무 AI 관리자 사용법 (5개 모듈 설명, 보류 큐에서 결정하는 법, 자주 묻는 질문) |
| `/planning` | 기획개발 AI(캣북스 기획개발팀): 프로젝트·요청·작업·정리·소통·규정·자료·지표. 다른 부서 시뮬레이터는 넣지 않았다(개발 도구는 planning-web 3003). 화면 안 이동은 해시(`/planning#/requests`). 코드는 `src/planning/`(planning-web에서 옮김), 공통 컴포넌트 스타일은 `postcss.config.js`가 `.planning-scope` 안으로만 묶는다. 시연 데이터는 연동 버스(`VITE_BUS_URL`, 기본 127.0.0.1:8790, `npm run bus:planning`) |

상단 '쇼핑몰 보기'는 루트 `.env`의 `VITE_SHOP_WEB_URL`(기본 `http://localhost:3000`)을 연다.
'기획개발 ↗'은 `VITE_PLANNING_WEB_URL`(기본 `http://localhost:3002`, 게이트웨이에서는 `/admin/planning/`)을 연다. 앱 사이 링크는 일반 `<a>`다 (`lib/nav.tsx`의 `Link`는 http(s)가 아니면 라우터 경로로 처리해 `/admin` 아래에서 깨진다).

게이트웨이(한 포트)에서는 `DASHBOARD_WEB_BASE=/admin/`으로 빌드한다 (기본 `/`). 라우터 `basename`은 `import.meta.env.BASE_URL`에서 계산한다. `VITE_ADMIN_LOGIN=on`이면 화면 앞에 데모 비밀번호(`VITE_ADMIN_DEMO_PASSWORD`, 기본 `catbooks`)가 선다. 실제 인증이 아니고 비밀번호가 번들에 들어간다. 쓰기 요청(GET 외)에는 `VITE_SAFETY_HUMAN_TOKEN`을 `Authorization: Bearer`로 보낸다 (ax-backend #295).

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

호출 경로는 `src/lib/api.ts` 한 곳에 있다. 재무·안전 화면만 `src/lib/finance.ts`가 safety(`VITE_SAFETY_API_URL`)·finance(`VITE_FINANCE_AGENT_URL`) 조회 API를 직접 부른다(임시: dashboard-api 경유로 옮길 예정). 결산 확정·대사 메모·C 보류 결정은 사람 토큰(`VITE_SAFETY_HUMAN_TOKEN`, 목 모드는 `human:<이름>`)이 있어야 버튼이 켜진다. 응답은 ax-backend 규약 `{data, meta}` / `{error: {code, message}}`로 받는다.

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

### 총괄·부서별 호출 현황 (개발용 임시 연결)
`/orchestrator`와 대시보드의 「부서별 호출 현황」은 총괄 서버를 직접 부르지 않고 shop-api 관리 읽기 중계(`GET /api/shop/admin/orchestrator/incidents`, `.../departments`, GET만)를 부른다.
- 개발 서버(`npm run dev`)에서는 기본값(`http://localhost:8010`, 토큰 `mock:admin`)으로 자동 연결된다. 운영 빌드는 `VITE_SHOP_ADMIN_API_URL`과 `VITE_SHOP_ADMIN_TOKEN`이 없으면 꺼지고 화면도 비어 있다.
- shop-api는 이 화면의 출처를 허용해야 한다: `SHOP_CORS_ORIGINS=http://localhost:3000,http://localhost:3001`. 총괄 주소는 shop-api의 `SHOP_ORCHESTRATOR_URL`이다.
- 토큰은 환경변수에서만 오고 브라우저 저장소에는 두지 않는다. 진짜 로그인과 역할(소유자·공동소유자·분야 관리자·에이전트)은 사람 인증(#265) 뒤에 이 자리를 대신한다.
