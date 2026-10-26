// 루트 .env (VITE_*) 값. 없으면 로컬 기본 포트를 쓴다.
export const SHOP_API_URL = import.meta.env.VITE_SHOP_API_URL ?? 'http://localhost:8010'
/** 상단 '상담원 콘솔' 링크가 여는 dashboard-web 주소 */
export const DASHBOARD_WEB_URL = import.meta.env.VITE_DASHBOARD_WEB_URL ?? 'http://localhost:3001'
/**
 * 개발용 관리자 모드(임시). 값이 있을 때만 관리자 탭이 나타나고 이 토큰으로 shop-api 관리 API를 부른다.
 * 목 모드 데모용(`mock:admin`)이다. 비우면(기본) 관리자 기능은 완전히 꺼진다.
 * 진짜 관리자 로그인(소유자·공동소유자·분야 관리자)은 사람 인증(#265·#295)이 끝난 뒤 이 자리를 대신한다.
 */
export const ADMIN_DEMO_TOKEN: string = (import.meta.env.VITE_SHOP_ADMIN_TOKEN ?? '').trim()
export const ADMIN_ENABLED = ADMIN_DEMO_TOKEN !== ''
/** 관리 API 주소. 판매 API와 같은 서버(shop-api)면 비워 두고, catbooks 백엔드로 판매 화면을 띄울 때는 shop-api 주소를 넣는다 */
export const ADMIN_API_URL: string = import.meta.env.VITE_SHOP_ADMIN_API_URL ?? SHOP_API_URL
