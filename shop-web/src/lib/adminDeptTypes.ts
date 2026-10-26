// 부서 카드·사용량 응답 (총괄 `GET /api/departments`를 shop-api가 그대로 전달).
// ax-backend `orchestrator/src/ax_orchestrator/main.py`의 `departments()` 기준.
// 사용량은 총괄이 부른 호출을 센 실측이다. 값이 없으면 null이고 화면은 "확인할 수 없음"으로 보여 준다.
export interface UsageSummary {
  calls: number;
  errors: number;
  waiting: number;
  success_rate: number | null;
  avg_ms: number | null;
  p95_ms: number | null;
  retries: number;
  last_called_at: string | null;
}
export interface UsageBucket {
  t: string;
  calls: number;
  errors: number;
  avg_ms: number | null;
}
export interface DeptSkill {
  id: string;
  grade: string;
  priority: string;
  orchestrator: boolean;
  calls: number;
  errors: number;
  success_rate: number | null;
  avg_ms: number | null;
  retries: number;
  series: UsageBucket[];
}
export interface RecentCall {
  at: string;
  skill: string;
  status: string;
  outcome: string | null;
  duration_ms: number;
  context_id: string;
}
export interface Department {
  name: string;
  owner: string | null;
  mode: "real" | "mock";
  available: boolean;
  unavailable_reason: string | null;
  skills: DeptSkill[];
  usage: UsageSummary;
  series: UsageBucket[];
  recent: RecentCall[];
}
export interface DepartmentsMeta {
  mock?: boolean;
  window_seconds?: number;
  bucket_seconds?: number;
}
