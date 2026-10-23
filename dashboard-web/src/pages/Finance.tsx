import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loading } from "@/components/admin/bits";
import { ago, shortDateTime, won } from "@/lib/format";
import { Link } from "@/lib/nav";
import {
  AI_REVIEWER, GUARDRAIL, finance, humanTokenSet, isMachine,
  type AgentCard, type CatbooksItems, type CatbooksItem, type ExecutionRecord, type SelfTest, type Ledger, type LossReport, type MarketOp, type Review, type RuleHit, type ThresholdChange, type ThresholdChangeStatus, type Thresholds, type Verification,
} from "@/lib/finance";

// 재무 AI 화면. 서버(safety·finance)가 계산한 숫자를 그대로 보여 주고, 말만 쉽게 바꾼다.
// 계층: ① 지금 결정할 일 → ② 처리 흐름 → ③ 장애 손실 → ④ 세부 기록 → ⑤ 참고(접힘)

// ---------------------------------------------------------------- 쉬운 말 사전
const ACTION_KO: Record<string, string> = {
  issue_coupon: "쿠폰 지급", refund_request: "환불", confirm_settlement: "판매자 정산 확정",
  seller_review: "판매자 입점 승인", settlement_hold: "판매자 정산 멈춤", publish_notice: "공지 올리기",
  "memory.card_write": "회사 기록 남기기", "memory.card_link": "회사 기록 연결", record_case: "사건 기록",
  rollback_deployment: "배포 되돌리기", restart_service: "서비스 다시 켜기", generate_pr: "코드 변경 만들기",
  send_reply: "고객 답변 보내기", create_inquiry: "문의 등록", add_customer_message: "고객 메시지 추가",
  reject_draft: "답변 초안 버리기", set_inquiry_status: "문의 상태 바꾸기",
};
const WHO_KO: Record<string, string> = {
  marketing: "마케팅 AI", support: "고객지원 AI", finance: "재무 AI", hr: "인사 AI", orchestrator: "총괄 AI",
  data: "데이터 AI", planning: "기획 AI", infra: "인프라 AI", memory: "기록 AI", safety: "안전 장치",
};
const action = (a: string) => ACTION_KO[a] ?? a;
const who = (w: string | null | undefined) => (w ? WHO_KO[w] ?? w : "");

const WAY: Record<string, { label: string; tone: string }> = {
  A: { label: "바로 처리", tone: "bg-emerald-50 text-emerald-700" },
  B: { label: "재무 확인 후 처리", tone: "bg-brand-50 text-brand-700" },
  C: { label: "사람 확인", tone: "bg-amber-50 text-amber-700" },
  read: { label: "보기만 함", tone: "bg-ink-100 text-ink-500" },
};
const RESULT: Record<string, { label: string; tone: string }> = {
  executed: { label: "처리됨", tone: "bg-emerald-50 text-emerald-700" },
  held: { label: "결정 기다림", tone: "bg-amber-50 text-amber-700" },
  rejected: { label: "막힘", tone: "bg-red-50 text-red-700" },
  verifying: { label: "확인 중", tone: "bg-brand-50 text-brand-700" },
  failed: { label: "오류", tone: "bg-ink-100 text-ink-500" },
};
const WHY_HELD: Record<string, string> = {
  over_threshold: "금액 기준을 넘음", unregistered_action: "등록되지 않은 일", amount_mismatch: "적어 낸 금액과 계산이 다름",
  verify_rejected: "재무 AI가 거절함", verify_timeout: "확인하는 쪽이 응답하지 않음", schema_invalid: "요청 내용이 잘못됨",
  review_timeout: "기한 안에 아무도 결정하지 않아 자동 취소",
};
const CHECK_KO: Record<string, string> = {
  recomputed_match: "계산이 맞음", amount_mismatch: "적어 낸 금액과 계산이 다름", invalid_params: "요청 내용이 잘못됨",
  not_affected: "장애 피해를 본 고객이 아님", exceeds_paid: "결제한 금액보다 많이 환불하려 함",
  source_unavailable: "확인할 자료가 없어 통과시키지 않음", unsupported_action: "재무가 확인하는 일이 아님",
};
const RULE_KO: Record<string, string> = {
  coupon_total: "쿠폰 한 번에 주는 총액", coupon_unit: "쿠폰 한 장 금액", coupon_daily: "하루 동안 준 쿠폰 합계",
  compensation_per_context: "장애 한 건에 준 보상 합계", compensation_per_customer: "한 고객에게 준 보상 합계",
  refund_single: "환불 한 건 금액", seller_risk: "판매자 위험 점수", pr_changed_lines: "코드 변경 줄 수",
  pr_changed_files: "코드 변경 파일 수", pr_allowed_paths: "코드를 바꿔도 되는 폴더", base_grade: "항상 사람이 확인하는 일",
};
const MONEY_RULES = new Set(["coupon_total", "coupon_unit", "coupon_daily", "compensation_per_context", "compensation_per_customer", "refund_single"]);
const SKILL_KO: Record<string, { name: string; what: string }> = {
  verify_amount: { name: "금액 다시 계산하기", what: "쿠폰이나 환불을 하기 전에, 금액이 맞는지와 받을 사람이 맞는지 원래 자료로 다시 계산합니다. 자료가 없으면 통과시키지 않습니다." },
  loss_aggregation: { name: "장애 손실 정리", what: "장애 때문에 실패한 주문 수, 피해 금액, 보상으로 나간 돈을 합쳐서 총 손실을 알려 줍니다." },
  seller_review: { name: "판매자 입점 심사", what: "서류와 위험 점수를 보고 입점을 승인합니다. 위험 점수가 높으면 사람이 확인합니다. 판매자가 쓴 소개글은 판단에 쓰지 않습니다." },
  settlement_hold: { name: "판매자 정산 멈춤", what: "문제가 있는 판매자에게 돈이 나가지 않도록 정산을 멈춥니다. 실제 송금은 하지 않습니다." },
  review_threshold_change: { name: "기준 바꾸기 판단", what: "관리자가 요청한 기준 바꾸기를 정합니다. 낮추기는 승인, 올리기는 최근 24시간 그 기준 때문에 멈춘 일이 3건 이상일 때만 승인합니다. 30% 넘게 바꾸면 재무 담당자에게 넘깁니다." },
};
const SELLER_KO: Record<string, string> = { approved: "승인", rejected: "거절", held: "사람 확인 중", undetermined: "판단 보류" };
const HOLD_KO: Record<string, string> = { held: "정산 멈춤", pending_review: "사람 확인 중", rejected: "멈추지 않음" };
const SELLER_WHY: Record<string, string> = { documents_missing: "서류 미확인", risk_unavailable: "위험 점수를 못 받음", risk_checked: "위험 점수 확인함" };

