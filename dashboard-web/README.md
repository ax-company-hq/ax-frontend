# dashboard-web

담당: 병환 · 포트: 3001 · 연결 API: dashboard-api (8020)

## 1. 역할
(TODO: 담당자가 작성)

## 2. 실행 방법
레포 루트에서:

```bash
npm install
npm run dev -w dashboard-web        # http://localhost:3001
npm run build -w dashboard-web
```

API 주소는 루트 `.env`의 `VITE_DASHBOARD_API_URL`로 정한다.

## 3. API 타입
`@ax/types`(루트 `types/`, 자동 생성)에서 가져온다. 손으로 API 타입을 만들지 않는다.

## 4. common-frontend
`@dejafix/common-frontend`를 git 태그(`git+https://github.com/DejaFix/common-frontend.git#v0.1.0`)로 설치해 두었다.
TODO: common-frontend 버전 태그로 설치 (AppShell 메뉴에 부서 항목, 색은 토큰만)
— 진입점에서 `import '@dejafix/common-frontend/styles.css'` 후 `AppShell`로 감싼다. 색은 디자인 토큰(CSS 변수)만 쓰고 직접 색 값을 넣지 않는다.
