import { useCallback, useEffect, useState } from "react";
import { Loading, Stat } from "@/components/admin/bits";
import { ago, shortDateTime, won } from "@/lib/format";
import {
  finance, humanTokenSet,
  type AgentCard, type ExecutionRecord, type Ledger, type LossReport, type MarketOp, type Review, type RuleHit, type Thresholds, type Verification,
} from "@/lib/finance";

// 재무 AI 화면. 서버(safety·finance)가 계산한 숫자를 그대로 보여 주고, 말만 쉽게 바꾼다.

// 하는 일 이름 (서버의 영어 이름 → 쉬운 말)
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

// 처리 방식: A·B·C 대신 무엇이 일어났는지로 보여 준다
const WAY: Record<string, { label: string; tone: string }> = {
  A: { label: "바로 처리", tone: "bg-emerald-50 text-emerald-700" },
  B: { label: "다시 확인 후 처리", tone: "bg-brand-50 text-brand-700" },
  C: { label: "사람 확인", tone: "bg-amber-50 text-amber-700" },
  read: { label: "보기만 함", tone: "bg-ink-100 text-ink-500" },
};
const RESULT: Record<string, { label: string; tone: string }> = {
  executed: { label: "처리됨", tone: "bg-emerald-50 text-emerald-700" },
  held: { label: "사람 확인 기다림", tone: "bg-amber-50 text-amber-700" },
  rejected: { label: "막힘", tone: "bg-red-50 text-red-700" },
  verifying: { label: "확인 중", tone: "bg-brand-50 text-brand-700" },
  failed: { label: "오류", tone: "bg-ink-100 text-ink-500" },
};
// 왜 멈췄는지
const WHY_HELD: Record<string, string> = {
  over_threshold: "금액 기준을 넘음", unregistered_action: "등록되지 않은 일", amount_mismatch: "적어 낸 금액과 계산이 다름",
  verify_rejected: "재무 AI가 거절함", verify_timeout: "확인하는 쪽이 응답하지 않음", schema_invalid: "요청 내용이 잘못됨",
  review_timeout: "10분 동안 아무도 결정하지 않아 자동 취소",
};
// 재무 AI가 다시 계산해 본 결과
const CHECK_KO: Record<string, string> = {
  recomputed_match: "계산이 맞음", amount_mismatch: "적어 낸 금액과 계산이 다름", invalid_params: "요청 내용이 잘못됨",
  not_affected: "장애 피해를 본 고객이 아님", exceeds_paid: "결제한 금액보다 많이 환불하려 함",
  source_unavailable: "확인할 자료가 없어 통과시키지 않음", unsupported_action: "재무가 확인하는 일이 아님",
};
// 기준 이름
const RULE_KO: Record<string, string> = {
  coupon_total: "쿠폰 한 번에 주는 총액", coupon_unit: "쿠폰 한 장 금액", coupon_daily: "하루 동안 준 쿠폰 합계",
  compensation_per_context: "장애 한 건에 준 보상 합계", compensation_per_customer: "한 고객에게 준 보상 합계",
  refund_single: "환불 한 건 금액", seller_risk: "판매자 위험 점수", pr_changed_lines: "코드 변경 줄 수",
  pr_changed_files: "코드 변경 파일 수", pr_allowed_paths: "코드를 바꿔도 되는 폴더", base_grade: "항상 사람이 확인하는 일",
};
const MONEY_RULES = new Set(["coupon_total", "coupon_unit", "coupon_daily", "compensation_per_context", "compensation_per_customer", "refund_single"]);
// 재무 AI가 하는 일
const SKILL_KO: Record<string, { name: string; what: string }> = {
  verify_amount: { name: "금액 다시 계산하기", what: "쿠폰이나 환불을 하기 전에, 금액이 맞는지와 받을 사람이 맞는지 원래 자료로 다시 계산합니다. 자료가 없으면 통과시키지 않습니다." },
  loss_aggregation: { name: "장애 손실 정리", what: "장애 때문에 실패한 주문 수, 피해 금액, 보상으로 나간 돈을 합쳐서 총 손실을 알려 줍니다." },
  seller_review: { name: "판매자 입점 심사", what: "서류와 위험 점수를 보고 입점을 승인합니다. 위험 점수가 높으면 사람이 확인합니다. 판매자가 쓴 소개글은 판단에 쓰지 않습니다." },
  settlement_hold: { name: "판매자 정산 멈춤", what: "문제가 있는 판매자에게 돈이 나가지 않도록 정산을 멈춥니다. 실제 송금은 하지 않습니다." },
};
const SELLER_KO: Record<string, string> = { approved: "승인", rejected: "거절", held: "사람 확인 중", undetermined: "판단 보류 (자료 없음)" };
const HOLD_KO: Record<string, string> = { held: "정산 멈춤", pending_review: "사람 확인 중", rejected: "멈추지 않음" };
const SELLER_WHY: Record<string, string> = { documents_missing: "서류 미확인", risk_unavailable: "위험 점수를 못 받음", risk_checked: "위험 점수 확인함" };

