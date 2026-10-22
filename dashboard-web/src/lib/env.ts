// 루트 .env (VITE_*) 값. 없으면 로컬 기본 포트를 쓴다.
export const DASHBOARD_API_URL = import.meta.env.VITE_DASHBOARD_API_URL ?? 'http://localhost:8020'
/** 상단 '쇼핑몰 보기' 링크가 여는 shop-web 주소 */
export const SHOP_WEB_URL = import.meta.env.VITE_SHOP_WEB_URL ?? 'http://localhost:3000'
/** 재무·안전 화면: 안전 레이어(safety, 8001)와 재무 에이전트(finance, 8105) 조회 API */
export const SAFETY_API_URL = import.meta.env.VITE_SAFETY_API_URL ?? 'http://localhost:8001'
export const FINANCE_AGENT_URL = import.meta.env.VITE_FINANCE_AGENT_URL ?? 'http://localhost:8105'
/** C 보류 결정에 쓰는 사람 토큰. 목 모드 데모는 `human:<이름>`. 비어 있으면 결정 버튼을 끈다 */
export const SAFETY_HUMAN_TOKEN = import.meta.env.VITE_SAFETY_HUMAN_TOKEN ?? ''
