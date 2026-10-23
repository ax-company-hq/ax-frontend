import type { ExecutionRecord } from "./finance";

// AI 대화방: 총괄(orchestrator)의 사건 기록과 안전 관문(safety)의 실행 기록을
// "누가 누구에게 무엇을 보냈나" 메시지로 바꾼다. 문장은 기록된 값(skill·상태·숫자·id)으로만 만들고
// 부서가 돌려준 자유 문장(summary·note·untrusted 등)은 화면에 옮기지 않는다. 화면 없는 순수 함수만 둔다.

// ---------------------------------------------------------------- 총괄 JSON (ax-backend orchestrator models.py view())
export type StepStatus = "pending" | "running" | "held" | "completed" | "failed" | "skipped" | "rejected_by_human";

export interface OrchStep {
  step_id: string;
  skill: string;
  label: string;
  dept: string | null;
  status: StepStatus | string;
  attempts: number;
  note: string;
  grade: string | null;
  started_at: string | null;
  finished_at: string | null;
  transferred_to: string | null;
  reason_code: string | null;
  output: Record<string, unknown>;
}

export interface OrchIncident {
  context_id: string;
  kind: string;
  title: string;
  component: string;
  status: "open" | "resolved" | "degraded" | string;
  opened_at: string | null;
  closed_at: string | null;
  steps: OrchStep[];
  events: { at: string | null; message: string }[];
  summary: string[];
  metrics: Record<string, number>;
  pending_holds: { step_id: string; skill: string; label: string }[];
}

/** POST /api/demo/incidents 본문 (main.py DemoRequest). 모두 선택 */
export interface DemoRequest {
  hold_coupon?: boolean;
  fail_marketing?: boolean;
  wrong_owner?: boolean;
  infra_card_empty?: boolean;
}

// ---------------------------------------------------------------- 이름표
export const DEPT_KO: Record<string, string> = {
  orchestrator: "중앙 Agent(총괄)", planning: "기획개발", support: "고객지원", marketing: "마케팅", hr: "인사",
  finance: "재무", data: "데이터분석", infra: "인프라", safety: "안전 관문", memory: "회사 기억", "shop-api": "판매 사이트",
};
const NOT_AGENT = new Set(["orchestrator", "safety", "memory", "shop-api"]);
/** 말하는 쪽 이름. 부서는 "{부서} Agent", 총괄·안전 관문 등은 그대로 */
export function speaker(dept: string | null | undefined): string {
  if (!dept) return "담당 미정";
  const ko = DEPT_KO[dept] ?? dept;
  return NOT_AGENT.has(dept) ? ko : `${ko} Agent`;
}

export const INCIDENT_STATUS_KO: Record<string, string> = { open: "진행 중", resolved: "해결", degraded: "일부 미완료" };

// 사건 이름. 총괄은 "payment 장애 감지 (error_rate_5xx)"처럼 코드로 주므로 사람이 읽는 말로 바꾼다
const COMPONENT_KO: Record<string, string> = { payment: "결제", api: "판매 사이트", db: "주문 DB", search: "검색", shipping: "배송" };
const METRIC_KO: Record<string, string> = {
  error_rate_5xx: "서버 오류(5xx) 급증", p95_latency_ms: "응답 지연", order_fail_rate: "주문 실패율 상승", payment_fail_rate: "결제 실패율 상승",
};
/** 총괄 제목 끝의 "(metric)"에서 지표 코드를 꺼낸다 */
function metricOf(inc: OrchIncident): string | null {
  return /\(([^)]+)\)\s*$/.exec(inc.title)?.[1] ?? null;
}
/** 방 이름: "결제 장애 — 서버 오류(5xx) 급증" */
export function incidentTitle(inc: OrchIncident): string {
  const comp = COMPONENT_KO[inc.component] ?? inc.component;
  const metric = metricOf(inc);
  return metric ? `${comp} 장애 — ${METRIC_KO[metric] ?? metric}` : `${comp} 장애`;
}

