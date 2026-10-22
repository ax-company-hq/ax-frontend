import { useCallback, useEffect, useState } from "react";
import { Loading, Stat } from "@/components/admin/bits";
import { ago, shortDateTime, won } from "@/lib/format";
import { finance, humanTokenSet, type AgentCard, type ExecutionRecord, type Ledger, type MarketOp, type Review, type Thresholds, type Verification } from "@/lib/finance";

// 재무 에이전트(finance) + 안전 레이어(safety) 화면. 숫자는 서버가 계산한 값을 그대로 보여 준다.

const STATUS_KO: Record<string, { label: string; tone: string }> = {
  executed: { label: "실행", tone: "bg-emerald-50 text-emerald-700" },
  held: { label: "보류 (사람 판단)", tone: "bg-amber-50 text-amber-700" },
  rejected: { label: "거부", tone: "bg-red-50 text-red-700" },
  verifying: { label: "검증 중", tone: "bg-brand-50 text-brand-700" },
  failed: { label: "실패", tone: "bg-ink-100 text-ink-500" },
};
const GRADE_TONE: Record<string, string> = { A: "bg-emerald-50 text-emerald-700", B: "bg-brand-50 text-brand-700", C: "bg-amber-50 text-amber-700", read: "bg-ink-100 text-ink-500" };
const HOLD_KO: Record<string, string> = {
  over_threshold: "기준 초과", unregistered_action: "미등록 액션", amount_mismatch: "금액 불일치", verify_rejected: "재무 거절",
  verify_timeout: "검증 무응답", schema_invalid: "형식 오류", review_timeout: "10분 미결정 자동 거절",
};
const REASON_KO: Record<string, string> = {
  recomputed_match: "재계산 일치", amount_mismatch: "금액 불일치", invalid_params: "입력 오류", not_affected: "영향 고객 아님",
  exceeds_paid: "결제 금액 초과", source_unavailable: "원천 데이터 없음", unsupported_action: "검증 대상 아님",
};
const RULE_KO: Record<string, string> = {
  coupon_total: "쿠폰 건별 총액", coupon_unit: "쿠폰 단가", coupon_daily: "쿠폰 일일 누적", compensation_per_context: "사건당 보상 누적",
  compensation_per_customer: "고객당 보상 누적", refund_single: "환불 건별", seller_risk: "판매자 위험 점수",
  pr_changed_lines: "PR 변경 줄 수", pr_changed_files: "PR 변경 파일 수", pr_allowed_paths: "PR 허용 경로", base_grade: "항상 C (정책)",
};

const Chip = ({ label, tone }: { label: string; tone: string }) => <span className={`chip ${tone}`}>{label}</span>;
const statusChip = (s: string) => { const st = STATUS_KO[s] ?? { label: s, tone: "bg-ink-100 text-ink-500" }; return <Chip {...st} />; };
const money = (n: number | null | undefined) => (n == null ? "–" : won(n));

function ruleText(r: Review["report"]["rules"]): string[] {
  return (r ?? []).map((h) => {
    const name = RULE_KO[h.key] ?? h.key;
    if (h.outside) return `${name}: 허용 경로 밖 ${h.outside.join(", ")}`;
    if (h.invalid) return `${name}: ${h.invalid} 값 없음·형식 오류`;
    if (h.observed != null && typeof h.value === "number") return `${name}: ${h.observed.toLocaleString("ko-KR")} ${h.op} ${h.value.toLocaleString("ko-KR")}`;
    return name;
  });
}

function remain(iso: string) {
  const sec = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  return `${Math.floor(sec / 60)}분 ${sec % 60}초 남음`;
}

interface View {
  card: AgentCard | null;
  executions: ExecutionRecord[];
  reviews: Review[];
  thresholds: Thresholds | null;
  verifications: Verification[];
  ledger: Ledger | null;
  marketOps: MarketOp[];
  safetyUp: boolean;
  financeUp: boolean;
}

