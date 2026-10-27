import { ApiError } from "./apiError";
import { DASHBOARD_API_URL, SAFETY_HUMAN_TOKEN } from "./env";

// 인사 AI 화면 → dashboard-api(/api/dashboard/...). 응답은 ax-backend 규약 {data, meta}.
// 모양은 ax-backend contracts/hr.py 모델 그대로다. 화면은 hr이 계산한 값을 다시 계산하지 않는다.

export type HandoverStatus = "draft" | "input_required" | "ready" | "confirmed" | "held";
export type HandoverReason = "shift" | "transfer" | "offboarding" | "other";

export interface HandoverQuestion {
  question_id: string;
  context_id: string;
  assignee_id: string;
  question: string;
  gap_field: string;
}
export interface HandoverItem { item_id: string; kind: string; title: string; source_ref: string }
export interface HandoverView {
  handover_id: string;
  context_id: string;
  owner_id: string;
  successor_id: string | null;
  area: string;
  reason: HandoverReason;
  status: HandoverStatus;
  completeness: number;
  items: HandoverItem[];
  open_questions: HandoverQuestion[];
  created_at: string;
  updated_at: string;
}
export interface AnswerResult {
  handover_id: string;
  status: HandoverStatus;
  completeness: number;
  remaining_questions: HandoverQuestion[];
}

export interface HrCard {
  card_id: string;
  kind: string;
  title: string;
  body: string;
  status: string;
  confidence: "low" | "mid" | "high" | null;
  author: string;
  context_id: string;
  created_at: string;
  tags: string[];
  extra: Record<string, unknown>;
}
export interface RosterEntry { area: string; role: "owner" | "backup"; member_id: string; shift_start: string | null; shift_end: string | null }
export interface Roster { entries: RosterEntry[]; gap_areas: string[]; collected_at: string }
export interface AuditEntry { seq: number; at: string; kind: string; payload: Record<string, unknown> }
export interface PlanFinding { code: string; level: string; message: string; card_ids: string[] }
export interface PlanCheck {
  verdict: "ok" | "warn" | "block" | string;
  findings: PlanFinding[];
  no_related_cards: boolean;
  similar_cards: { card_id: string; status: string; summary: string }[];
  computed: Record<string, unknown>;
}
export interface PlanDraft { title: string; summary: string; area: string; kind: "spec" | "ticket" | "deploy_plan" }

// 쓰기 요청(GET 외)에는 사람 토큰을 붙인다(ax-backend#381 이후 dashboard-api가 요구). `/plan-checks`는
// 저장하지 않는 조회라 붙이지 않는다. 토큰은 환경변수에서만 오고 브라우저 저장소에 두지 않는다.
const humanAuth = (path: string, method?: string): Record<string, string> =>
  method && method !== "GET" && !path.startsWith("/plan-checks") && SAFETY_HUMAN_TOKEN
    ? { Authorization: `Bearer ${SAFETY_HUMAN_TOKEN}` } : {};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DASHBOARD_API_URL}/api/dashboard${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...humanAuth(path, init?.method), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  let body: { data?: T; error?: { message?: string } } | null = null;
  try { body = await res.json(); } catch { /* 본문이 JSON이 아님 */ }
  if (!res.ok) throw new ApiError(body?.error?.message ?? `요청 실패 (${res.status})`, res.status);
  return (body?.data ?? null) as T;
}
const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

/** 답변 전체의 짧은 해시(djb2). 같은 답은 같은 키, 다른 답은 다른 키가 되게 한다 */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const hr = {
  handovers: (status?: HandoverStatus) => call<HandoverView[]>(`/handovers${status ? `?status=${status}` : ""}`),
  questions: () => call<HandoverQuestion[]>("/handover-questions"),
  answer: (questionId: string, answer: string) =>
    post<AnswerResult>(`/handover-questions/${encodeURIComponent(questionId)}/answer`, {
      question_id: questionId,
      answer,
      idempotency_key: `ui:${questionId}:${hash(answer)}`, // 답변 전체의 해시라 앞부분이 같은 다른 답과 겹치지 않는다
    }),
  candidateCards: () => call<HrCard[]>("/candidate-cards"),
  decide: (cardId: string, decision: "approve" | "reject") =>
    post<{ card_id: string; status: string }>(`/candidate-cards/${encodeURIComponent(cardId)}/decision`, { decision }),
  roster: () => call<Roster>("/roster"),
  activity: (contextId: string) => call<AuditEntry[]>(`/hr-activity/${encodeURIComponent(contextId)}`),
  checkPlan: (draft: PlanDraft) => post<PlanCheck>("/plan-checks", { draft }),
};