const ACTION_KO: Record<string, string> = {
  issue_coupon: "쿠폰 지급", refund_request: "환불", confirm_settlement: "판매자 정산 확정",
  seller_review: "판매자 입점 승인", settlement_hold: "판매자 정산 멈춤", publish_notice: "공지 올리기",
  rollback_deployment: "배포 되돌리기", restart_service: "서비스 다시 켜기", generate_pr: "코드 변경 만들기",
  record_case: "사건 기록", send_reply: "고객 답변 보내기",
};
export const actionKo = (a: string) => ACTION_KO[a] ?? a;

const HOLD_WHY: Record<string, string> = {
  over_threshold: "금액 기준을 넘음", unregistered_action: "등록되지 않은 일", amount_mismatch: "적어 낸 금액과 계산이 다름",
  verify_rejected: "재무 AI가 거절함", verify_timeout: "확인하는 쪽이 응답하지 않음", schema_invalid: "요청 내용이 잘못됨",
  review_timeout: "기한 안에 결정이 없어 자동 취소",
};
export const holdWhy = (code: string | null | undefined) => (code ? HOLD_WHY[code] ?? code : "");

// ---------------------------------------------------------------- 메시지 모양
export type Tone = "request" | "ok" | "warn" | "fail" | "muted";

export interface Fact { label: string; value: string }

export type ChatItem =
  | { kind: "msg"; id: string; at: string; room: string; from: string; to: string; fromKey: string; central: boolean; text: string; tag?: string; tone: Tone; facts: Fact[] }
  | { kind: "system"; id: string; at: string; room: string; text: string }
  | { kind: "hold"; id: string; at: string; room: string; title: string; detail: string; state: "pending" | "approved" | "rejected" | "timeout"; contextId?: string; stepId?: string; link?: string }
  | { kind: "separator"; id: string; at: string; room: string; text: string; variant: "day" | "topic" };

export const SAFETY_ROOM = "safety";
export const ALL_ROOM = "all";

// ---------------------------------------------------------------- 안전한 결과 값만 고르기
const FIELD_KO: Record<string, string> = {
  failed_order_count: "실패 주문", affected_customer_count: "영향 고객", damage_amount: "피해 금액", affected_customer_ids: "영향 고객 id",
  suspects: "의심 배포", impact_scope: "영향 범위", status: "판정", rolled_back_to: "되돌린 버전", candidates: "후보 PR", linked_paras: "연결",
  notice_id: "공지 id", eligible_customer_ids: "보상 대상", amount_per_customer: "1인 금액", issued: "지급", total_amount: "총액",
  failed_orders: "실패 주문", affected_customers: "영향 고객", lost_amount: "매출 손실", compensation_coupon_count: "보상 쿠폰",
  compensation_total: "보상 합계", total_loss: "총 손실", recovered: "복구", infra_metrics_ok: "지표 정상", card_id: "기록 id",
};
const MONEY = /amount|total|loss|_won$/;
/** 부서가 쓴 자유 문장일 수 있는 키 — 절대 옮기지 않는다 */
const UNSAFE_KEYS = new Set(["untrusted", "summary", "note", "message", "text", "reason", "explanation", "question", "body", "title", "description"]);
/** id·버전·코드 모양만 통과 (공백·문장 불가) */
const SAFE_TOKEN = /^[A-Za-z0-9_.:#-]{1,40}$/;
const MAX_FACTS = 4;

const fmtNum = (n: number) => n.toLocaleString("ko-KR");

export function safeFacts(output: Record<string, unknown> | null | undefined): Fact[] {
  if (!output) return [];
  const facts: Fact[] = [];
  for (const [key, value] of Object.entries(output)) {
    if (facts.length >= MAX_FACTS) break;
    if (key.startsWith("_") || UNSAFE_KEYS.has(key)) continue;
    const label = FIELD_KO[key] ?? key;
    if (typeof value === "number" && Number.isFinite(value)) {
      facts.push({ label, value: MONEY.test(key) ? `${fmtNum(value)}원` : fmtNum(value) });
    } else if (typeof value === "boolean") {
      facts.push({ label, value: value ? "예" : "아니오" });
    } else if (typeof value === "string" && SAFE_TOKEN.test(value)) {
      facts.push({ label, value });
    } else if (Array.isArray(value)) {
      // 목록은 개수만. 단, 안전한 토큰 몇 개는 보여 준다 (PR 번호·버전 등)
      const tokens = value
        .map((v) => (typeof v === "number" ? `#${v}` : typeof v === "string" && SAFE_TOKEN.test(v) ? v : pickToken(v)))
        .filter((v): v is string => !!v);
      const shown = value.length <= 3 && tokens.length === value.length ? tokens.join(", ") : `${fmtNum(value.length)}건`;
      facts.push({ label, value: shown });
    }
  }
  return facts;
}

/** {number: 412} → "#412", {service, version} → "payment-api@v2.4.1" */
function pickToken(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.number === "number") return `#${o.number}`;
  const svc = typeof o.service === "string" && SAFE_TOKEN.test(o.service) ? o.service : null;
  const ver = typeof o.version === "string" && SAFE_TOKEN.test(o.version) ? o.version : null;
  if (svc && ver) return `${svc}@${ver}`;
  return svc ?? ver;
}