const Chip = ({ label, tone }: { label: string; tone: string }) => <span className={`chip ${tone}`}>{label}</span>;
const pick = (map: Record<string, { label: string; tone: string }>, key: string) => <Chip {...(map[key] ?? { label: key, tone: "bg-ink-100 text-ink-500" })} />;
const money = (n: number | null | undefined) => (n == null ? "–" : won(n));
const num = (n: number) => n.toLocaleString("ko-KR");

/** 서버 계산식의 필드 이름을 쉬운 말로: "refund_amount = 150,000원" → "환불 금액 150,000원", "3 × 5,000 = 15,000원" → "3장 × 5,000원 = 15,000원" */
function calcText(c: string): string {
  const m = c.match(/^([\d,]+) × ([\d,]+) = (.+)$/);
  if (m) return `${m[1]}장 × ${m[2]}원 = ${m[3]}`;
  return c.replace("refund_amount = ", "환불 금액 ");
}

function ruleSentence(h: RuleHit): string {
  const name = RULE_KO[h.key] ?? h.key;
  if (h.key === "base_grade") return name;
  if (h.outside) return `${name}가 아닌 곳을 바꿈: ${h.outside.join(", ")}`;
  if (h.invalid) return `${name} 정보가 없음`;
  if (h.observed != null && typeof h.value === "number") {
    const f = MONEY_RULES.has(h.key) ? won : num;
    return `${name} ${f(h.observed)} — 기준 ${f(h.value)}${h.op === ">" ? " 초과" : " 이상"}이면 사람 확인`;
  }
  return name;
}

function holdTitle(r: Review): string {
  if (r.report.rules?.some((h) => h.key === "base_grade")) return "항상 사람이 확인하는 일";
  return WHY_HELD[r.report.hold_reason ?? ""] ?? "확인 필요";
}

function remain(iso: string) {
  const sec = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  return `${Math.floor(sec / 60)}분 ${sec % 60}초 안에 결정하지 않으면 자동 취소`;
}

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

