// 루트 .env (VITE_*) 값. 없으면 로컬 기본 포트를 쓴다.
export const SHOP_API_URL = import.meta.env.VITE_SHOP_API_URL ?? 'http://localhost:8010'
/** 상단 '상담원 콘솔' 링크가 여는 dashboard-web 주소 */
export const DASHBOARD_WEB_URL = import.meta.env.VITE_DASHBOARD_WEB_URL ?? 'http://localhost:3001'