// ---------------------------------------------------------------- 총괄 사건 → 메시지
const CENTRAL = "orchestrator";

function transferFrom(inc: OrchIncident, step: OrchStep): string | null {
  // 엔진은 이관하면 step.dept를 새 부서로 바꾼다. 원래 부서는 이벤트 "label: A → B 이관(...)"에만 남는다.
  const ev = inc.events.find((e) => e.message.startsWith(`${step.label}: `) && e.message.includes(" 이관("));
  const m = ev?.message.match(/: (\S+) → (\S+) 이관/);
  return m ? m[1] : null;
}

function resultLine(step: OrchStep): { text: string; tone: Tone } {
  // 사람 승인 뒤 다시 보낸 1회는 재시도가 아니다 (engine._wait_human이 attempts를 올린다)
  const resumed = step.reason_code === "human_input" && step.status === "completed" ? 1 : 0;
  const retries = Math.max(step.attempts - 1 - resumed, 0);
  const retryTxt = retries > 0 ? ` (재시도 ${retries}회)` : "";
  switch (step.status) {
    case "completed":
      if (step.transferred_to) return { text: `이관받아 처리 완료했습니다.`, tone: "ok" };
      return { text: `${step.label} 완료했습니다.${retryTxt}`, tone: "ok" };
    case "failed": {
      if (step.note.startsWith("canceled")) return { text: `시간 안에 끝내지 못했습니다 — 시간 초과${retryTxt}.`, tone: "fail" };
      if (step.note.startsWith("이관")) return { text: `소관이 아니라고 답했고, 이관할 부서를 찾지 못했습니다.`, tone: "fail" };
      return { text: `실패했습니다${retries > 0 ? ` — ${retries}회 재시도 후 중단` : ""}.`, tone: "fail" };
    }
    case "rejected_by_human":
      return { text: step.note === "시간 초과로 자동 거절" ? "결정 기한이 지나 자동 거절되었습니다." : "사람이 거절해 진행하지 않았습니다.", tone: "warn" };
    case "held":
      return { text: "C 등급이라 사람 승인을 기다립니다. 보류 중입니다.", tone: "warn" };
    case "skipped":
      return { text: "건너뛰었습니다.", tone: "muted" };
    default:
      return { text: step.status, tone: "muted" };
  }
}

const SKIP_WHY: [RegExp, string][] = [
  [/^선행 단계 미완료/, "앞 단계가 끝나지 않아 건너뜀"],
  [/Agent Card에 skill 없음/, "맡을 부서를 찾지 못해 건너뜀 (Agent Card에 skill 없음)"],
  [/allowed_requesters/, "총괄이 요청할 수 없는 skill이라 건너뜀"],
  [/^고객 자료 대기/, "고객 자료를 기다려 보류"],
];

