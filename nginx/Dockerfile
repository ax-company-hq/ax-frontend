# 게이트웨이 이미지: 세 앱을 빌드해 정적 파일로 담고 nginx 하나가 한 포트로 서빙한다.
# 빌드 컨텍스트는 ax-frontend 레포 루트: docker build -f nginx/Dockerfile .
# ax-backend의 infra/compose.yml이 이 파일로 gateway를 빌드한다.
# (공용 UI 패키지가 저장소 주소 의존성이라 소스 관리 도구가 들어 있는 Debian 기반 이미지를 쓴다)
FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY types/package.json types/
COPY shop-web/package.json shop-web/
COPY dashboard-web/package.json dashboard-web/
COPY planning-web/package.json planning-web/
RUN npm ci --no-audit --no-fund

COPY . .
# 게이트웨이 경로 기준 값. 같은 출처의 상대 경로라 서버 PC 주소가 바뀌어도 다시 빌드하지 않는다.
# 관리자 데모 비밀번호는 번들에 들어가므로 실제 인증이 아니다.
ARG VITE_SHOP_API_URL=/shop-api
# 빈 값 = 같은 출처. dashboard-web의 api.ts가 경로에 /api/dashboard/...를 직접 붙이므로 /api를 넣으면 /api/api/...가 된다
ARG VITE_DASHBOARD_API_URL=
ARG VITE_SHOP_WEB_URL=/
ARG VITE_DASHBOARD_WEB_URL=/admin/
ARG VITE_PLANNING_WEB_URL=/admin/planning/
# 재무 화면의 safety·재무 직접 호출은 비운다 (#255·#259 전에는 서버 배포에서 동작하지 않음)
ARG VITE_SAFETY_API_URL=
ARG VITE_FINANCE_AGENT_URL=
ARG VITE_ADMIN_LOGIN=on
ARG VITE_ADMIN_DEMO_PASSWORD=catbooks
ENV VITE_SHOP_API_URL=$VITE_SHOP_API_URL \
    VITE_DASHBOARD_API_URL=$VITE_DASHBOARD_API_URL \
    VITE_SHOP_WEB_URL=$VITE_SHOP_WEB_URL \
    VITE_DASHBOARD_WEB_URL=$VITE_DASHBOARD_WEB_URL \
    VITE_PLANNING_WEB_URL=$VITE_PLANNING_WEB_URL \
    VITE_SAFETY_API_URL=$VITE_SAFETY_API_URL \
    VITE_FINANCE_AGENT_URL=$VITE_FINANCE_AGENT_URL \
    VITE_ADMIN_LOGIN=$VITE_ADMIN_LOGIN \
    VITE_ADMIN_DEMO_PASSWORD=$VITE_ADMIN_DEMO_PASSWORD \
    DASHBOARD_WEB_BASE=/admin/ \
    PLANNING_WEB_BASE=/admin/planning/ \
    VITE_PLANNING_MOCK=0
# 재무 화면: VITE_SAFETY_API_URL·VITE_FINANCE_AGENT_URL을 위에서 일부러 비웠다 (상대 경로로 호출되어 실패하며 localhost로 새지 않는다).
# ax-backend #255·#259(dashboard-api 경유)가 머지되고 화면이 그 경로로 바뀌기 전에는 서버 배포에서 동작하지 않는다.
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/shop-web/dist /srv/shop
COPY --from=build /app/dashboard-web/dist /srv/admin
COPY --from=build /app/planning-web/dist /srv/planning
COPY nginx/gateway.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
