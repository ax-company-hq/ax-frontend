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
/** `baseline`: TOML 원래 값. 바꿀 수 있는 기준만 들어 있다 (숫자 규칙 + review_timeout_seconds) */
export interface Thresholds { version: number; verify_timeout_seconds: number; review_timeout_seconds: number; rules: Rule[]; baseline?: Record<string, number> }

/** 기준 바꾸기 요청 (safety `/api/safety/threshold-changes`). 안전 장치 → 재무 AI → 필요하면 사람 */
export type ThresholdChangeStatus = "pending" | "applied" | "rejected";
export interface ThresholdChange {
  change_id: string;
  key: string;
  old_value: number | null;
  new_value: number;
  baseline: number | null;
  reason: string;
  requested_by: string;
  status: ThresholdChangeStatus;
  /** "guardrail"(안전 장치 범위 밖) | "finance-ai" | 사람 이름 */
  decided_by: string | null;
  explanation: string;
  created_at: string;
  decided_at: string | null;
  version_after: number | null;
  ai_review: { result?: "approve" | "reject" | "escalate"; reason_code?: string; explanation?: string };
  stats: { holds_24h?: number; executed_today?: number; ai_approved_24h?: number; human_approved_24h?: number; expired_24h?: number; action?: string | null };
}
export const GUARDRAIL = "guardrail";

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

/** 캣북스(쇼핑몰)에서 들어온 환불·교환·보상 신청을 재무 AI가 확인한 결과 */
export type CatbooksResult = "pass" | "blocked" | "needs_human";
export interface CatbooksItem {
  id: string;
  claim_id: number;
  order_id: number;
  order_no: string | null;
  customer: string | null;
  type: string;
  type_ko: string;
  reason: string;
  catbooks_status: string;
  catbooks_status_ko: string;
  refund_amount: number;
  points_back: number;
  compensation: number;
  paid_amount: number | null;
  refunded_before: number;
  queue_position: number | null;
  queue_ready: boolean;
  needs_safety: boolean;
  result: CatbooksResult;
  result_ko: string;
  reason_code: string;
  explanation: string;
  created_at: string | null;
  checked_at: string;
}
export interface CatbooksSync {
  ok: boolean;
  error: string | null;
  synced_at?: string;
  tried_at: string;
  source: string;
  total?: number;
  counts?: Record<CatbooksResult, number>;
}
export interface CatbooksItems { data: CatbooksItem[]; meta: { count: number; sync: CatbooksSync | null; poll_seconds: number } }

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

/** 사람 토큰으로 safety에 POST. 실패하면 서버의 쉬운 말 메시지를 그대로 던진다. */
async function postHuman<T>(path: string, payload: unknown, failLabel: string): Promise<T> {
  const res = await fetch(`${SAFETY_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SAFETY_HUMAN_TOKEN}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.error?.message ?? (res.status === 422 ? "입력한 값을 확인하세요. 새 값은 정수여야 합니다." : null);
    throw new ApiError(message ?? `${failLabel} (${res.status})`, res.status);
  }
  return body.data as T;
}

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
  /** 캣북스에서 들어온 처리할 일 (재무 AI가 확인한 결과, 최근 신청 먼저) */
  catbooksItems: () => get<CatbooksItems>(FINANCE_AGENT_URL, "/api/finance/catbooks/items", true),
  /** 지금 가져오기: 재무 AI가 캣북스를 읽어서(읽기만) 다시 확인한다 */
  catbooksSync: () => get<CatbooksSync>(FINANCE_AGENT_URL, "/api/finance/catbooks/sync"),
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
  /** 기준 바꾸기 기록 (최근 것부터) */
  thresholdChanges: () => get<ThresholdChange[]>(SAFETY_API_URL, "/api/safety/threshold-changes"),
  /** 기준 바꾸기 요청. 안전 장치 범위 밖이면 바로 rejected, 안이면 재무 AI가 결정 (applied/pending/rejected) */
  requestThresholdChange: (key: string, newValue: number, reason: string) =>
    postHuman<ThresholdChange>("/api/safety/threshold-changes", { key, new_value: newValue, reason }, "기준 바꾸기 요청 실패"),
  /** 재무 담당자를 기다리는 기준 바꾸기 승인·거절. 사람 토큰만 */
  decideThresholdChange: (changeId: string, decision: "approved" | "rejected", note?: string) =>
    postHuman<ThresholdChange>(`/api/safety/threshold-changes/${changeId}/decision`, { decision, note: note || null }, "결정 실패"),
};