// ---------------------------------------------------------------- 작은 부품
const Chip = ({ label, tone }: { label: string; tone: string }) => <span className={`chip ${tone}`}>{label}</span>;
const pick = (map: Record<string, { label: string; tone: string }>, key: string) => <Chip {...(map[key] ?? { label: key, tone: "bg-ink-100 text-ink-500" })} />;
const money = (n: number | null | undefined) => (n == null ? "–" : won(n));
const num = (n: number) => n.toLocaleString("ko-KR");

/** "3시간 20분", "45분", "30초" */
function duration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return m ? `${h}시간 ${m}분` : `${h}시간`;
  if (m > 0) return `${m}분`;
  return `${s}초`;
}
const secondsLeft = (iso: string) => (new Date(iso).getTime() - Date.now()) / 1000;

/** "refund_amount = 150,000원" → "환불 금액 150,000원", "3 × 5,000 = 15,000원" → "3장 × 5,000원 = 15,000원" */
function calcText(c: string): string {
  const m = c.match(/^([\d,]+) × ([\d,]+) = (.+)$/);
  if (m) return `${m[1]}장 × ${m[2]}원 = ${m[3]}`;
  return c.replace("refund_amount = ", "환불 금액 ");
}

function ruleSentence(h: RuleHit): string {
  const name = RULE_KO[h.key] ?? h.key;
  if (h.key === "base_grade") return "판매자 정산 확정처럼 항상 사람이 확인하는 일";
  if (h.outside) return `${name}가 아닌 곳을 바꿈: ${h.outside.join(", ")}`;
  if (h.invalid) return `${name} 정보가 없음`;
  if (h.observed != null && typeof h.value === "number") {
    const f = MONEY_RULES.has(h.key) ? won : num;
    return `${name}가 ${f(h.observed)} — 기준 ${f(h.value)}${h.op === ">" ? " 초과" : " 이상"}`;
  }
  return name;
}

function reasons(r: Review): string[] {
  const out = (r.report.rules ?? []).map(ruleSentence);
  if (r.report.claimed) out.push(`요청한 쪽이 적어 낸 금액은 ${Object.values(r.report.claimed).map((v) => money(v)).join(", ")}`);
  if (r.report.hold_reason === "unregistered_action") out.push("등록되지 않은 일이거나 이 AI가 요청할 수 없는 일");
  if (r.report.hold_reason === "verify_timeout") out.push("재무 AI가 제때 답하지 않아 멈춤");
  return out;
}

/** 카드마다 붙는 판단 힌트. 자세한 기준은 관리자 사용법 문서. */
function tipOf(r: Review): string {
  if (r.report.rules?.some((h) => h.key === "base_grade")) return "정산할 판매자·기간·금액이 맞으면 진행하세요.";
  switch (r.report.hold_reason) {
    case "amount_mismatch": return "요청한 AI가 금액을 잘못 적었다는 뜻입니다. 보통 멈추고 담당자에게 알리세요.";
    case "unregistered_action": return "처음 보는 일입니다. 멈추고 재무 담당자에게 문의하세요.";
    case "verify_timeout": return "재무 AI가 답하지 않았습니다. 서버가 꺼져 있었다면 멈추세요.";
    case "over_threshold":
      if (r.action === "refund_request") return "쇼핑몰 관리 화면에서 주문·결제 금액을 확인한 뒤 결정하세요.";
      if (r.action === "seller_review") return "판매자 서류와 정보를 본 뒤 결정하세요. 애매하면 멈추세요.";
      return "아래 '장애로 생긴 손실'과 비교해 보상이 지나치지 않으면 진행하세요.";
    default: return "애매하면 멈추세요. 멈춘 일은 요청한 AI가 고쳐서 다시 요청할 수 있습니다.";
  }
}