/** 한쪽 서버가 꺼져 있어도 나머지는 보이도록 따로 받는다. */
async function loadAll(): Promise<View> {
  const pick = async <T,>(p: Promise<T>, fallback: T): Promise<[T, boolean]> => { try { return [await p, true]; } catch { return [fallback, false]; } };
  const [[card, financeUp], [executions, safetyUp], [reviews], [thresholds], [verifications], [ledger], [marketOps]] = await Promise.all([
    pick<AgentCard | null>(finance.card(), null),
    pick<ExecutionRecord[]>(finance.executions(), []),
    pick<Review[]>(finance.reviews(), []),
    pick<Thresholds | null>(finance.thresholds(), null),
    pick<Verification[]>(finance.verifications(), []),
    pick<Ledger | null>(finance.ledger(), null),
    pick<MarketOp[]>(finance.marketOps(), []),
  ]);
  return { card, executions, reviews, thresholds, verifications, ledger, marketOps, safetyUp, financeUp };
}

export default function FinancePage() {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(() => loadAll().then(setView), []);
  useEffect(() => {
    load();
    const poll = setInterval(load, 5000); // 판정·보류 큐는 5초마다 새로 받는다
    const clock = setInterval(() => tick((n) => n + 1), 1000); // 자동 거절까지 남은 시간
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id + decision);
    setError(null);
    try { await finance.decide(id, decision); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  if (!view) return <Loading error={null} />;
  const { card, executions, reviews, thresholds, verifications, ledger, marketOps, safetyUp, financeUp } = view;
  const pending = reviews.filter((r) => r.status === "pending");
  const decided = reviews.filter((r) => r.status !== "pending").slice(-5).reverse();
  const count = (s: string) => executions.filter((e) => e.decision.status === s).length;
  const approved = verifications.filter((v) => v.decision === "approved").length;

  return (
    <div className="space-y-6 px-8 pb-10 pt-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">재무 · 안전 레이어</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            모든 상태 변경(쿠폰·환불·판매자 승인·정산 보류 등)은 안전 레이어를 지납니다. 등급은 규칙이 정합니다. A는 바로 실행, B는 다른 부서가 교차검증한 뒤 실행(쿠폰·환불은 재무가 원천 데이터로 다시 계산), C는 사람이 판단하며 10분 안에 결정하지 않으면 자동 거절됩니다.
          </p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <Chip label={`safety ${safetyUp ? "연결됨" : "연결 안 됨"}`} tone={safetyUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
          <Chip label={`finance ${financeUp ? "연결됨" : "연결 안 됨"}`} tone={financeUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"} />
        </div>
      </div>

      {(!safetyUp || !financeUp) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-xs font-medium text-red-800">
          {!safetyUp && "안전 레이어(safety, 8001)에 연결할 수 없습니다. "}{!financeUp && "재무 에이전트(finance, 8105)에 연결할 수 없습니다. "}
          ax-backend에서 <code>docker compose -f infra/compose.yml up safety finance</code>로 띄웠는지 확인하세요.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-xs font-medium text-red-800">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Stat label="실행" value={count("executed")} sub="A 즉시 · B 검증 통과" tone="text-emerald-700" />
        <Stat label="사람 판단 대기 (C)" value={pending.length} sub="10분 미결정 시 자동 거절" tone="text-amber-700" />
        <Stat label="거부" value={count("rejected")} sub="재무 거절 · 자동 거절" tone="text-red-700" />
        <Stat label="재무 교차검증" value={`${approved} / ${verifications.length}`} sub="승인 / 전체" />
        <Stat label="기준표" value={thresholds ? `v${thresholds.version}` : "–"} sub={thresholds ? `검증 마감 ${thresholds.verify_timeout_seconds}초` : undefined} />
      </div>

      {/* C 보류 큐 */}
      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="card-title">C 보류 큐 — 사람 판단</h2>
          {!humanTokenSet && <span className="text-[11px] text-ink-500">사람 토큰(VITE_SAFETY_HUMAN_TOKEN)이 없어 결정 버튼이 꺼져 있습니다.</span>}
        </div>
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.review_id} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Chip label={HOLD_KO[r.report.hold_reason ?? ""] ?? r.report.hold_reason ?? "보류"} tone="bg-amber-100 text-amber-800" />
                <b className="text-sm">{r.action}</b>
                <span className="text-ink-500">요청 {r.requester} · {r.context_id} · {ago(r.created_at)}</span>
                <span className="ml-auto font-medium text-amber-700">{remain(r.expires_at)}</span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-ink-700 sm:grid-cols-2">
                {r.report.calculation && <p>계산: <b className="tabular-nums">{r.report.calculation}</b></p>}
                {r.report.claimed && <p>요청 쪽 주장: {Object.entries(r.report.claimed).map(([k, v]) => `${k}=${money(v)}`).join(", ")}</p>}
                {ruleText(r.report.rules).map((t) => <p key={t}>걸린 규칙: {t}</p>)}
                {r.report.reason && <p>사유: {r.report.reason}</p>}
                {r.report.verification && <p>검증: {r.report.verification.verifier} → {r.report.verification.result}</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary py-1 text-xs" disabled={!humanTokenSet || busy !== null} onClick={() => decide(r.review_id, "approved")}>승인</button>
                <button className="btn-ghost py-1 text-xs" disabled={!humanTokenSet || busy !== null} onClick={() => decide(r.review_id, "rejected")}>거절</button>
              </div>
            </li>
          ))}
          {!pending.length && <li className="py-6 text-center text-sm text-ink-500">사람 판단을 기다리는 건이 없습니다.</li>}
        </ul>
        {decided.length > 0 && (
          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="mb-2 text-[11px] font-medium text-ink-500">최근 결정</p>
            <ul className="space-y-1 text-xs">
              {decided.map((r) => (
                <li key={r.review_id} className="flex flex-wrap gap-2">
                  {statusChip(r.status === "approved" ? "executed" : "rejected")}
                  <span>{r.action} · {r.requester}</span>
                  <span className="text-ink-500">{r.status === "expired" ? "자동 거절(10분)" : `${r.decided_by} · ${shortDateTime(r.decided_at)}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 재무 교차검증 */}
        <section className="card p-5">
          <h2 className="card-title mb-3">재무 교차검증 (verify_amount)</h2>
          <table className="w-full text-xs">
            <thead className="text-left text-ink-500"><tr><th className="pb-2">시각</th><th>액션</th><th>판정</th><th>사유</th><th className="text-right">재계산</th></tr></thead>
            <tbody>
              {verifications.slice(0, 12).map((v) => (
                <tr key={v.execution_id} className="border-t border-ink-100">
                  <td className="py-2">{shortDateTime(v.at)}</td>
                  <td>{v.action}<span className="text-ink-500"> · {v.requester}</span></td>
                  <td>{v.decision === "approved" ? <Chip label="승인" tone="bg-emerald-50 text-emerald-700" /> : <Chip label="거절" tone="bg-red-50 text-red-700" />}</td>
                  <td>{REASON_KO[v.reason_code] ?? v.reason_code}</td>
                  <td className="text-right tabular-nums">{money(v.recomputed.total_value ?? v.recomputed.refund_amount)}</td>
                </tr>
              ))}
              {!verifications.length && <tr><td colSpan={5} className="py-6 text-center text-ink-500">아직 검증 요청이 없습니다.</td></tr>}
            </tbody>
          </table>
        </section>

        {/* 실행 기록 */}
        <section className="card p-5">
          <h2 className="card-title mb-3">실행 관문 기록</h2>
          <table className="w-full text-xs">
            <thead className="text-left text-ink-500"><tr><th className="pb-2">시각</th><th>액션</th><th>등급</th><th>결과</th><th className="text-right">계산 금액</th></tr></thead>
            <tbody>
              {[...executions].reverse().slice(0, 12).map((e) => (
                <tr key={e.execution_id} className="border-t border-ink-100">
                  <td className="py-2">{shortDateTime(e.created_at)}</td>
                  <td>{e.request.action}<span className="text-ink-500"> · {e.request.requester}</span></td>
                  <td><Chip label={e.decision.grade} tone={GRADE_TONE[e.decision.grade]} />{e.decision.verifier && <span className="ml-1 text-ink-500">검증 {e.decision.verifier}</span>}</td>
                  <td>{statusChip(e.decision.status)}{e.decision.hold_reason && <span className="ml-1 text-ink-500">{HOLD_KO[e.decision.hold_reason] ?? e.decision.hold_reason}</span>}</td>
                  <td className="text-right tabular-nums">{money(e.decision.computed_amount)}</td>
                </tr>
              ))}
              {!executions.length && <tr><td colSpan={5} className="py-6 text-center text-ink-500">아직 실행 요청이 없습니다.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 재무 에이전트 */}
        <section className="card p-5">
          <h2 className="card-title">재무 에이전트 {card && <span className="text-xs font-normal text-ink-500">· {card.owner} · v{card.version}</span>}</h2>
          {card && <p className="mt-1 text-xs text-ink-500">{card.description}</p>}
          <ul className="mt-3 space-y-2">
            {(card?.skills ?? []).map((s) => (
              <li key={s.id} className="rounded-xl border border-ink-100 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{s.id}</b><Chip label={s.grade} tone={GRADE_TONE[s.grade]} />
                  {s.verifier && <span className="text-ink-500">검증자 {s.verifier}</span>}
                  <span className="ml-auto text-ink-500">{s.priority} · 요청 {s.allowed_requesters.join(", ")}</span>
                </div>
                <p className="mt-1 leading-relaxed text-ink-700">{s.description}</p>
              </li>
            ))}
            {!card && <li className="py-4 text-center text-xs text-ink-500">재무 에이전트 카드를 불러올 수 없습니다.</li>}
          </ul>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-medium text-ink-500">사건별 보상 지급 (coupon.issued)</p>
              <ul className="space-y-1 text-xs">
                {(ledger?.compensation ?? []).map((c) => <li key={c.context_id} className="flex justify-between"><span>{c.context_id}</span><span className="tabular-nums">{c.count}장 · {won(c.total)}</span></li>)}
                {!ledger?.compensation.length && <li className="text-ink-500">기록 없음</li>}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-ink-500">마켓운영 (판매자 심사 · 정산 보류)</p>
              <ul className="space-y-1 text-xs">
                {marketOps.slice(0, 6).map((m, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{m.skill === "seller_review" ? "심사" : "정산 보류"} {m.seller_id}{m.risk_score != null && ` (위험 ${m.risk_score})`}</span>
                    <span className="text-ink-500">{m.decision ?? m.status}</span>
                  </li>
                ))}
                {!marketOps.length && <li className="text-ink-500">기록 없음</li>}
              </ul>
            </div>
          </div>
        </section>

        {/* 기준표 */}
        <section className="card p-5">
          <h2 className="card-title mb-1">기준 금액 등급표 {thresholds && `v${thresholds.version}`}</h2>
          <p className="mb-3 text-xs text-ink-500">사람만 바꿉니다(PR). 이 값에 걸리면 C, 아니면 액션의 기본 등급입니다.</p>
          <table className="w-full text-xs">
            <thead className="text-left text-ink-500"><tr><th className="pb-2">기준</th><th>액션</th><th className="text-right">C 조건</th></tr></thead>
            <tbody>
              {(thresholds?.rules ?? []).map((r) => (
                <tr key={r.key} className="border-t border-ink-100">
                  <td className="py-2">{RULE_KO[r.key] ?? r.key}{Object.keys(r.when).length > 0 && <span className="text-ink-500"> (보상만)</span>}</td>
                  <td className="text-ink-500">{r.action}</td>
                  <td className="text-right tabular-nums">
                    {r.metric === "paths_within" ? `${r.allowed.join(", ")} 밖` : `${r.op} ${["param"].includes(r.metric) ? r.value.toLocaleString("ko-KR") : won(r.value)}`}
                  </td>
                </tr>
              ))}
              {!thresholds && <tr><td colSpan={3} className="py-6 text-center text-ink-500">기준표를 불러올 수 없습니다.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