export function incidentItems(inc: OrchIncident): ChatItem[] {
  const room = inc.context_id;
  const out: ChatItem[] = [];
  const opened = inc.opened_at ?? inc.events[0]?.at ?? "";
  out.push({ kind: "separator", id: `${room}:sep`, at: opened, room, text: `${incidentTitle(inc)} · ${inc.context_id}`, variant: "topic" });
  out.push({ kind: "system", id: `${room}:open`, at: opened, room, text: `판매 사이트에서 ${incidentTitle(inc)} 신호가 와서 사건이 열렸습니다.` });

  for (const step of inc.steps) {
    const sid = `${room}:${step.step_id}`;
    if (step.status === "skipped" && !step.dept) {
      const why = SKIP_WHY.find(([re]) => re.test(step.note))?.[1] ?? "건너뜀";
      out.push({ kind: "system", id: `${sid}:skip`, at: step.finished_at ?? opened, room, text: `${step.label} — ${why}` });
      continue;
    }
    if (!step.started_at) continue;
    const original = step.transferred_to ? transferFrom(inc, step) ?? step.dept : step.dept;
    out.push({
      kind: "msg", id: `${sid}:req`, at: step.started_at, room, from: speaker(CENTRAL), to: speaker(original), fromKey: CENTRAL, central: true,
      text: `${step.label} 요청합니다.`, tag: step.skill + (step.grade && step.grade !== "read" ? ` · ${step.grade}등급` : ""), tone: "request", facts: [],
    });
    if (step.status === "skipped") {
      const why = SKIP_WHY.find(([re]) => re.test(step.note))?.[1] ?? "건너뜀";
      out.push({ kind: "system", id: `${sid}:skip`, at: step.finished_at ?? step.started_at, room, text: `${step.label} — ${why}` });
      continue;
    }
    if (step.transferred_to && original) {
      out.push({
        kind: "msg", id: `${sid}:transfer`, at: step.started_at, room, from: speaker(original), to: speaker(CENTRAL), fromKey: original, central: false,
        text: `소관이 아닙니다. 이관 대상을 찾아 주세요.`, tag: step.reason_code ?? undefined, tone: "warn", facts: [],
      });
      out.push({
        kind: "msg", id: `${sid}:req2`, at: step.started_at, room, from: speaker(CENTRAL), to: speaker(step.transferred_to), fromKey: CENTRAL, central: true,
        text: `${step.label} — ${speaker(original)}에서 이관합니다.`, tag: step.skill, tone: "request", facts: [],
      });
    }
    const wasHeld = step.reason_code === "human_input";
    const pending = inc.pending_holds.some((h) => h.step_id === step.step_id);
    if (wasHeld) {
      const holdAt = heldAt(inc, step) ?? step.started_at;
      out.push({
        kind: "msg", id: `${sid}:heldmsg`, at: holdAt, room, from: speaker(step.dept), to: speaker(CENTRAL), fromKey: step.dept ?? "", central: false,
        text: `C 등급이라 사람 승인이 필요합니다.${step.note && SAFE_TOKEN.test(step.note) ? ` (${holdWhy(step.note)})` : ""}`, tag: step.skill, tone: "warn", facts: [],
      });
      const state: "pending" | "approved" | "rejected" | "timeout" = pending
        ? "pending"
        : step.status === "rejected_by_human"
          ? step.note === "시간 초과로 자동 거절" ? "timeout" : "rejected"
          : "approved";
      out.push({
        kind: "hold", id: `${sid}:hold`, at: holdAt, room, contextId: inc.context_id, stepId: step.step_id, state,
        title: step.label, detail: `${speaker(step.dept)} · ${step.skill}`,
      });
      if (pending) continue;
    }
    if (step.finished_at && step.status !== "held") {
      const r = resultLine(step);
      const who = step.dept;
      out.push({
        kind: "msg", id: `${sid}:res`, at: step.finished_at, room, from: speaker(who), to: speaker(CENTRAL), fromKey: who ?? "", central: false,
        text: r.text, tag: step.skill, tone: r.tone, facts: step.status === "completed" ? safeFacts(step.output) : [],
      });
    }
  }

  if (inc.closed_at) {
    const m = inc.metrics ?? {};
    const parts = [
      m.steps_total != null ? `${m.steps_completed ?? 0}/${m.steps_total}단계 완료` : null,
      m.retries ? `재시도 ${m.retries}회` : null,
      m.transfers ? `이관 ${m.transfers}건` : null,
      m.held ? `사람 판단 ${m.held}건` : null,
      m.mttr_seconds != null ? `걸린 시간 ${m.mttr_seconds}초` : null,
    ].filter(Boolean);
    out.push({ kind: "system", id: `${room}:close`, at: inc.closed_at, room, text: `사건 종료 — ${INCIDENT_STATUS_KO[inc.status] ?? inc.status}${parts.length ? ` · ${parts.join(" · ")}` : ""}` });
  }
  return out;
}

