import { ApiError } from "./apiError";
import { FINANCE_AGENT_URL, SAFETY_API_URL, SAFETY_HUMAN_TOKEN } from "./env";

// 재무·안전 화면 → safety(8001) · finance(8105) 조회 API. 응답은 ax-backend 규약 {data, meta}.
// 임시: OpenAPI 타입이 contracts/openapi/에 생기기 전이라 safety·finance README의 형식을 여기 옮겨 둔다.

export type Grade = "A" | "B" | "C";
export type ExecStatus = "executed" | "verifying" | "held" | "rejected" | "failed";

export interface ExecuteDecision {
  execution_id: string;
  grade: Grade;
  status: ExecStatus;
  computed_amount: number | null;
  threshold_version: number | null;
  verifier: string | null;
  hold_reason: string | null;
  review_id: string | null;
}

export interface ExecutionRecord {
  execution_id: string;
  created_at: string;
  request: { action: string; requester: string; context_id: string; params: Record<string, unknown>; claimed_grade: string | null };
  decision: ExecuteDecision;
  customer: string | null;
}

export interface RuleHit { key: string; observed?: number; op?: string; value?: number | string; outside?: string[]; invalid?: string }

export interface Review {
  review_id: string;
  execution_id: string;
  context_id: string;
  action: string;
  requester: string;
  created_at: string;
  expires_at: string;
  status: "pending" | "approved" | "rejected" | "expired";
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  report: { ai_review?: { result: "approve" | "reject" | "escalate"; reason_code: string; explanation: string }; totals?: Record<string, number | null>; calculation?: string; computed_amount?: number | null; hold_reason?: string; rules?: RuleHit[]; claimed?: Record<string, number>; reason?: string; verification?: { verifier: string; result: string } };
}

export interface Rule { key: string; action: string; metric: string; op: string; value: number; field: string | null; allowed: string[]; when: Record<string, unknown> }
export interface Thresholds { version: number; verify_timeout_seconds: number; review_timeout_seconds: number; rules: Rule[] }

export interface Verification {
  execution_id: string;
  context_id: string;
  action: string;
  requester: string;
  decision: "approved" | "rejected";
  reason_code: string;
  recomputed: Record<string, number>;
  at: string;
}

export interface MarketOp { skill: "seller_review" | "settlement_hold"; seller_id: string; decision?: string; status?: string; risk_score?: number | null; reason_code: string; review_id: string | null; at: string }
export interface LossReport {
  context_id: string;
  failed_orders: number | null;
  affected_customers: number | null;
  lost_amount: number | null;
  compensation_coupon_count: number;
  compensation_total: number;
  total_loss: number | null;
  summary: string;
  at: string;
}
/** 사람 대신 결정한 주체. safety Review.decided_by 값 */
export const AI_REVIEWER = "finance-ai";
export const RULE_REVIEWER = "auto-rule";
export const isMachine = (by: string | null | undefined) => by === AI_REVIEWER || by === RULE_REVIEWER;

export interface SelfTestCheck { name: string; ok: boolean; detail: string; level: "fail" | "warn" }
export interface SelfTest {
  result: "pass" | "warn" | "fail";
  summary: string;
  checks: SelfTestCheck[];
  passed: number;
  total: number;
  duration_ms: number;
  ran_at: string;
}

export interface Ledger { compensation: { context_id: string; count: number; total: number }[]; refunds: { order_id: string; refunded: number }[] }

export interface Skill { id: string; description: string; grade: "read" | Grade; allowed_requesters: string[]; verifier: string | null; priority: string }
export interface AgentCard { name: string; owner: string; description: string; version: string; skills: Skill[] }

async function get<T>(base: string, path: string, raw = false): Promise<T> {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error?.message ?? `요청 실패 (${res.status})`, res.status);
  return (raw ? body : body.data) as T;
}

export const humanTokenSet = SAFETY_HUMAN_TOKEN.length > 0;

export const finance = {
  safetyHealth: () => get<{ status: string }>(SAFETY_API_URL, "/health"),
  financeHealth: () => get<{ status: string }>(FINANCE_AGENT_URL, "/health"),
  card: () => get<AgentCard>(FINANCE_AGENT_URL, "/.well-known/agent-card.json", true),
  executions: () => get<ExecutionRecord[]>(SAFETY_API_URL, "/api/safety/executions"),
  reviews: () => get<Review[]>(SAFETY_API_URL, "/api/safety/reviews"),
  thresholds: () => get<Thresholds>(SAFETY_API_URL, "/api/safety/thresholds"),
  verifications: () => get<Verification[]>(FINANCE_AGENT_URL, "/api/finance/verifications"),
  ledger: () => get<Ledger>(FINANCE_AGENT_URL, "/api/finance/ledger"),
  marketOps: () => get<MarketOp[]>(FINANCE_AGENT_URL, "/api/finance/market-ops"),
  lossReports: () => get<LossReport[]>(FINANCE_AGENT_URL, "/api/finance/loss-reports"),
  /** 재무 AI 테스트 버튼: 가짜 자료로 판단을 점검하고 연결을 확인한다(상태를 바꾸지 않음) */
  selfTest: () => get<SelfTest>(FINANCE_AGENT_URL, "/api/finance/self-test"),
  lastSelfTest: () => get<SelfTest | null>(FINANCE_AGENT_URL, "/api/finance/self-test/last"),
  /** C 보류 결정. 사람 토큰만 받는다 (에이전트 토큰은 safety가 거부). */
  decide: async (reviewId: string, decision: "approved" | "rejected", note?: string) => {
    const res = await fetch(`${SAFETY_API_URL}/api/safety/reviews/${reviewId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SAFETY_HUMAN_TOKEN}` },
      body: JSON.stringify({ decision, note: note || null }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.error?.message ?? `결정 실패 (${res.status})`, res.status);
    return body.data as Review;
  },
};