export default function FinancePage() {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(() => loadAll().then(setView), []);
  useEffect(() => {
    load();
    const poll = setInterval(load, 5000); // 5초마다 새로 받는다
    const clock = setInterval(() => tick((n) => n + 1), 1000); // 자동 취소까지 남은 시간
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id + decision);
    setError(null);
    try { await finance.decide(id, decision); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  if (!view) return <Loading error={null} />;
  const { card, executions, reviews, thresholds, verifications, ledger, marketOps, losses, safetyUp, financeUp } = view;
  const pending = reviews.filter((r) => r.status === "pending");
  const decided = reviews.filter((r) => r.status !== "pending").slice(-5).reverse();
  const count = (s: string) => executions.filter((e) => e.decision.status === s).length;
  const passed = verifications.filter((v) => v.decision === "approved").length;

  return (
    <div className="space-y-6 px-8 pb-10 pt-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">재무 AI</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            돈이 나가는 일(쿠폰, 환불, 판매자 정산)은 바로 처리되지 않고 한 번 더 확인을 거칩니다. 금액은 AI가 아니라 정해진 계산과 기준으로 판단합니다.
          </p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <Chip label={safetyUp ? "안전 장치 켜짐" : "안전 장치 꺼짐"} tone={safetyUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
          <Chip label={financeUp ? "재무 AI 켜짐" : "재무 AI 꺼짐"} tone={financeUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
        </div>
      </div>

      {/* 어떻게 처리되나 */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { t: "작은 일 → 바로 처리", d: "공지 올리기, 기록 남기기처럼 돈이 나가지 않는 일", tone: "border-emerald-100 bg-emerald-50/50" },
          { t: "중간 금액 → 다시 확인 후 처리", d: "쿠폰·환불은 재무 AI가 금액과 받을 사람을 원래 자료로 다시 계산한 뒤 처리", tone: "border-brand-100 bg-brand-50/50" },
          { t: "큰 금액·예외 → 사람 확인", d: "기준을 넘거나 이상하면 멈추고 사람이 결정. 10분 안에 결정하지 않으면 자동 취소", tone: "border-amber-100 bg-amber-50/50" },
        ].map((x) => (
          <div key={x.t} className={`rounded-2xl border px-4 py-3 ${x.tone}`}>
            <p className="text-sm font-semibold">{x.t}</p>
            <p className="mt-1 text-xs text-ink-700">{x.d}</p>
          </div>
        ))}
      </div>

      {(!safetyUp || !financeUp) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-xs font-medium text-red-800">
          {!safetyUp && "안전 장치 서버(8001)가 꺼져 있습니다. "}{!financeUp && "재무 AI 서버(8105)가 꺼져 있습니다. "}
          ax-backend에서 <code>docker compose -f infra/compose.yml up safety finance</code>로 켜 주세요.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-xs font-medium text-red-800">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Stat label="처리됨" value={count("executed")} sub="바로 처리 + 확인 후 처리" tone="text-emerald-700" />
        <Stat label="사람 확인 기다림" value={pending.length} sub="10분 지나면 자동 취소" tone="text-amber-700" />
        <Stat label="막힘" value={count("rejected")} sub="재무 AI 거절 · 자동 취소" tone="text-red-700" />
        <Stat label="재무 AI 다시 계산" value={`${passed} / ${verifications.length}`} sub="통과 / 전체" />
      </div>

      {/* 사람 확인 */}
      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="card-title">사람 확인이 필요한 일</h2>
          {!humanTokenSet && <span className="text-[11px] text-ink-500">결정 권한(VITE_SAFETY_HUMAN_TOKEN)이 설정되지 않아 버튼이 꺼져 있습니다.</span>}
        </div>
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.review_id} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Chip label={holdTitle(r)} tone="bg-amber-100 text-amber-800" />
                <b className="text-sm">{action(r.action)}</b>
                <span className="text-ink-500">{who(r.requester)}가 요청 · {ago(r.created_at)}</span>
                <span className="ml-auto font-medium text-amber-700">{remain(r.expires_at)}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-ink-700">
                {r.report.calculation && <li>계산: <b className="tabular-nums">{calcText(r.report.calculation)}</b></li>}
                {r.report.claimed && <li>요청한 쪽이 적어 낸 금액: {Object.values(r.report.claimed).map((v) => money(v)).join(", ")}</li>}
                {(r.report.rules ?? []).map((h, i) => <li key={i}>이유: {ruleSentence(h)}</li>)}
                {r.report.reason && r.report.hold_reason === "unregistered_action" && <li>이유: 등록되지 않은 일이거나 이 AI가 요청할 수 없는 일</li>}
                {r.report.verification && <li>재무 AI 확인: {r.report.verification.result === "unavailable" ? "응답 없음" : r.report.verification.result}</li>}
              </ul>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary py-1 text-xs" disabled={!humanTokenSet || busy !== null} onClick={() => decide(r.review_id, "approved")}>진행해도 돼요</button>
                <button className="btn-ghost py-1 text-xs" disabled={!humanTokenSet || busy !== null} onClick={() => decide(r.review_id, "rejected")}>멈춰 주세요</button>
              </div>
            </li>
          ))}
          {!pending.length && <li className="py-6 text-center text-sm text-ink-500">지금 사람이 확인할 일은 없습니다.</li>}
        </ul>
        {decided.length > 0 && (
          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="mb-2 text-[11px] font-medium text-ink-500">최근 결정</p>
            <ul className="space-y-1 text-xs">
              {decided.map((r) => (
                <li key={r.review_id} className="flex flex-wrap gap-2">
                  {pick(RESULT, r.status === "approved" ? "executed" : "rejected")}
                  <span>{action(r.action)} · {who(r.requester)}</span>
                  <span className="text-ink-500">{r.status === "expired" ? "10분 지나 자동 취소" : `${r.decided_by}님이 ${r.status === "approved" ? "진행" : "멈춤"} · ${shortDateTime(r.decided_at)}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 장애 손실 */}
      <section className="card p-5">
        <h2 className="card-title mb-1">장애로 생긴 손실</h2>
        <p className="mb-3 text-xs text-ink-500">피해 숫자는 데이터 AI가 센 값을 그대로 쓰고, 재무 AI는 보상으로 나간 돈을 더해 총 손실을 냅니다.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {losses.map((l) => (
            <div key={l.context_id} className="rounded-2xl border border-ink-100 p-4 text-xs">
              <div className="mb-2 flex justify-between"><b className="text-sm">장애 {l.context_id.replace("ctx_inc_", "#")}</b><span className="text-ink-500">{shortDateTime(l.at)}</span></div>
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-ink-500">실패한 주문</dt><dd className="text-right tabular-nums">{l.failed_orders == null ? "알 수 없음" : `${l.failed_orders}건`}</dd>
                <dt className="text-ink-500">피해 고객</dt><dd className="text-right tabular-nums">{l.affected_customers == null ? "알 수 없음" : `${l.affected_customers}명`}</dd>
                <dt className="text-ink-500">피해 금액</dt><dd className="text-right tabular-nums">{l.lost_amount == null ? "알 수 없음" : won(l.lost_amount)}</dd>
                <dt className="text-ink-500">보상으로 나간 돈</dt><dd className="text-right tabular-nums">{won(l.compensation_total)} ({l.compensation_coupon_count}장)</dd>
                <dt className="font-semibold">총 손실</dt><dd className="text-right font-semibold tabular-nums">{l.total_loss == null ? "알 수 없음" : won(l.total_loss)}</dd>
              </dl>
            </div>
          ))}
          {!losses.length && <p className="text-xs text-ink-500">아직 정리한 손실이 없습니다.</p>}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 다시 계산 결과 */}
        <section className="card p-5">
          <h2 className="card-title mb-1">재무 AI가 다시 계산한 결과</h2>
          <p className="mb-3 text-xs text-ink-500">쿠폰·환불을 하기 전에 요청한 쪽의 숫자를 믿지 않고 원래 자료로 다시 계산합니다.</p>
          <table className="w-full text-xs">
            <thead className="text-left text-ink-500"><tr><th className="pb-2">언제</th><th>무엇을</th><th>결과</th><th>이유</th><th className="text-right">다시 계산한 금액</th></tr></thead>
            <tbody>
              {verifications.slice(0, 12).map((v) => (
                <tr key={v.execution_id} className="border-t border-ink-100">
                  <td className="py-2">{shortDateTime(v.at)}</td>
                  <td>{action(v.action)}<span className="text-ink-500"> · {who(v.requester)}</span></td>
                  <td>{v.decision === "approved" ? <Chip label="통과" tone="bg-emerald-50 text-emerald-700" /> : <Chip label="거절" tone="bg-red-50 text-red-700" />}</td>
                  <td>{CHECK_KO[v.reason_code] ?? v.reason_code}</td>
                  <td className="text-right tabular-nums">{money(v.recomputed.total_value ?? v.recomputed.refund_amount)}</td>
                </tr>
              ))}
              {!verifications.length && <tr><td colSpan={5} className="py-6 text-center text-ink-500">아직 계산한 일이 없습니다.</td></tr>}
            </tbody>
          </table>
        </section>

        {/* 처리 내역 */}
        <section className="card p-5">
          <h2 className="card-title mb-1">처리 내역</h2>
          <p className="mb-3 text-xs text-ink-500">AI들이 요청한 일이 어떻게 처리됐는지 순서대로 보여 줍니다.</p>
          <table className="w-full text-xs">
            <thead className="text-left text-ink-500"><tr><th className="pb-2">언제</th><th>무엇을</th><th>처리 방식</th><th>결과</th><th className="text-right">금액</th></tr></thead>
            <tbody>
              {[...executions].reverse().slice(0, 12).map((e) => (
                <tr key={e.execution_id} className="border-t border-ink-100">
                  <td className="py-2">{shortDateTime(e.created_at)}</td>
                  <td>{action(e.request.action)}<span className="text-ink-500"> · {who(e.request.requester)}</span></td>
                  <td>{pick(WAY, e.decision.grade)}</td>
                  <td>{pick(RESULT, e.decision.status)}{e.decision.hold_reason && <div className="mt-0.5 text-[11px] text-ink-500">{e.decision.hold_reason === "over_threshold" && e.decision.computed_amount == null ? "항상 사람이 확인하는 일" : WHY_HELD[e.decision.hold_reason] ?? e.decision.hold_reason}</div>}</td>
                  <td className="text-right tabular-nums">{money(e.decision.computed_amount)}</td>
                </tr>
              ))}
              {!executions.length && <tr><td colSpan={5} className="py-6 text-center text-ink-500">아직 처리한 일이 없습니다.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 재무 AI가 하는 일 */}
        <section className="card p-5">
          <h2 className="card-title">재무 AI가 하는 일</h2>
          <ul className="mt-3 space-y-2">
            {(card?.skills ?? []).map((s) => {
              const k = SKILL_KO[s.id];
              return (
                <li key={s.id} className="rounded-xl border border-ink-100 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[13px]">{k?.name ?? s.id}</b>
                    {pick(WAY, s.grade)}
                    <span className="ml-auto text-ink-500">요청할 수 있는 곳: {s.allowed_requesters.map(who).join(", ")}</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-ink-700">{k?.what ?? s.description}</p>
                </li>
              );
            })}
            {!card && <li className="py-4 text-center text-xs text-ink-500">재무 AI 정보를 불러올 수 없습니다.</li>}
          </ul>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-medium text-ink-500">장애별 보상으로 나간 쿠폰</p>
              <ul className="space-y-1 text-xs">
                {(ledger?.compensation ?? []).map((c) => <li key={c.context_id} className="flex justify-between"><span>장애 {c.context_id.replace("ctx_inc_", "#")}</span><span className="tabular-nums">{c.count}장 · {won(c.total)}</span></li>)}
                {!ledger?.compensation.length && <li className="text-ink-500">아직 없음</li>}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-ink-500">판매자 심사 · 정산 멈춤</p>
              <ul className="space-y-1 text-xs">
                {marketOps.slice(0, 6).map((m, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{m.skill === "seller_review" ? "입점 심사" : "정산 멈춤"} · 판매자 {m.seller_id.replace("sel_", "#")}{m.risk_score != null && ` (위험 ${m.risk_score}점)`}</span>
                    <span className="text-ink-500">
                      {m.skill === "seller_review" ? SELLER_KO[m.decision ?? ""] ?? m.decision : HOLD_KO[m.status ?? ""] ?? m.status}
                      {m.skill === "seller_review" && SELLER_WHY[m.reason_code] && ` · ${SELLER_WHY[m.reason_code]}`}
                    </span>
                  </li>
                ))}
                {!marketOps.length && <li className="text-ink-500">아직 없음</li>}
              </ul>
            </div>
          </div>
        </section>

        {/* 기준표 */}
        <section className="card p-5">
          <h2 className="card-title mb-1">사람 확인 기준</h2>
          <p className="mb-3 text-xs text-ink-500">아래 기준에 걸리면 AI가 처리하지 않고 사람이 결정합니다. 기준은 사람만 바꿀 수 있습니다{thresholds && ` (현재 ${thresholds.version}번째 기준)`}.</p>
          <ul className="space-y-1.5 text-xs">
            {(thresholds?.rules ?? []).map((r) => (
              <li key={r.key} className="flex justify-between gap-3 border-t border-ink-100 pt-1.5">
                <span>{RULE_KO[r.key] ?? r.key}{Object.keys(r.when).length > 0 && <span className="text-ink-500"> (보상일 때)</span>}</span>
                <span className="text-right tabular-nums text-ink-700">
                  {r.metric === "paths_within"
                    ? `${r.allowed.join(", ")} 밖이면`
                    : `${MONEY_RULES.has(r.key) ? won(r.value) : num(r.value)} ${r.op === ">" ? "초과" : "이상"}이면`}
                </span>
              </li>
            ))}
            {!thresholds && <li className="py-6 text-center text-ink-500">기준을 불러올 수 없습니다.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
