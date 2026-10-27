# shop-web

담당: 재헌 · 포트: 3000 · 연결 API: shop-api (8010)

## 1. 역할
캣북스(catbooks) 데모 서점의 판매 사이트. [`bxbae/iTshirt-cat`](https://github.com/bxbae/iTshirt-cat)의 Next.js 프론트엔드에서 Vite로 옮겨 왔고, 지금은 **우리 shop-api(`/api/shop/*`, 8010)만** 부른다(캣북스 백엔드는 쓰지 않는다).
상품 목록·상세, 장바구니, 주문·가짜 결제, 주문 내역, 취소·반품·교환 신청(고객지원이 판정)을 한다.
로그인은 없다: `/login`에서 구매자 가명 ID(`buy_0001`~`buy_0030`)를 고르면 주문 요청 본문의 `buyer_id`로 실린다(sessionStorage 보관).

| 경로 | 화면 |
| --- | --- |
| `/` | 홈 |
| `/products`, `/products/:id` | 상품 목록(카테고리·검색·가격 정렬), 상세 |
| `/cart`, `/checkout` | 장바구니(브라우저 저장), 주문·결제 |
| `/login` | 구매자 선택(가명 ID) |
| `/orders`, `/orders/:id` | 주문 내역, 주문 상세(결제·취소·클레임 신청) |
| `/support` | 고객센터(1:1 문의는 준비 중) |

## 2. 실행 방법
shop-api를 먼저 띄운다(ax-backend 레포):

```bash
docker compose -f infra/compose.yml up -d shop-api   # http://localhost:8010
```

ax-frontend 루트에서:

```bash
npm ci
npm run dev:shop               # http://localhost:3000
npm run build -w shop-web
```

API 주소는 루트 `.env`의 `VITE_SHOP_API_URL`(기본 `http://localhost:8010`)로 정한다. shop-api가 꺼져 있으면 홈에 "판매 서버(shop-api, 주소)에 연결할 수 없습니다"가 보인다.
브라우저가 직접 부르므로 shop-api의 CORS(`SHOP_CORS_ORIGINS`, 기본 `localhost:3000`)에 이 주소가 들어 있어야 한다.

## 3. API
호출 경로는 모두 `src/lib/api.ts` 한 곳에 있다. 응답은 `{data, meta}` / `{error: {code, message}}`이고, 모델은 `src/lib/types.ts`에 있다(ID는 `prd_`·`ord_`·`oit_`·`buy_` 문자열).
**임시:** shop-api가 OpenAPI 타입을 열고 `npm run gen:types`로 타입이 생기면 `src/lib/types.ts`를 지우고 `@ax/types/shop-api`로 바꾼다.

| 메서드 | 경로 | 화면 |
| --- | --- | --- |
| GET | `/api/shop/products?category_code`, `/api/shop/products/{id}` | 상품 목록·상세 |
| GET | `/api/shop/orders?buyer_id`, `/api/shop/orders/{id}` | 주문 내역·상세 |
| POST | `/api/shop/orders` | 주문 생성(`pending_payment`, 합계·배송비는 서버 계산) |
| POST | `/api/shop/orders/{id}/payments` | 가짜 결제 |
| POST | `/api/shop/orders/{id}/cancel` | 결제 전 주문 취소 |
| POST | `/api/shop/claims` | 취소·반품·교환 신청(고객지원으로 전달) |

### 준비 중인 기능 (ax-backend#385 결과를 기다림)
shop-api에 아직 없어서 화면에서 오류 대신 "준비 중" 안내를 보여 준다. 코드에는 `TODO(ax-backend#385)`가 붙어 있고, 연결 자리는 `api.ts` 아래쪽 스텁(`demoUsers`·`categories`·`cartPrice`·`previewClaim`·`claims`·`inquiries`·`reviews`)이다.

- 이름·적립금이 있는 데모 로그인 (지금은 구매자 가명 ID 선택)
- 카테고리 목록 (지금은 상품의 `category_code`를 화면에서 묶음), 판매량순·신상품순 정렬, 서버 검색
- 장바구니 가격(배송비·합계) 미리보기, 적립금 사용
- 클레임 환불액 미리보기, 신청 내역 조회·철회·사진 추가
- 1:1 문의, 구매 후기

### 상품 표지 사진
상품 표지는 `shop-web/public/covers/<product_id>.jpg`(예: `prd_0001.jpg`, png·webp도 됨)에 파일을 두면 사진으로 나오고, 파일이 없거나 불러오지 못하면 상품마다 색으로 만든 제목 카드(`Cover.tsx`)로 돌아간다. 비율은 책 3:4, 문구·굿즈 1:1로 잘리므로 같은 비율로 준비한다. 사진은 상업적으로 써도 되는 라이선스(직접 촬영, Unsplash·Pexels·Pixabay 등)만 쓰고, 출처와 라이선스는 PR 설명에 적는다.

## 4. common-frontend
`@dejafix/common-frontend`를 git 태그(`git+https://github.com/DejaFix/common-frontend.git#v0.1.0`)로 설치해 두었다.
TODO: common-frontend 버전 태그로 설치 (AppShell 메뉴에 부서 항목, 색은 토큰만)
— 진입점에서 `import '@dejafix/common-frontend/styles.css'` 후 `AppShell`로 감싼다. 색은 디자인 토큰(CSS 변수)만 쓰고 직접 색 값을 넣지 않는다.

**현재 상태:** catbooks 화면은 자체 Tailwind 설정(`tailwind.config.ts`)과 `src/styles.css`의 CSS 변수(라이트·다크)로 그린다. 색 값은 모두 CSS 변수를 거치지만 common-frontend 토큰은 아직 쓰지 않는다.
두 스타일을 한 번에 섞으면 `.btn`·`.card`·`.chip` 클래스 이름이 겹치므로, common-frontend 적용은 별도 PR로 한다.