function holdTitle(r: Review): string {
  if (r.report.rules?.some((h) => h.key === "base_grade")) return "항상 사람이 확인";
  return WHY_HELD[r.report.hold_reason ?? ""] ?? "확인 필요";
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const TEST_TTL_HOURS = 12; // 서버와 같다. 지난 결과는 믿지 않고 다시 테스트하게 한다
const freshTest = (t: SelfTest | null) =>
  t && Date.now() - new Date(t.ran_at).getTime() < TEST_TTL_HOURS * 3600 * 1000 ? t : null;

const TEST_TONE = {
  pass: { box: "bg-emerald-50 ring-emerald-100 text-emerald-800", label: "정상" },
  warn: { box: "bg-amber-50 ring-amber-100 text-amber-800", label: "주의" },
  fail: { box: "bg-red-50 ring-red-100 text-red-800", label: "실패" },
} as const;

/** 재무 AI 테스트 결과. 버튼을 누른 직후에는 항목을 펼쳐서 보여 준다. */
function SelfTestPanel({ test, open }: { test: SelfTest; open: boolean }) {
  const tone = TEST_TONE[test.result];
  const bad = test.checks.filter((c) => !c.ok);
  return (
    <section aria-live="polite" className={`rounded-2xl px-5 py-4 ring-1 ${tone.box}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">재무 AI 테스트: {tone.label}</h2>
        <p className="text-sm">{test.summary}</p>
        <p className="ml-auto text-xs opacity-80">{shortDateTime(test.ran_at)} · {test.passed}/{test.total} 통과 · {(test.duration_ms / 1000).toFixed(1)}초</p>
      </div>
      {test.result !== "pass" && (
        <p className="mt-1 text-xs font-medium">
          {test.result === "fail"
            ? "테스트를 통과하지 못했습니다. 문제가 해결될 때까지 재무 AI의 결정을 믿고 쓰지 마세요."
            : "연결 문제가 해결될 때까지 일부 결정이 사람 확인으로 넘어올 수 있습니다."}
        </p>
      )}
      {bad.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {bad.map((c) => <li key={c.name}><b>{c.level === "fail" ? "실패" : "주의"}</b> · {c.name}: {c.detail}</li>)}
        </ul>
      )}
      <details className="mt-2 text-sm" open={open}>
        <summary className="cursor-pointer text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">점검한 항목 {test.total}개 모두 보기</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {test.checks.map((c) => (
            <li key={c.name} className="flex gap-2 rounded-lg bg-surface/70 px-2 py-1 text-ink-700">
              <span className={`chip shrink-0 ${c.ok ? "bg-emerald-50 text-emerald-700" : c.level === "fail" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{c.ok ? "통과" : c.level === "fail" ? "실패" : "주의"}</span>
              <span><b className="text-ink-900">{c.name}</b> <span className="text-xs">{c.detail}</span></span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------- 캣북스에서 들어온 처리할 일
const CB_TONE: Record<CatbooksItem["result"], { chip: string; box: string }> = {
  pass: { chip: "bg-emerald-50 text-emerald-700", box: "bg-emerald-50 text-emerald-800" },
  blocked: { chip: "bg-red-50 text-red-700", box: "bg-red-50 text-red-800" },
  needs_human: { chip: "bg-amber-100 text-amber-800", box: "bg-amber-50 text-amber-800" },
};
const CB_ORDER: CatbooksItem["result"][] = ["needs_human", "blocked", "pass"];

function CatbooksPanel({ data, syncing, onSync, canSync }: { data: CatbooksItems | null; syncing: boolean; onSync: () => void; canSync: boolean }) {
  const items = data?.data ?? [];
  const sync = data?.meta.sync ?? null;
  const count = (k: CatbooksItem["result"]) => items.filter((i) => i.result === k).length;
  const sorted = [...items].sort((a, b) => CB_ORDER.indexOf(a.result) - CB_ORDER.indexOf(b.result));
  const every = data?.meta.poll_seconds ? `${data.meta.poll_seconds}초마다 자동으로 가져옵니다.` : "자동 가져오기가 꺼져 있습니다.";
  return (
    <section aria-labelledby="catbooks" className="card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 id="catbooks" className="text-base font-semibold text-ink-900">캣북스에서 들어온 처리할 일</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-ink-500">
            캣북스 쇼핑몰의 환불·교환·보상 신청 중 아직 돈이 나가기 전인 건입니다. 재무 AI가 결제 금액, 이미 환불한 금액, 환불 규정으로 다시 계산해 나눴습니다.
            재무 AI는 캣북스를 읽기만 하고, 실제 지급은 캣북스 관리 화면의 지급 버튼으로 합니다.
          </p>
        </div>
        <div className="ml-auto text-right">
          <button className="btn-primary" onClick={onSync} disabled={syncing || !canSync}>{syncing ? "가져오는 중…" : "지금 가져오기"}</button>
          <p className="mt-1 text-xs text-ink-500">
            {sync?.synced_at ? `마지막으로 가져온 시각 ${shortDateTime(sync.synced_at)} (${ago(sync.synced_at)})` : "아직 가져온 적이 없습니다"}
          </p>
          <p className="text-xs text-ink-500">{every}</p>
        </div>
      </div>

      {sync && !sync.ok && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">
          캣북스에서 가져오지 못했습니다: {sync.error}. 아래는 {sync.synced_at ? "마지막으로 가져온" : "이전"} 목록입니다. 캣북스 서버(8030)가 켜져 있는지 확인하세요.
        </p>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {([["pass", "통과", "금액이 맞음"], ["blocked", "막음", "금액이 틀려 지급하면 안 됨"], ["needs_human", "사람 확인 필요", "재무 AI가 혼자 정하지 않음"]] as const).map(([k, label, hint]) => (
          <div key={k} className={`rounded-2xl px-4 py-3 ${CB_TONE[k].box}`}>
            <dt className="text-xs font-medium">{label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{count(k)}건</dd>
            <dd className="text-xs opacity-80">{hint}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 divide-y divide-ink-100">
        {sorted.map((i) => (
          <li key={i.id} className="grid gap-3 py-3 sm:grid-cols-[150px_1fr_auto] sm:items-start">
            <div>
              <p className="text-lg font-bold tabular-nums text-ink-900">{won(i.refund_amount)}</p>
              <p className="text-xs text-ink-500">
                {i.refund_amount ? "현금 환불" : "현금 환불 없음"}
                {i.compensation > 0 && ` · 적립금 ${won(i.compensation)}`}
                {i.points_back > 0 && ` · 적립금 반환 ${won(i.points_back)}`}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm">
                <b>{i.type_ko}</b> <span className="text-ink-700">· {i.customer ?? "고객"} · 주문 {i.order_no ?? i.order_id}</span>
              </p>
              <p className="mt-0.5 text-sm text-ink-700">{i.explanation}</p>
              <p className="mt-1 text-xs text-ink-500">
                결제 {money(i.paid_amount)} · 이미 환불 {won(i.refunded_before)} · 캣북스 상태: {i.catbooks_status_ko}
                {i.queue_position != null && ` · 지급 대기열 ${i.queue_position}번째${i.queue_ready ? " (지급 가능)" : ""}`}
              </p>
              {i.needs_safety && (
                <p className="mt-1 rounded-lg bg-brand-50 px-2 py-1 text-xs text-brand-700">환불 10만 원 이상이라 실제로 지급할 때는 안전 장치를 거쳐야 합니다.</p>
              )}
            </div>
            <div className="sm:text-right">
              <Chip label={i.result_ko} tone={CB_TONE[i.result].chip} />
              <p className="mt-1 text-xs text-ink-500">신청 #{i.claim_id}</p>
            </div>
          </li>
        ))}
        {!items.length && (
          <li className="py-6 text-center text-sm text-ink-500">
            {sync?.ok ? "지금 캣북스에 처리할 환불·교환 신청이 없습니다." : "아직 캣북스에서 가져온 신청이 없습니다. 지금 가져오기를 눌러 보세요."}
          </li>
        )}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- 기준 바꾸기
const TIMEOUT_KEY = "review_timeout_seconds";
const CHANGE_RESULT: Record<ThresholdChangeStatus, { label: string; tone: string; box: string; title: string }> = {
  applied: { label: "바뀜", tone: "bg-emerald-50 text-emerald-700", box: "bg-emerald-50 text-emerald-800", title: "기준이 바뀌었습니다. 다음 요청부터 새 기준을 씁니다." },
  pending: { label: "담당자 확인 대기", tone: "bg-amber-50 text-amber-700", box: "bg-amber-50 text-amber-800", title: "재무 담당자의 확인을 기다립니다." },
  rejected: { label: "거절됨", tone: "bg-red-50 text-red-700", box: "bg-red-50 text-red-800", title: "기준을 바꾸지 않았습니다." },
};
const ruleName = (key: string) => (key === TIMEOUT_KEY ? "사람 결정 기한" : RULE_KO[key] ?? key);
/** 기준 값을 쉬운 말로: 금액은 원, 기한은 시간, 나머지는 숫자 */
function ruleValue(key: string, v: number | null | undefined): string {
  if (v == null) return "–";
  if (key === TIMEOUT_KEY) return duration(v);
  return MONEY_RULES.has(key) ? won(v) : num(v);
}
function decidedText(c: ThresholdChange): string {
  if (c.status === "pending") return "재무 담당자가 아래에서 승인하거나 거절합니다";
  const at = shortDateTime(c.decided_at);
  if (c.decided_by === GUARDRAIL) return `안전 장치가 거절 · ${at}`;
  if (c.decided_by === AI_REVIEWER) return `재무 AI가 ${c.status === "applied" ? "승인" : "거절"} · ${at}`;
  return `${c.decided_by}님이 ${c.status === "applied" ? "승인" : "거절"} · ${at}`;
}

/** "사람 확인 기준" 안의 기준 바꾸기: 요청 폼 + 결과 + 최근 기록(기다리는 건은 승인·거절). */
function ThresholdChangePanel({ thresholds, changes, reload }: { thresholds: Thresholds | null; changes: ThresholdChange[]; reload: () => Promise<unknown> }) {
  const baseline = thresholds?.baseline ?? {};
  const keys = Object.keys(baseline);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ThresholdChange | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  const chosen = key || keys[0] || "";
  const current = chosen === TIMEOUT_KEY ? thresholds?.review_timeout_seconds : thresholds?.rules.find((r) => r.key === chosen)?.value;
  const base = baseline[chosen];
  const asNumber = Number(value.replace(/,/g, ""));
  const ready = humanTokenSet && !!chosen && value.trim() !== "" && Number.isInteger(asNumber) && reason.trim() !== "" && !sending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSending(true); setProblem(null); setResult(null);
    try {
      setResult(await finance.requestThresholdChange(chosen, asNumber, reason.trim()));
      setValue(""); setReason("");
      await reload();
    } catch (err) { setProblem((err as Error).message); } finally { setSending(false); }
  }

  async function decideChange(id: string, decision: "approved" | "rejected") {
    setDeciding(id + decision); setProblem(null);
    try { await finance.decideThresholdChange(id, decision); await reload(); }
    catch (err) { setProblem((err as Error).message); } finally { setDeciding(null); }
  }

  if (!thresholds) return null;
  return (
    <div className="mt-4 border-t border-ink-100 pt-4">
      <h3 className="text-sm font-semibold text-ink-900">기준 바꾸기 요청</h3>
      <p className="mt-0.5 text-xs text-ink-500">
        안전 장치가 먼저 범위를 확인하고(처음 값의 절반~두 배, 결정 기한은 1시간~3일), 그 안이면 재무 AI가 정합니다.
        크게 바꾸거나 근거가 부족하면 재무 담당자에게 넘어갑니다. 적은 이유는 기록만 하고 판단에는 쓰지 않습니다.
      </p>
      {keys.length === 0 ? (
        <p className="mt-2 text-xs text-ink-500">안전 장치 서버가 기준 바꾸기를 지원하지 않습니다.</p>
      ) : (
        <form className="mt-3 grid gap-2" onSubmit={submit}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-ink-500">
              바꿀 기준
              <select className="field mt-1" value={chosen} onChange={(e) => { setKey(e.target.value); setResult(null); }}>
                {keys.map((k) => <option key={k} value={k}>{ruleName(k)}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-500">
              새 값{chosen === TIMEOUT_KEY ? " (초)" : MONEY_RULES.has(chosen) ? " (원)" : ""}
              <input className="field mt-1 tabular-nums" inputMode="numeric" placeholder={current != null ? String(current) : ""} value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-ink-500">
            지금 {ruleValue(chosen, current)} · 처음 값 {ruleValue(chosen, base)}
            {base != null && ` · 바꿀 수 있는 범위 ${ruleValue(chosen, Math.ceil(base / 2))} ~ ${ruleValue(chosen, base * 2)}`}
          </p>
          <label className="text-xs text-ink-500">
            바꾸는 이유 <span className="tabular-nums">({reason.length}/300)</span>
            <textarea className="field mt-1 h-16 resize-none" maxLength={300} placeholder="예: 이번 주 이 기준 때문에 멈춘 쿠폰이 너무 많아요" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary" disabled={!ready}>{sending ? "재무 AI가 보는 중…" : "재무 AI에게 요청"}</button>
            {!humanTokenSet && <span className="text-xs text-amber-800">요청 권한(VITE_SAFETY_HUMAN_TOKEN)이 설정되지 않아 버튼이 꺼져 있습니다.</span>}
          </div>
        </form>
      )}

      {result && (
        <div aria-live="polite" className={`mt-3 rounded-xl px-3 py-2 text-sm ${CHANGE_RESULT[result.status].box}`}>
          <p className="font-semibold">{CHANGE_RESULT[result.status].title}</p>
          <p className="mt-0.5">{ruleName(result.key)} {ruleValue(result.key, result.old_value)} → {ruleValue(result.key, result.new_value)}{result.version_after != null && ` (${result.version_after}번째 기준)`}</p>
          {result.explanation && <p className="mt-0.5 text-xs">{result.explanation}</p>}
        </div>
      )}
      {problem && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{problem}</p>}

      <h3 className="mt-5 text-sm font-semibold text-ink-900">최근 기준 바꾸기</h3>
      <ul className="mt-2 space-y-2">
        {changes.slice(0, 8).map((c) => (
          <li key={c.change_id} className="rounded-xl border border-ink-100 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Chip label={CHANGE_RESULT[c.status].label} tone={CHANGE_RESULT[c.status].tone} />
              <b>{ruleName(c.key)}</b>
              <span className="tabular-nums text-ink-700">{ruleValue(c.key, c.old_value)} → {ruleValue(c.key, c.new_value)}</span>
              <span className="ml-auto text-xs text-ink-500">{who(c.requested_by)} 요청 · {ago(c.created_at)}</span>
            </div>
            {c.explanation && <p className="mt-1 text-xs text-ink-700">{c.explanation}</p>}
            <p className="mt-0.5 text-xs text-ink-500">이유: {c.reason}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-500">{decidedText(c)}</span>
              {c.status === "pending" && (
                <span className="ml-auto flex gap-2">
                  <button className="btn-primary" disabled={!humanTokenSet || deciding !== null} onClick={() => decideChange(c.change_id, "approved")}>승인</button>
                  <button className="btn-ghost" disabled={!humanTokenSet || deciding !== null} onClick={() => decideChange(c.change_id, "rejected")}>거절</button>
                </span>
              )}
            </div>
          </li>
        ))}
        {!changes.length && <li className="py-3 text-center text-xs text-ink-500">아직 기준을 바꾼 기록이 없습니다.</li>}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- 데이터
interface View {
  card: AgentCard | null;
  executions: ExecutionRecord[];
  reviews: Review[];
  thresholds: Thresholds | null;
  verifications: Verification[];
  ledger: Ledger | null;
  marketOps: MarketOp[];
  losses: LossReport[];
  catbooks: CatbooksItems | null;
  changes: ThresholdChange[];
  safetyUp: boolean;
  financeUp: boolean;
}

/** 한쪽 서버가 꺼져 있어도 나머지는 보이도록 따로 받는다. */
async function loadAll(): Promise<View> {
  const get = async <T,>(p: Promise<T>, fallback: T): Promise<[T, boolean]> => { try { return [await p, true]; } catch { return [fallback, false]; } };
  const [[card, financeUp], [executions, safetyUp], [reviews], [thresholds], [verifications], [ledger], [marketOps], [losses], [catbooks], [changes]] = await Promise.all([
    get<AgentCard | null>(finance.card(), null),
    get<ExecutionRecord[]>(finance.executions(), []),
    get<Review[]>(finance.reviews(), []),
    get<Thresholds | null>(finance.thresholds(), null),
    get<Verification[]>(finance.verifications(), []),
    get<Ledger | null>(finance.ledger(), null),
    get<MarketOp[]>(finance.marketOps(), []),
    get<LossReport[]>(finance.lossReports(), []),
    get<CatbooksItems | null>(finance.catbooksItems(), null),
    get<ThresholdChange[]>(finance.thresholdChanges(), []),
  ]);
  return { card, executions, reviews, thresholds, verifications, ledger, marketOps, losses, catbooks, changes, safetyUp, financeUp };
}

/** 처리 흐름: 들어온 요청이 어디로 갔는지. 숫자는 서버 판정을 그대로 센다. */
function flowOf(executions: ExecutionRecord[], reviews: Review[]) {
  const byExec = new Map(reviews.map((r) => [r.execution_id, r]));
  const viaFinance = (e: ExecutionRecord) =>
    !!e.decision.verifier && e.decision.verifier !== "safety" && !byExec.has(e.execution_id);
  const direct = executions.filter((e) => e.decision.grade === "A").length;
  const checked = executions.filter(viaFinance);
  const checkedPass = checked.filter((e) => e.decision.status === "executed").length;
  const held = executions.filter((e) => e.decision.grade === "C" && !viaFinance(e));
  const ai = held.filter((e) => isMachine(byExec.get(e.execution_id)?.decided_by)).length;
  return {
    total: executions.length, direct, checked: checked.length, checkedPass,
    checkedStop: checked.length - checkedPass, ai, human: held.length - ai,
  };
}

const utcDay = (iso: string) => iso.slice(0, 10);

// ---------------------------------------------------------------- 화면
export default function FinancePage() {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);
  const [test, setTest] = useState<SelfTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { finance.lastSelfTest().then((t) => setTest(freshTest(t))).catch(() => undefined); }, []);
  useEffect(() => {
    // 화면을 켜 둔 채 12시간이 지나도 지난 결과를 지운다
    const t = setInterval(() => setTest((cur) => freshTest(cur)), 60_000);
    return () => clearInterval(t);
  }, []);

  async function runTest() {
    setTesting(true);
    setError(null);
    try { setTest(await finance.selfTest()); setTestOpen(true); }
    catch { setError("재무 AI 테스트를 실행하지 못했습니다. 재무 AI 서버(8105)가 켜져 있는지 확인하세요."); }
    finally { setTesting(false); }
  }

  const load = useCallback(() => loadAll().then(setView), []);
  useEffect(() => {
    load();
    const poll = setInterval(load, 5000); // 5초마다 새로 받는다
    const clock = setInterval(() => tick((n) => n + 1), 30000); // 남은 시간 표시
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  async function syncCatbooks() {
    setSyncing(true);
    setError(null);
    try { await finance.catbooksSync(); await load(); }
    catch { setError("캣북스에서 가져오지 못했습니다. 재무 AI 서버(8105)가 켜져 있는지 확인하세요."); }
    finally { setSyncing(false); }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id + decision);
    setError(null);
    try { await finance.decide(id, decision); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  if (!view) return <Loading error={null} />;
  const { card, executions, reviews, thresholds, verifications, ledger, marketOps, losses, catbooks, changes, safetyUp, financeUp } = view;
  const changesWaiting = changes.filter((c) => c.status === "pending").length;
  const deadline = thresholds ? duration(thresholds.review_timeout_seconds) : "정해진 시간";
  const pending = reviews.filter((r) => r.status === "pending").sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  const decided = reviews.filter((r) => r.status !== "pending" && !isMachine(r.decided_by)).slice(-5).reverse();
  const machine = reviews.filter((r) => r.status !== "pending" && isMachine(r.decided_by)).slice(-8).reverse();
  const today = new Date().toISOString().slice(0, 10); // 안전 장치의 하루 기준(UTC)과 같게
  const todays = executions.filter((e) => utcDay(e.created_at) === today);
  const spent = todays.filter((e) => e.decision.status === "executed").reduce((n, e) => n + (e.decision.computed_amount ?? 0), 0);
  const blocked = todays.filter((e) => e.decision.status === "rejected").reduce((n, e) => n + (e.decision.computed_amount ?? 0), 0);
  const couponLimit = thresholds?.rules.find((r) => r.key === "coupon_daily")?.value ?? 0;
  const couponUsed = todays
    .filter((e) => e.request.action === "issue_coupon" && e.decision.status === "executed")
    .reduce((n, e) => n + (e.decision.computed_amount ?? 0), 0);
  const couponPct = couponLimit ? Math.min(100, Math.round((couponUsed / couponLimit) * 100)) : 0;
  const pendingMoney = pending.reduce((sum, r) => sum + (r.report.computed_amount ?? 0), 0);
  const flow = flowOf(executions, reviews);
  const pct = (n: number) => (flow.total ? `${(n / flow.total) * 100}%` : "0%");
  const lanes = [
    { title: "바로 처리", count: flow.direct, bar: "bg-emerald-700", border: "border-emerald-700", detail: "공지, 기록처럼 돈이 나가지 않는 일" },
    { title: "재무 AI가 확인 후 처리", count: flow.checked, bar: "bg-brand-500", border: "border-brand-500", detail: `통과 ${flow.checkedPass}건, 막음 ${flow.checkedStop}건. 금액과 받을 사람을 원래 자료로 다시 계산` },
    { title: "기준 넘음 → AI가 결정", count: flow.ai, bar: "bg-brand-700", border: "border-brand-700", detail: "재량 한도 안이면 승인, 근거가 틀리면 거절" },
    { title: "사람이 결정", count: flow.human, bar: "bg-amber-700", border: "border-amber-700", detail: `아주 큰 금액, 정산 확정, 자료가 없는 건. 지금 ${pending.length}건이 기다림` },
  ];
  const tone = pending.length ? "text-amber-800" : "text-emerald-800";

  return (
    <div className="max-w-[1320px] space-y-8 px-8 pb-12 pt-2">
      {/* 머리말 */}
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">재무 AI</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">쿠폰, 환불, 판매자 정산처럼 돈이 나가는 일을 한 번 더 확인합니다. 금액은 AI가 아니라 정해진 계산과 기준으로 판단합니다.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <button className="btn-primary" onClick={runTest} disabled={testing || !financeUp}>
            {testing ? "테스트하는 중…" : "재무 AI 테스트"}
          </button>
          <Chip label={safetyUp ? "안전 장치 켜짐" : "안전 장치 꺼짐"} tone={safetyUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
          <Chip label={financeUp ? "재무 AI 켜짐" : "재무 AI 꺼짐"} tone={financeUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
        </div>
      </header>

      <details className="rounded-2xl border border-ink-100 bg-surface px-5 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">처음이라면: 관리자가 할 일</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-700">
          <li>아침에 오른쪽 위 <b>재무 AI 테스트</b>를 누릅니다. 초록색이면 정상, 노란색은 연결 확인 필요, 빨간색이면 재무 담당자에게 알립니다.</li>
          <li>맨 위 <b>지금 사람이 결정할 일</b>을 봅니다. 대부분의 일은 재무 AI가 대신 결정하고, 아주 큰 금액이나 판단할 자료가 없는 건만 여기로 옵니다.</li>
          <li>카드의 <b>금액</b>과 <b>이유</b>를 읽고, 파란 상자의 <b>이럴 땐</b> 힌트를 참고합니다.</li>
          <li><b>진행</b> 또는 <b>멈춤</b>을 누릅니다. 애매하면 멈춤을 누르세요. 진행은 되돌릴 수 없고, 멈춘 일은 요청한 AI가 고쳐서 다시 요청할 수 있습니다. 정한 시간 안에 아무도 누르지 않으면 자동으로 멈춥니다.</li>
        </ol>
        <p className="mt-3 text-xs text-ink-500">
          이유별 판단 기준과 자주 묻는 질문은 <Link href="/finance/guide" className="font-medium text-brand-700 underline">재무 AI 관리자 사용법</Link>에 있습니다. 기준 금액을 바꾸고 싶으면 아래 "사람 확인 기준"의 <b>기준 바꾸기 요청</b>을 쓰세요. 안전 장치 범위 안에서 재무 AI가 정하고, 크게 바꾸면 재무 담당자가 확인합니다.
        </p>
      </details>

      {test ? <SelfTestPanel test={test} open={testOpen} /> : (
        <p className="rounded-2xl border border-dashed border-ink-300 px-5 py-3 text-sm text-ink-500">
          최근 {TEST_TTL_HOURS}시간 안에 한 테스트가 없습니다. <b>재무 AI 테스트</b>를 눌러 재무 AI가 제대로 판단하고 연결돼 있는지 확인하세요. 가짜 자료로 점검해서 실제 기록이나 돈에는 영향이 없습니다.
          <span className="mt-1 block text-xs">테스트를 통과하지 못하면 재무 AI의 결정을 믿고 쓰지 마세요.</span>
        </p>
      )}

      {(!safetyUp || !financeUp) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {!safetyUp && "안전 장치 서버(8001)가 꺼져 있습니다. "}{!financeUp && "재무 AI 서버(8105)가 꺼져 있습니다. "}
          ax-backend에서 <code>docker compose -f infra/compose.yml up safety finance</code>로 켜 주세요.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

      {/* ① 지금 결정할 일: 화면에서 가장 중요한 곳 */}
      <section aria-labelledby="todo" className={`rounded-[28px] p-6 ring-1 ${pending.length ? "bg-amber-50 ring-amber-100" : "bg-emerald-50 ring-emerald-100"}`}>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <h2 id="todo" className={`text-sm font-semibold ${tone}`}>지금 사람이 결정할 일</h2>
            <p className={`mt-1 text-4xl font-bold tabular-nums ${tone}`}>{pending.length ? `${pending.length}건` : "없음"}</p>
          </div>
          {pending.length > 0 && (
            <dl className={`flex gap-8 pb-1 text-sm ${tone}`}>
              <div><dt className="text-xs opacity-80">걸려 있는 금액</dt><dd className="text-lg font-semibold tabular-nums">{won(pendingMoney)}</dd></div>
              <div><dt className="text-xs opacity-80">가장 급한 건</dt><dd className="text-lg font-semibold">{duration(secondsLeft(pending[0].expires_at))} 남음</dd></div>
            </dl>
          )}
          <p className={`ml-auto max-w-sm pb-1 text-xs ${tone}`}>
            대부분은 재무 AI가 기준과 자료를 보고 대신 결정하고, 금액이 아주 크거나 판단할 자료가 없는 건만 여기로 옵니다. {deadline} 안에 결정하지 않으면 자동으로 멈춥니다.
          </p>
        </div>
        {!humanTokenSet && pending.length > 0 && <p className="mt-3 text-xs text-amber-800">결정 권한(VITE_SAFETY_HUMAN_TOKEN)이 설정되지 않아 버튼이 꺼져 있습니다.</p>}

        {pending.length > 0 && (
          <ul className="mt-5 space-y-3">
            {pending.map((r) => {
              const left = secondsLeft(r.expires_at);
              const urgent = left < 3600;
              return (
                <li key={r.review_id} className="grid gap-4 rounded-2xl bg-surface p-4 shadow-sm sm:grid-cols-[190px_1fr_auto] sm:items-center">
                  <div>
                    {r.report.computed_amount != null
                      ? <p className="text-2xl font-bold tabular-nums text-ink-900">{won(r.report.computed_amount)}</p>
                      : <p className="text-base font-semibold text-ink-500">금액으로 판단하지 않는 일</p>}
                    <p className="text-xs text-ink-500">{r.report.calculation ? calcText(r.report.calculation) : action(r.action)}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-[15px]">{action(r.action)}</b>
                      <Chip label={holdTitle(r)} tone="bg-amber-100 text-amber-800" />
                    </div>
                    <ul className="mt-1 space-y-0.5 text-sm text-ink-700">
                      {reasons(r).map((t) => <li key={t}>{t}</li>)}
                    </ul>
                    {r.report.ai_review?.explanation && <p className="mt-1.5 text-xs text-ink-700">재무 AI 의견: {r.report.ai_review.explanation}</p>}
                    <p className="mt-1.5 rounded-lg bg-brand-50 px-2 py-1 text-xs text-brand-700">이럴 땐: {tipOf(r)}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {who(r.requester)}가 {ago(r.created_at)} 요청 · <span className={urgent ? "font-semibold text-red-700" : ""}>{duration(left)} 안에 결정하지 않으면 자동 취소</span>
                    </p>
                  </div>
                  <div className="flex gap-2 sm:flex-col">
                    <button className="btn-primary" disabled={!humanTokenSet || busy !== null} onClick={() => decide(r.review_id, "approved")}>진행</button>
                    <button className="btn-ghost" disabled={!humanTokenSet || busy !== null} onClick={() => decide(r.review_id, "rejected")}>멈춤</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {decided.length > 0 && (
          <div className="mt-4 text-xs">
            <p className={`mb-1 font-medium ${tone}`}>최근 사람이 한 결정</p>
            <ul className="space-y-1">
              {decided.map((r) => (
                <li key={r.review_id} className="flex flex-wrap items-center gap-2 text-ink-700">
                  {pick(RESULT, r.status === "approved" ? "executed" : "rejected")}
                  <span>{action(r.action)} · {who(r.requester)}</span>
                  <span className="text-ink-500">{r.status === "expired" ? `${deadline} 지나 자동 취소` : `${r.decided_by}님이 ${r.status === "approved" ? "진행" : "멈춤"} · ${shortDateTime(r.decided_at)}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ①-1 캣북스에서 들어온 처리할 일 */}
      <CatbooksPanel data={catbooks} syncing={syncing} onSync={syncCatbooks} canSync={financeUp} />

      {/* ①-2 오늘의 돈 흐름 */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs text-ink-500">오늘 나간 돈</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{won(spent)}</p>
          <p className="mt-1 text-xs text-ink-500">처리된 쿠폰·환불 등의 합계</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-500">막아서 아낀 돈</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{won(blocked)}</p>
          <p className="mt-1 text-xs text-ink-500">재무 AI·규칙이 거절해 나가지 않은 금액</p>
        </div>
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-ink-500">오늘 쿠폰 한도</p>
            <p className="text-xs tabular-nums text-ink-500">{won(couponUsed)} / {won(couponLimit)}</p>
          </div>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${couponPct >= 80 ? "text-red-700" : ""}`}>{couponPct}% 사용</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100" role="img" aria-label={`오늘 쿠폰 한도 ${couponPct}% 사용`}>
            <div className={couponPct >= 80 ? "h-full bg-red-700" : "h-full bg-brand-500"} style={{ width: `${couponPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-500">한도를 넘으면 쿠폰은 재무 AI나 사람 확인으로 넘어갑니다</p>
        </div>
      </div>

      {/* ①-3 AI가 대신 결정한 일 */}
      <Section title="재무 AI가 대신 결정한 일" hint="기준을 조금 넘었지만 심각하지 않은 건을 재무 AI가 자료를 보고 결정했습니다. 이유를 확인할 수 있습니다.">
        <div className="card p-4">
          <ul className="divide-y divide-ink-100">
            {machine.map((r) => {
              const ok = r.status === "approved";
              const label = r.decided_by === AI_REVIEWER ? (ok ? "AI 승인" : "AI 거절") : "자동 거절";
              return (
                <li key={r.review_id} className="grid gap-2 py-3 sm:grid-cols-[110px_1fr_auto] sm:items-start">
                  <span><Chip label={label} tone={ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} /></span>
                  <div className="min-w-0">
                    <p className="text-sm"><b>{action(r.action)}</b> <span className="text-ink-500">· {who(r.requester)}</span></p>
                    {r.note && <p className="mt-0.5 text-sm text-ink-700">{r.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{money(r.report.computed_amount)}</p>
                    <p className="text-xs text-ink-500">{shortDateTime(r.decided_at)}</p>
                  </div>
                </li>
              );
            })}
            {!machine.length && <li className="py-4 text-center text-sm text-ink-500">아직 재무 AI가 대신 결정한 일이 없습니다.</li>}
          </ul>
        </div>
      </Section>

      {/* ② 처리 흐름 */}
      <Section title="들어온 요청이 어떻게 처리됐나" hint="다른 AI가 요청한 일은 금액과 종류에 따라 네 갈래로 나뉩니다.">
        <div className="card p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{flow.total}</span><span className="text-sm text-ink-500">건 요청</span>
          </div>
          <div className="mt-3 flex h-3 rounded-full bg-ink-100" role="img" aria-label={lanes.map((l) => `${l.title} ${l.count}건`).join(", ")}>
            {lanes.filter((l) => l.count > 0).map((l, i, shown) => (
              <div
                key={l.title}
                tabIndex={0}
                className={`group relative ${l.bar} ${i === 0 ? "rounded-l-full" : ""} ${i === shown.length - 1 ? "rounded-r-full" : ""} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
                style={{ width: pct(l.count) }}
              >
                <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-ink-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus-visible:block">
                  <p className="font-semibold">{l.title} <span className="tabular-nums">{l.count}건</span></p>
                  <p className="mt-0.5 text-ink-100">{l.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lanes.map((l) => (
              <div key={l.title} className={`border-l-4 ${l.border} pl-3`}>
                <p className="text-sm font-semibold">{l.title} <span className="tabular-nums">{l.count}건</span></p>
                <p className="text-xs text-ink-500">{l.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ③ 장애 손실 */}
      <Section title="장애로 생긴 손실" hint="피해 숫자는 데이터 AI가 센 값을 그대로 쓰고, 재무 AI는 보상으로 나간 돈을 더해 총 손실을 냅니다.">
        <div className="grid gap-4 md:grid-cols-2">
          {losses.map((l) => (
            <article key={l.context_id} className="card p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">장애 {l.context_id.replace("ctx_inc_", "#")}</h3>
                <span className="text-xs text-ink-500">{shortDateTime(l.at)} 정리</span>
              </div>
              <p className="mt-2 text-xs text-ink-500">총 손실</p>
              <p className="text-3xl font-bold tabular-nums text-red-700">{l.total_loss == null ? "알 수 없음" : won(l.total_loss)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-ink-100 pt-3 text-sm">
                <dt className="text-ink-500">실패한 주문</dt><dd className="text-right tabular-nums">{l.failed_orders == null ? "알 수 없음" : `${l.failed_orders}건`}</dd>
                <dt className="text-ink-500">피해 고객</dt><dd className="text-right tabular-nums">{l.affected_customers == null ? "알 수 없음" : `${l.affected_customers}명`}</dd>
                <dt className="text-ink-500">피해 금액</dt><dd className="text-right tabular-nums">{l.lost_amount == null ? "알 수 없음" : won(l.lost_amount)}</dd>
                <dt className="text-ink-500">보상으로 나간 돈</dt><dd className="text-right tabular-nums">{won(l.compensation_total)} ({l.compensation_coupon_count}장)</dd>
                <dt className="text-ink-500">피해 대비 보상</dt><dd className="text-right tabular-nums">{l.lost_amount ? `${Math.round((l.compensation_total / l.lost_amount) * 100)}%` : "알 수 없음"}</dd>
              </dl>
            </article>
          ))}
          {!losses.length && <p className="card p-5 text-sm text-ink-500">아직 정리한 손실이 없습니다. 장애가 끝나면 총괄 AI가 재무 AI에 손실 정리를 요청합니다.</p>}
        </div>
      </Section>

      {/* ④ 세부 기록 */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="재무 AI가 다시 계산한 결과" hint="요청한 쪽의 숫자를 믿지 않고 원래 자료로 다시 계산합니다.">
          <div className="card overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-500"><tr><th className="pb-2 font-medium">무엇을</th><th className="font-medium">결과</th><th className="font-medium">이유</th><th className="text-right font-medium">금액</th></tr></thead>
              <tbody>
                {verifications.slice(0, 10).map((v) => (
                  <tr key={v.execution_id} className="border-t border-ink-100 align-top">
                    <td className="py-2">{action(v.action)}<div className="text-xs text-ink-500">{who(v.requester)} · {shortDateTime(v.at)}</div></td>
                    <td className="py-2">{v.decision === "approved" ? <Chip label="통과" tone="bg-emerald-50 text-emerald-700" /> : <Chip label="막음" tone="bg-red-50 text-red-700" />}</td>
                    <td className="py-2 text-ink-700">{CHECK_KO[v.reason_code] ?? v.reason_code}</td>
                    <td className="py-2 text-right tabular-nums">{money(v.recomputed.total_value ?? v.recomputed.refund_amount)}</td>
                  </tr>
                ))}
                {!verifications.length && <tr><td colSpan={4} className="py-6 text-center text-ink-500">아직 계산한 일이 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="처리 내역" hint="가장 최근 요청부터 보여 줍니다.">
          <div className="card overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-500"><tr><th className="pb-2 font-medium">무엇을</th><th className="font-medium">처리 방식</th><th className="font-medium">결과</th><th className="text-right font-medium">금액</th></tr></thead>
              <tbody>
                {[...executions].reverse().slice(0, 10).map((e) => (
                  <tr key={e.execution_id} className="border-t border-ink-100 align-top">
                    <td className="py-2">{action(e.request.action)}<div className="text-xs text-ink-500">{who(e.request.requester)} · {shortDateTime(e.created_at)}</div></td>
                    <td className="py-2">{pick(WAY, e.decision.grade)}</td>
                    <td className="py-2">
                      {pick(RESULT, e.decision.status)}
                      {e.decision.hold_reason && <div className="mt-0.5 text-xs text-ink-500">{e.decision.hold_reason === "over_threshold" && e.decision.computed_amount == null ? "항상 사람이 확인하는 일" : WHY_HELD[e.decision.hold_reason] ?? e.decision.hold_reason}</div>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{money(e.decision.computed_amount)}</td>
                  </tr>
                ))}
                {!executions.length && <tr><td colSpan={4} className="py-6 text-center text-ink-500">아직 처리한 일이 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* 판매자 관리 */}
      <Section title="판매자 관리" hint="판매자 입점 심사와 정산 멈춤 결과입니다.">
        <div className="card p-4">
          <ul className="divide-y divide-ink-100 text-sm">
            {marketOps.slice(0, 8).map((m, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{m.skill === "seller_review" ? "입점 심사" : "정산 멈춤"}</span>
                <span className="text-ink-700">판매자 {m.seller_id.replace("sel_", "#")}{m.risk_score != null && ` · 위험 점수 ${m.risk_score}점`}</span>
                <span className="ml-auto flex items-center gap-2 text-xs text-ink-500">
                  {m.skill === "seller_review" && SELLER_WHY[m.reason_code]}
                  <Chip
                    label={m.skill === "seller_review" ? SELLER_KO[m.decision ?? ""] ?? m.decision ?? "" : HOLD_KO[m.status ?? ""] ?? m.status ?? ""}
                    tone={m.decision === "approved" || m.status === "held" ? "bg-emerald-50 text-emerald-700" : m.decision === "rejected" ? "bg-red-50 text-red-700" : "bg-ink-100 text-ink-500"}
                  />
                </span>
              </li>
            ))}
            {!marketOps.length && <li className="py-4 text-center text-ink-500">아직 판매자 관리 기록이 없습니다.</li>}
          </ul>
          {(ledger?.compensation ?? []).length > 0 && (
            <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
              장애별 보상 쿠폰: {ledger!.compensation.map((c) => `장애 ${c.context_id.replace("ctx_inc_", "#")} ${c.count}장 ${won(c.total)}`).join(", ")}
            </p>
          )}
        </div>
      </Section>

      {/* ⑤ 참고: 늘 펼쳐 둔다 */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="finance-skills" className="card p-5">
          <h2 id="finance-skills" className="text-base font-semibold text-ink-900">
            재무 AI가 하는 일 <span className="text-xs font-normal text-ink-500">{card?.skills.length ?? 0}가지</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {(card?.skills ?? []).map((s) => {
              const k = SKILL_KO[s.id];
              return (
                <li key={s.id} className="rounded-xl border border-ink-100 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{k?.name ?? s.id}</b>{pick(WAY, s.grade)}
                    <span className="ml-auto text-xs text-ink-500">요청할 수 있는 곳: {s.allowed_requesters.map(who).join(", ")}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-700">{k?.what ?? s.description}</p>
                </li>
              );
            })}
            {!card && <li className="py-4 text-center text-xs text-ink-500">재무 AI 정보를 불러올 수 없습니다.</li>}
          </ul>
        </section>

        <section aria-labelledby="finance-review-rules" className="card p-5">
          <h2 id="finance-review-rules" className="text-base font-semibold text-ink-900">
            사람 확인 기준 <span className="text-xs font-normal text-ink-500">{thresholds ? `결정 기한 ${deadline}` : ""}</span>
            {changesWaiting > 0 && <> <Chip label={`기준 바꾸기 ${changesWaiting}건 확인 대기`} tone="bg-amber-100 text-amber-800" /></>}
          </h2>
          <p className="mt-2 text-xs text-ink-500">아래 기준에 걸리면 AI가 처리하지 않고 사람이 결정합니다. 기준은 아래 "기준 바꾸기 요청"으로 바꿀 수 있고, 안전 장치 범위 안에서 재무 AI가 정합니다{thresholds && ` (현재 ${thresholds.version}번째 기준)`}.</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(thresholds?.rules ?? []).map((r) => (
              <li key={r.key} className="flex justify-between gap-3 border-t border-ink-100 pt-1.5">
                <span>{RULE_KO[r.key] ?? r.key}{Object.keys(r.when).length > 0 && <span className="text-ink-500"> (보상일 때)</span>}</span>
                <span className="text-right tabular-nums text-ink-700">
                  {r.metric === "paths_within" ? `${r.allowed.join(", ")} 밖이면` : `${MONEY_RULES.has(r.key) ? won(r.value) : num(r.value)} ${r.op === ">" ? "초과" : "이상"}이면`}
                </span>
              </li>
            ))}
          </ul>
          <ThresholdChangePanel thresholds={thresholds} changes={changes} reload={load} />
        </section>
      </div>
    </div>
  );
}