function heldAt(inc: OrchIncident, step: OrchStep): string | null {
  return inc.events.find((e) => e.message === `${step.label}: C 등급 보류 — 승인 대기열에 올림`)?.at ?? null;
}

/** 재시도처럼 단계 메시지에 안 드러나는 이벤트만 시스템 줄로. (요청·완료·종료 이벤트는 메시지와 겹친다) */
export function incidentEventItems(inc: OrchIncident): ChatItem[] {
  return inc.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => / 재시도 \d+$/.test(e.message) || /: 사람이 승인 — 재개$/.test(e.message) || e.message.startsWith("같은 사건에 합침"))
    .map(({ e, i }) => {
      if (e.message.startsWith("같은 사건에 합침")) {
        return { kind: "system" as const, id: `${inc.context_id}:ev${i}`, at: e.at ?? inc.opened_at ?? "", room: inc.context_id, text: "같은 장애 신호가 다시 들어와 진행 중인 이 사건에 합쳤습니다" };
      }
      const label = e.message.split(": ")[0];
      const retry = e.message.match(/(마감 초과|실패)\(?[^)]*\)?, 재시도 (\d+)$/);
      const text = retry
        ? `${label} — ${retry[1] === "마감 초과" ? "시간 초과" : "실패"}, ${retry[2]}번째 재시도`
        : `${label} — 사람이 승인해 다시 요청합니다`;
      return { kind: "system" as const, id: `${inc.context_id}:ev${i}`, at: e.at ?? inc.opened_at ?? "", room: inc.context_id, text };
    });
}

