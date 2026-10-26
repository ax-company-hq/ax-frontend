# shop-web

담당: 재헌 · 포트: 3000 · 연결 API: shop-api (8010)

## 1. 역할
캣북스(catbooks) 데모 서점의 판매 사이트. [`bxbae/iTshirt-cat`](https://github.com/bxbae/iTshirt-cat)의 Next.js 프론트엔드에서 Vite로 옮겼다.
상품 목록·상세, 장바구니, 주문·결제(가짜), 주문 내역, 영수증 기준 환불·교환·보상 신청(신청 전 환불액 미리보기), 후기 작성, 1:1 문의를 한다.
로그인은 데모용이다: `/login`에서 가상 고객을 고르면 그 id가 모든 요청에 `X-User-Id` 헤더로 붙는다.

| 경로 | 화면 |
| --- | --- |
| `/` | 홈 |
| `/products`, `/products/:id` | 상품 목록(카테고리·검색·정렬), 상세 |
| `/cart`, `/checkout` | 장바구니(브라우저 저장), 결제 |
| `/login` | 데모 로그인 |
| `/orders`, `/orders/:id` | 주문 내역, 주문 상세(클레임 신청·후기) |
| `/support` | 1:1 문의 |
| `/admin/departments` | 관리자: 부서 카드·사용량(총괄이 부서를 부른 횟수·오류·성공률·평균 응답, skill별 표, 최근 호출). 읽기 전용, 개발용 관리자 모드일 때만 보임. shop-api `GET /api/shop/admin/orchestrator/departments`(요청 ax-backend#378 처리 전에는 404 안내가 나옴) |
| `/admin/orchestrator` | 관리자: 총괄 에이전트 사건 목록·상세(읽기 전용). **개발용 관리자 모드**일 때만 보임 |

## 2. 실행 방법
레포 루트에서:

```bash
npm install
npm run dev -w shop-web        # http://localhost:3000
npm run build -w shop-web
```

API 주소는 루트 `.env`의 `VITE_SHOP_API_URL`로 정한다.

### 관리자 탭(개발용, 임시)
`VITE_SHOP_ADMIN_TOKEN`에 `mock:admin`을 넣으면(목 모드 전용) 우측 상단에 **관리자** 탭이 나타나고 `/admin/orchestrator`에서 총괄의 사건 흐름을 읽기 전용으로 본다. 비우면(기본) 탭도 화면도 없다.
- 화면은 총괄을 직접 부르지 않고 shop-api `GET /api/shop/admin/orchestrator/incidents`만 부른다(총괄 주소는 shop-api의 `SHOP_ORCHESTRATOR_URL`).
- catbooks 백엔드로 판매 화면을 띄울 때는 `VITE_SHOP_ADMIN_API_URL=http://localhost:8010`(shop-api)을 같이 넣는다. 비우면 `VITE_SHOP_API_URL`을 쓴다.
- 토큰은 환경변수에서만 오고 브라우저 저장소에는 두지 않는다. 운영 환경에는 값을 넣지 않는다.
- 진짜 관리자 로그인과 역할(소유자·공동소유자·분야 관리자·에이전트)은 사람 인증(#265·#295)이 끝난 뒤 이 자리를 대신한다.

### catbooks 백엔드로 바로 띄워 보기
ax-backend에 API가 생기기 전에는 catbooks 백엔드(FastAPI, 8000) 하나로 두 앱을 모두 돌릴 수 있다.

```bash
# iTshirt-cat/backend
CORS_ORIGINS=http://localhost:3000,http://localhost:3001 LLM_PROVIDER=mock uvicorn app.main:app --port 8000
# ax-frontend 루트 .env
VITE_SHOP_API_URL=http://localhost:8000
VITE_DASHBOARD_API_URL=http://localhost:8000
```

## 3. API 타입
`@ax/types`(루트 `types/`, 자동 생성)에서 가져오는 것이 원칙이다.
**임시:** ax-backend shop-api에 아직 아래 엔드포인트가 없어서(`/health`만 있음) catbooks의 타입을 `src/lib/types.ts`에 그대로 옮겨 두었다.
shop-api가 이 API를 열고 `npm run gen:types`로 타입이 생기면 `src/lib/types.ts`를 지우고 `@ax/types/shop-api`로 바꾼다.

호출 경로는 모두 `src/lib/api.ts` 한 곳에 있다. 응답은 ax-backend 규약 `{data, meta}` / `{error: {code, message}}`와 catbooks 백엔드(FastAPI 본문 그대로 / `{detail}`) 둘 다 받는다.

| 메서드 | 경로 |
| --- | --- |
| GET | `/api/health`, `/api/users`, `/api/me`, `/api/categories` |
| GET | `/api/products?category&q&sort`, `/api/products/{id}` |
| POST | `/api/reviews`, `/api/reviews/{id}/helpful` |
| POST | `/api/cart/price` |
| GET·POST | `/api/orders`, GET `/api/orders/{id}`, POST `/api/orders/{id}/advance`(데모 배송 진행) |
| GET·POST | `/api/claims`, POST `/api/claims/preview`, `/api/claims/{id}/evidence`, `/api/claims/{id}/withdraw` |
| GET·POST | `/api/inquiries`, GET `/api/inquiries/{id}`, POST `/api/inquiries/{id}/messages` |

ax-backend 경로 규약(`/api/<부서>/<복수 명사>`)에 맞추려면 백엔드 경로가 정해진 뒤 `api.ts`의 경로 문자열만 바꾸면 된다.

## 4. common-frontend
`@dejafix/common-frontend`를 git 태그(`git+https://github.com/DejaFix/common-frontend.git#v0.1.0`)로 설치해 두었다.
TODO: common-frontend 버전 태그로 설치 (AppShell 메뉴에 부서 항목, 색은 토큰만)
— 진입점에서 `import '@dejafix/common-frontend/styles.css'` 후 `AppShell`로 감싼다. 색은 디자인 토큰(CSS 변수)만 쓰고 직접 색 값을 넣지 않는다.

**현재 상태:** catbooks 화면은 자체 Tailwind 설정(`tailwind.config.ts`)과 `src/styles.css`의 CSS 변수(라이트·다크)로 그린다. 색 값은 모두 CSS 변수를 거치지만 common-frontend 토큰은 아직 쓰지 않는다.
두 스타일을 한 번에 섞으면 `.btn`·`.card`·`.chip` 클래스 이름이 겹치므로, common-frontend 적용은 별도 PR로 한다.
