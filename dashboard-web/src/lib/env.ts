// 루트 .env (VITE_*) 값. 없으면 로컬 기본 포트를 쓴다.
export const DASHBOARD_API_URL = import.meta.env.VITE_DASHBOARD_API_URL ?? 'http://localhost:8020'
/** 상단 '쇼핑몰 보기' 링크가 여는 shop-web 주소 */
export const SHOP_WEB_URL = import.meta.env.VITE_SHOP_WEB_URL ?? 'http://localhost:3000'