// ---------------------------------------------------------------- 안전 관문 실행 기록 → 메시지
export function executionItems(rec: ExecutionRecord): ChatItem[] {
  const room = SAFETY_ROOM;
  const d = rec.decision;
  const req = rec.request;
  const id = `exe:${rec.execution_id}`;
  const amount = d.computed_amount != null ? ` (금액 ${fmtNum(d.computed_amount)}원)` : "";
  const out: ChatItem[] = [{
    kind: "msg", id: `${id}:req`, at: rec.created_at, room, from: speaker(req.requester), to: speaker("safety"), fromKey: req.requester, central: false,
    text: `${actionKo(req.action)} 실행 요청${amount}`, tag: `${req.action} · ${req.context_id}`, tone: "request", facts: [],
  }];
  if (d.verifier) {
    const verdict =
      d.hold_reason === "verify_rejected" || d.status === "rejected" ? { t: "검증 거절", tone: "fail" as Tone }
      : d.hold_reason === "verify_timeout" ? { t: "제때 답하지 못함", tone: "warn" as Tone }
      : d.status === "verifying" ? { t: "검증 중", tone: "muted" as Tone }
      : d.hold_reason === "amount_mismatch" ? { t: "금액 불일치", tone: "warn" as Tone }
      : { t: "검증 통과", tone: "ok" as Tone };
    out.push({
      kind: "msg", id: `${id}:verify`, at: rec.created_at, room, from: verifierName(d.verifier), to: speaker("safety"), fromKey: d.verifier, central: false,
      text: verdict.t, tag: d.verifier === "finance" ? "verify_amount" : undefined, tone: verdict.tone, facts: [],
    });
  }
  const res: Record<string, { t: string; tone: Tone }> = {
    executed: { t: "실행됨", tone: "ok" }, held: { t: "보류 — 사람 결정 대기", tone: "warn" }, rejected: { t: "거절", tone: "fail" },
    verifying: { t: "검증 기다리는 중", tone: "muted" }, failed: { t: "실행 오류", tone: "fail" },
  };
  const r = { ...(res[d.status] ?? { t: d.status, tone: "muted" as Tone }) };
  const why = d.hold_reason ? ` · ${holdWhy(d.hold_reason)}` : "";
  // C 등급인데 실행됨 = 보류됐다가 결정(사람 또는 재무 AI)을 받고 실행된 것
  if (d.status === "executed" && d.grade === "C") r.t = "보류 후 결정을 받아 실행됨";
  out.push({
    kind: "msg", id: `${id}:res`, at: rec.created_at, room, from: speaker("safety"), to: speaker(req.requester), fromKey: "safety", central: true,
    text: `${r.t} (${d.grade}등급)${why}`, tag: d.execution_id, tone: r.tone, facts: [],
  });
  if (d.status === "held") {
    out.push({
      kind: "hold", id: `${id}:hold`, at: rec.created_at, room, state: "pending", link: "/finance",
      title: `${speaker(req.requester)}의 ${actionKo(req.action)}${amount}`, detail: "재무 AI 화면(/finance)에서 결정합니다",
    });
  }
  return out;
}

function verifierName(v: string) {
  return v === "finance" ? "재무 AI" : speaker(v);
}

// ---------------------------------------------------------------- 합치기
const time = (iso: string) => (iso ? new Date(iso).getTime() : 0);

/** 방 하나(또는 전체)의 타임라인. 시간순, 같은 시각이면 만들어진 순서를 지킨다 */
export function buildTimeline(incidents: OrchIncident[], executions: ExecutionRecord[], room: string): ChatItem[] {
  const items: ChatItem[] = [];
  for (const inc of incidents) {
    if (room !== ALL_ROOM && room !== inc.context_id) continue;
    items.push(...incidentItems(inc), ...incidentEventItems(inc));
  }
  if (room === ALL_ROOM || room === SAFETY_ROOM) {
    const recs = [...executions].sort((a, b) => time(a.created_at) - time(b.created_at));
    for (const rec of recs) items.push(...executionItems(rec));
  }
  const indexed = items.map((it, i) => ({ it, i }));
  indexed.sort((a, b) => time(a.it.at) - time(b.it.at) || a.i - b.i);
  return withDaySeparators(indexed.map((x) => x.it));
}

/** 날짜가 바뀌는 곳에 "10월 23일 (목) · 오전" 구분선 */
function withDaySeparators(items: ChatItem[]): ChatItem[] {
  const out: ChatItem[] = [];
  let last = "";
  for (const it of items) {
    if (it.at) {
      const d = new Date(it.at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours() < 12 ? "am" : "pm"}`;
      if (key !== last) {
        last = key;
        out.push({ kind: "separator", id: `day:${key}:${it.id}`, at: it.at, room: it.room, text: dayLabel(d), variant: "day" });
      }
    }
    out.push(it);
  }
  return out;
}

function dayLabel(d: Date) {
  const date = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  return `${date} · ${d.getHours() < 12 ? "오전" : "오후"}`;
}

/** 방 목록에 쓰는 메시지 수 (말풍선만) */
export function messageCount(items: ChatItem[]) {
  return items.filter((i) => i.kind === "msg").length;
}
