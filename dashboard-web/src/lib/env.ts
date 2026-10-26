// 루트 .env (VITE_*) 값. 없으면 로컬 기본 포트를 쓴다.
export const DASHBOARD_API_URL = import.meta.env.VITE_DASHBOARD_API_URL ?? 'http://localhost:8020'
/** 상단 '쇼핑몰 보기' 링크가 여는 shop-web 주소 */
export const SHOP_WEB_URL = import.meta.env.VITE_SHOP_WEB_URL ?? 'http://localhost:3000'
/** 재무·안전 화면: 안전 레이어(safety, 8001)와 재무 에이전트(finance, 8105) 조회 API */
export const SAFETY_API_URL = import.meta.env.VITE_SAFETY_API_URL ?? 'http://localhost:8001'
export const FINANCE_AGENT_URL = import.meta.env.VITE_FINANCE_AGENT_URL ?? 'http://localhost:8105'
/** C 보류 결정에 쓰는 사람 토큰. 목 모드 데모는 `human:<이름>`. 비어 있으면 결정 버튼을 끈다 */
export const SAFETY_HUMAN_TOKEN = import.meta.env.VITE_SAFETY_HUMAN_TOKEN ?? ''
/** AI 대화방: 총괄(orchestrator, 8000) 주소. 총괄은 CORS가 없어 기본값은 Vite 개발 프록시(/orch → vite.config.ts) */
export const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL ?? '/orch'
/** 상단 '기획개발' 링크가 여는 planning-web 주소. 게이트웨이에서는 `/admin/planning/` */
export const PLANNING_WEB_URL = import.meta.env.VITE_PLANNING_WEB_URL ?? 'http://localhost:3002'
/** `on`이면 관리자 화면 앞에 데모 비밀번호 입력이 선다. 실제 인증이 아니다 (고객이 실수로 들어오지 않게 하는 정도) */
export const ADMIN_LOGIN = import.meta.env.VITE_ADMIN_LOGIN === 'on'
export const ADMIN_DEMO_PASSWORD = import.meta.env.VITE_ADMIN_DEMO_PASSWORD ?? 'catbooks'
