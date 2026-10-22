import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loading } from "@/components/admin/bits";
import { ago, shortDateTime, won } from "@/lib/format";
import {
  finance, humanTokenSet,
  type AgentCard, type ExecutionRecord, type Ledger, type LossReport, type MarketOp, type Review, type RuleHit, type Thresholds, type Verification,
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
  safetyUp: boolean;
  financeUp: boolean;
}

/** 한쪽 서버가 꺼져 있어도 나머지는 보이도록 따로 받는다. */
async function loadAll(): Promise<View> {
  const get = async <T,>(p: Promise<T>, fallback: T): Promise<[T, boolean]> => { try { return [await p, true]; } catch { return [fallback, false]; } };
  const [[card, financeUp], [executions, safetyUp], [reviews], [thresholds], [verifications], [ledger], [marketOps], [losses]] = await Promise.all([
    get<AgentCard | null>(finance.card(), null),
    get<ExecutionRecord[]>(finance.executions(), []),
    get<Review[]>(finance.reviews(), []),
    get<Thresholds | null>(finance.thresholds(), null),
    get<Verification[]>(finance.verifications(), []),
    get<Ledger | null>(finance.ledger(), null),
    get<MarketOp[]>(finance.marketOps(), []),
    get<LossReport[]>(finance.lossReports(), []),
  ]);
  return { card, executions, reviews, thresholds, verifications, ledger, marketOps, losses, safetyUp, financeUp };
}

/** 처리 흐름: 들어온 요청이 어디로 갔는지. 숫자는 서버 판정을 그대로 센다. */
function flowOf(executions: ExecutionRecord[]) {
  const viaFinance = (e: ExecutionRecord) =>
    !!e.decision.verifier && e.decision.verifier !== "safety" && e.decision.hold_reason !== "over_threshold";
  const direct = executions.filter((e) => e.decision.grade === "A").length;
  const checked = executions.filter(viaFinance);
  const checkedPass = checked.filter((e) => e.decision.status === "executed").length;
  const human = executions.filter((e) => e.decision.grade === "C" && !viaFinance(e)).length;
  return { total: executions.length, direct, checked: checked.length, checkedPass, checkedStop: checked.length - checkedPass, human };
}

// ---------------------------------------------------------------- 화면
export default function FinancePage() {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(() => loadAll().then(setView), []);
  useEffect(() => {
    load();
    const poll = setInterval(load, 5000); // 5초마다 새로 받는다
    const clock = setInterval(() => tick((n) => n + 1), 30000); // 남은 시간 표시
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id + decision);
    setError(null);
    try { await finance.decide(id, decision); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  if (!view) return <Loading error={null} />;
  const { card, executions, reviews, thresholds, verifications, ledger, marketOps, losses, safetyUp, financeUp } = view;
  const deadline = thresholds ? duration(thresholds.review_timeout_seconds) : "정해진 시간";
  const pending = reviews.filter((r) => r.status === "pending").sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  const decided = reviews.filter((r) => r.status !== "pending").slice(-5).reverse();
  const pendingMoney = pending.reduce((sum, r) => sum + (r.report.computed_amount ?? 0), 0);
  const flow = flowOf(executions);
  const pct = (n: number) => (flow.total ? `${(n / flow.total) * 100}%` : "0%");
  const tone = pending.length ? "text-amber-800" : "text-emerald-800";

  return (
    <div className="max-w-[1320px] space-y-8 px-8 pb-12 pt-2">
      {/* 머리말 */}
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">재무 AI</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">쿠폰, 환불, 판매자 정산처럼 돈이 나가는 일을 한 번 더 확인합니다. 금액은 AI가 아니라 정해진 계산과 기준으로 판단합니다.</p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <Chip label={safetyUp ? "안전 장치 켜짐" : "안전 장치 꺼짐"} tone={safetyUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
          <Chip label={financeUp ? "재무 AI 켜짐" : "재무 AI 꺼짐"} tone={financeUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
        </div>
      </header>

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
            기준을 넘거나 이상한 요청은 AI가 처리하지 않고 여기서 기다립니다. {deadline} 안에 결정하지 않으면 자동으로 취소됩니다.
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
            <p className={`mb-1 font-medium ${tone}`}>최근 결정</p>
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

      {/* ② 처리 흐름 */}
      <Section title="들어온 요청이 어떻게 처리됐나" hint="다른 AI가 요청한 일은 금액과 종류에 따라 세 갈래로 나뉩니다.">
        <div className="card p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{flow.total}</span><span className="text-sm text-ink-500">건 요청</span>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-ink-100" role="img" aria-label={`바로 처리 ${flow.direct}건, 재무 AI 확인 ${flow.checked}건, 사람 확인 ${flow.human}건`}>
            <div className="bg-emerald-700" style={{ width: pct(flow.direct) }} />
            <div className="bg-brand-500" style={{ width: pct(flow.checked) }} />
            <div className="bg-amber-700" style={{ width: pct(flow.human) }} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="border-l-4 border-emerald-700 pl-3">
              <p className="text-sm font-semibold">바로 처리 <span className="tabular-nums">{flow.direct}건</span></p>
              <p className="text-xs text-ink-500">공지, 기록처럼 돈이 나가지 않는 일</p>
            </div>
            <div className="border-l-4 border-brand-500 pl-3">
              <p className="text-sm font-semibold">재무 AI가 확인 <span className="tabular-nums">{flow.checked}건</span></p>
              <p className="text-xs text-ink-500">통과 {flow.checkedPass}건, 막음 {flow.checkedStop}건. 금액과 받을 사람을 원래 자료로 다시 계산</p>
            </div>
            <div className="border-l-4 border-amber-700 pl-3">
              <p className="text-sm font-semibold">사람 확인으로 <span className="tabular-nums">{flow.human}건</span></p>
              <p className="text-xs text-ink-500">기준을 넘거나 이상한 요청. 지금 {pending.length}건이 결정을 기다림</p>
            </div>
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

      {/* ⑤ 참고: 접어 둔다 */}
      <div className="grid gap-4 xl:grid-cols-2">
        <details className="card p-5">
          <summary className="cursor-pointer text-base font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
            재무 AI가 하는 일 <span className="text-xs font-normal text-ink-500">{card?.skills.length ?? 0}가지</span>
          </summary>
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
        </details>

        <details className="card p-5">
          <summary className="cursor-pointer text-base font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
            사람 확인 기준 <span className="text-xs font-normal text-ink-500">{thresholds ? `결정 기한 ${deadline}` : ""}</span>
          </summary>
          <p className="mt-2 text-xs text-ink-500">아래 기준에 걸리면 AI가 처리하지 않고 사람이 결정합니다. 기준은 사람만 바꿀 수 있습니다{thresholds && ` (현재 ${thresholds.version}번째 기준)`}.</p>
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
        </details>
      </div>
    </div>
  );
}
