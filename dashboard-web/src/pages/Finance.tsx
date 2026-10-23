import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuditSection } from "@/components/finance/Audit";
import { ClosingSection } from "@/components/finance/Closing";
import { Chip, ErrorBox, MetaLine, MockBadge, TONE, Waiting, useResource } from "@/components/finance/bits";
import { CatbooksPanel, LossReports, SelfTestPanel, TEST_TTL_HOURS, freshTest } from "@/components/finance/Kept";
import { PolicySection } from "@/components/finance/Policy";
import { ReconciliationSection } from "@/components/finance/Reconciliation";
import { SafetyQueue } from "@/components/finance/SafetyQueue";
import { SettlementsSection } from "@/components/finance/Settlements";
import { Link } from "@/lib/nav";
import {
  FINANCE_SERVER, FINANCE_TABS, SAFETY_SERVER, finance, krw, todoTab,
  type CatbooksItems, type FinanceKpis, type FinanceTab, type FinanceTodo, type LossReport, type Review, type SelfTest,
} from "@/lib/finance";

// 재무 AI 화면 = 캣북스 재무팀. 자동 수집 → 규칙으로 맞춤 → 예외만 사람에게 → 결산·리포트.
// 건별 금액 승인은 하지 않는다(건별 검사는 안전 장치). 숫자는 서버가 계산한 값을 그대로 보여 주고, 말만 쉽게 바꾼다.
// 기준: ax-backend docs/notes/finance/2026-10-23-finance-redesign.md §8·§11

const REFRESH_MS = 30_000;

const TAB_LABEL: Record<FinanceTab, string> = {
  closing: "① 결산·리포트",
  reconciliation: "② 매출·PG 대사",
  settlements: "③ 판매자 정산",
  policy: "⑤ 예산·한도",
  audit: "⑦ 내부통제·감사",
};

const KPI: { key: keyof FinanceKpis; label: string; hint: string }[] = [
  { key: "gmv", label: "총거래액", hint: "고객이 결제한 금액 전체" },
  { key: "commission_revenue", label: "판매 수수료 매출", hint: "판매자에게 받는 수수료. 캣북스의 매출" },
  { key: "refund_total", label: "환불", hint: "고객에게 돌려준 돈" },
  { key: "coupon_cost", label: "쿠폰 비용", hint: "회사가 부담한 쿠폰 할인" },
  { key: "pg_fee", label: "PG 수수료", hint: "결제대행사에 내는 수수료" },
  { key: "net_result", label: "영업 결과", hint: "수수료 매출에서 비용을 뺀 값" },
];

const TODO_TONE: Record<FinanceTodo["kind"], string> = {
  settlement_batch: TONE.info, closing_confirm: TONE.info, recon_exception: TONE.bad, audit_finding: TONE.warn, policy_alert: TONE.warn,
};
const TODO_KO: Record<FinanceTodo["kind"], string> = {
  settlement_batch: "판매자 정산", closing_confirm: "결산", recon_exception: "대사", audit_finding: "감사", policy_alert: "한도",
};

/** 한쪽 서버가 꺼져 있어도 나머지는 보이도록 따로 받는다 */
async function settle<T>(p: Promise<T>): Promise<[T | null, string | null]> {
  try { return [await p, null]; } catch (e) { return [null, (e as Error).message]; }
}

const scrollToId = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));

export default function FinancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const hashTab = location.hash.replace(/^#/, "");
  const tab: FinanceTab = (FINANCE_TABS as string[]).includes(hashTab) ? (hashTab as FinanceTab) : "closing";
  const openTab = useCallback((t: FinanceTab, scroll = false) => {
    navigate({ hash: `#${t}` }, { replace: true });
    if (scroll) scrollToId("finance-modules");
  }, [navigate]);

  // 30초마다, 그리고 무언가를 바꾼 뒤 모든 섹션을 새로 받는다
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    const t = setInterval(bump, REFRESH_MS);
    return () => clearInterval(t);
  }, [bump]);

  const overview = useResource("overview", () => finance.overview(), tick);

  // 서버 상태 · 보류 큐 · 손실 · 캣북스
  const [financeUp, setFinanceUp] = useState<boolean | null>(null);
  const [safetyUp, setSafetyUp] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [losses, setLosses] = useState<LossReport[] | null>(null);
  const [lossError, setLossError] = useState<string | null>(null);
  const [catbooks, setCatbooks] = useState<CatbooksItems | null>(null);

  const loadSide = useCallback(async () => {
    const [[fh], [sh], [rv, rvErr], [ls, lsErr], [cb]] = await Promise.all([
      settle(finance.financeHealth()), settle(finance.safetyHealth()), settle(finance.reviews()), settle(finance.lossReports()), settle(finance.catbooksItems()),
    ]);
    setFinanceUp(fh != null);
    setSafetyUp(sh != null);
    if (rv) setReviews(rv);
    setReviewsError(rvErr);
    if (ls) setLosses(ls);
    setLossError(lsErr);
    if (cb) setCatbooks(cb);
  }, []);
  useEffect(() => { void loadSide(); }, [loadSide, tick]);

  // 재무 AI 테스트
  const [test, setTest] = useState<SelfTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    catch { setError(`재무 AI 테스트를 실행하지 못했습니다. ${FINANCE_SERVER}가 켜져 있는지 확인하세요.`); }
    finally { setTesting(false); }
  }

  const [syncing, setSyncing] = useState(false);
  async function syncCatbooks() {
    setSyncing(true);
    setError(null);
    try { await finance.catbooksSync(); await loadSide(); }
    catch { setError(`캣북스에서 가져오지 못했습니다. ${FINANCE_SERVER}가 켜져 있는지 확인하세요.`); }
    finally { setSyncing(false); }
  }

  // 정산 묶음 요청 뒤 보류 큐로 이동
  const [highlight, setHighlight] = useState<string | null>(null);
  const goToQueue = useCallback((reviewId: string | null) => {
    setHighlight(reviewId);
    void loadSide().then(() => scrollToId("safety-queue"));
  }, [loadSide]);

  const pendingReviews = (reviews ?? []).filter((r) => r.status === "pending");
  const todo = overview.env?.data.todo ?? [];
  const todoCount = todo.length + (pendingReviews.length ? 1 : 0);

  return (
    <div className="max-w-[1320px] space-y-6 px-4 pb-12 pt-2 sm:space-y-8 sm:px-8">
      {/* 머리말 */}
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">재무 AI</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            캣북스의 재무팀입니다. 매일 거래를 자동으로 모아 규칙으로 맞춰 보고, 사람이 봐야 할 예외만 올린 뒤 결산과 리포트를 만듭니다.
            쿠폰·환불을 한 건씩 승인하지는 않습니다(그건 안전 장치가 기준표로 검사합니다).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:ml-auto">
          <button className="btn-primary" onClick={runTest} disabled={testing || financeUp === false}>{testing ? "테스트하는 중…" : "재무 AI 테스트"}</button>
          <button className="btn-ghost" onClick={bump}>새로고침</button>
          {safetyUp != null && <Chip label={safetyUp ? "안전 장치 켜짐" : "안전 장치 꺼짐"} tone={safetyUp ? TONE.ok : TONE.bad} />}
          {financeUp != null && <Chip label={financeUp ? "재무 AI 켜짐" : "재무 AI 꺼짐"} tone={financeUp ? TONE.ok : TONE.bad} />}
        </div>
      </header>

      <details className="rounded-2xl border border-ink-100 bg-surface px-4 py-3 text-sm sm:px-5">
        <summary className="cursor-pointer font-semibold text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">처음이라면: 관리자가 할 일</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-700">
          <li>아침에 <b>재무 AI 테스트</b>를 누릅니다. 초록색이면 정상, 노란색은 연결 확인 필요, 빨간색이면 재무 담당자에게 알립니다.</li>
          <li><b>지금 사람이 할 일</b>을 봅니다. 재무 AI가 자동으로 맞춰 보고 남은 예외만 여기에 나옵니다. 누르면 해당 화면으로 갑니다.</li>
          <li><b>판매자 정산</b>: ③에서 금액을 보고 <b>정산 묶음 지급 승인 요청</b>을 누른 뒤, 아래 <b>안전 장치 보류 큐</b>에서 진행을 누릅니다. 보류 사유가 있는 판매자는 자동으로 빠집니다.</li>
          <li><b>결산 확정</b>: ①에서 하루·한 달 숫자와 설명을 읽고 맞으면 <b>결산 확정</b>을 누릅니다.</li>
          <li><b>대사 불일치</b>: ②에서 금액이 다르거나 PG에 없는 건을 확인하고, 어떻게 처리했는지 <b>메모</b>를 남깁니다.</li>
          <li><b>한도 바꾸기</b>: ⑤의 제안을 보고, 바꾸려면 재무 담당자에게 <b>기준표(thresholds.toml) PR</b>을 요청합니다. 재무 AI는 제안만 하고 직접 바꾸지 않습니다.</li>
        </ol>
        <p className="mt-3 text-xs text-ink-500">
          모듈별 설명과 자주 묻는 질문은 <Link href="/finance/guide" className="font-medium text-brand-700 underline">재무 AI 관리자 사용법</Link>에 있습니다.
        </p>
      </details>

      {test ? <SelfTestPanel test={test} open={testOpen} /> : (
        <p className="rounded-2xl border border-dashed border-ink-300 px-4 py-3 text-sm text-ink-500 sm:px-5">
          최근 {TEST_TTL_HOURS}시간 안에 한 테스트가 없습니다. <b>재무 AI 테스트</b>를 눌러 재무 AI가 제대로 계산하고 연결돼 있는지 확인하세요. 가짜 자료로 점검해서 실제 기록이나 돈에는 영향이 없습니다.
        </p>
      )}

      {(financeUp === false || safetyUp === false) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {financeUp === false && `${FINANCE_SERVER}에 연결하지 못했습니다. `}
          {safetyUp === false && `${SAFETY_SERVER}에 연결하지 못했습니다(꺼져 있는 동안 돈이 나가는 일은 모두 멈춥니다). `}
          ax-backend에서 <code>docker compose -f infra/compose.yml up -d safety finance</code>로 켜 주세요.
        </p>
      )}
      {error && <ErrorBox message={error} />}

      {/* 지금 사람이 할 일 */}
      <section aria-labelledby="todo" className={`rounded-3xl p-4 ring-1 sm:p-6 ${todoCount ? "bg-amber-50 ring-amber-100" : "bg-emerald-50 ring-emerald-100"}`}>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="todo" className={`text-sm font-semibold ${todoCount ? "text-amber-800" : "text-emerald-800"}`}>지금 사람이 할 일</h2>
          <p className={`text-3xl font-bold tabular-nums ${todoCount ? "text-amber-800" : "text-emerald-800"}`}>{overview.env || reviews ? (todoCount ? `${todoCount}가지` : "없음") : "–"}</p>
          <MockBadge meta={overview.env?.meta} />
        </div>
        {overview.error && !overview.env && <div className="mt-3"><ErrorBox message={overview.error} onRetry={overview.reload} /></div>}
        {!overview.env && !overview.error && <Waiting />}
        {todoCount > 0 && (
          <ul className="mt-4 space-y-2">
            {todo.map((t, i) => (
              <li key={`${t.kind}-${i}`}>
                <button type="button" onClick={() => openTab(todoTab(t), true)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-surface px-4 py-3 text-left shadow-sm transition hover:ring-2 hover:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                  <Chip label={TODO_KO[t.kind] ?? t.kind} tone={TODO_TONE[t.kind] ?? TONE.muted} />
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">{t.title}</span>
                  {t.amount != null && <span className="text-sm tabular-nums text-ink-700">{krw(t.amount)}</span>}
                  <span className="text-xs font-medium text-brand-700">보러 가기 →</span>
                </button>
              </li>
            ))}
            {pendingReviews.length > 0 && (
              <li>
                <button type="button" onClick={() => scrollToId("safety-queue")}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-surface px-4 py-3 text-left shadow-sm transition hover:ring-2 hover:ring-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                  <Chip label="보류 큐" tone={TONE.warn} />
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">안전 장치 보류 큐에서 결정 기다림 {pendingReviews.length}건</span>
                  <span className="text-xs font-medium text-brand-700">보러 가기 →</span>
                </button>
              </li>
            )}
          </ul>
        )}
        {overview.env && todoCount === 0 && <p className="mt-2 text-sm text-emerald-800">재무 AI가 맞춰 본 결과, 지금 사람이 볼 예외가 없습니다.</p>}
      </section>

      {/* 오늘의 재무 */}
      <section aria-labelledby="today" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="today" className="text-base font-semibold text-ink-900">오늘의 재무</h2>
          {overview.env && <span className="text-xs text-ink-500">{overview.env.data.date}</span>}
          <MockBadge meta={overview.env?.meta} />
        </div>
        {overview.env ? (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {KPI.map(({ key, label, hint }) => {
                const v = overview.env!.data.kpis[key];
                return (
                  <div key={key} className={`card px-4 py-3 ${key === "net_result" ? "ring-1 ring-brand-100" : ""}`}>
                    <dt className="text-[11px] text-ink-500">{label}</dt>
                    <dd className={`mt-0.5 break-words font-semibold tabular-nums ${v == null ? "text-sm text-ink-500" : `text-lg sm:text-xl ${v < 0 ? "text-red-700" : "text-ink-900"}`}`}>
                      {v != null && v < 0 ? `−${krw(-v)}` : krw(v)}
                    </dd>
                    <dd className="mt-0.5 text-[11px] leading-snug text-ink-500">{hint}</dd>
                  </div>
                );
              })}
            </dl>
            <MetaLine meta={overview.env.meta} />
          </>
        ) : overview.error ? <ErrorBox message={overview.error} onRetry={overview.reload} /> : <Waiting />}
      </section>

      {/* 재무팀 5개 모듈 */}
      <div id="finance-modules" className="scroll-mt-4 space-y-4">
        <div role="tablist" aria-label="재무팀 업무" className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {FINANCE_TABS.map((t) => (
            <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => openTab(t)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-brand-600 text-white" : "bg-surface text-ink-700 hover:bg-ink-100"}`}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "closing" && <ClosingSection tick={tick} onChanged={bump} />}
          {tab === "reconciliation" && <ReconciliationSection tick={tick} />}
          {tab === "settlements" && <SettlementsSection tick={tick} onChanged={bump} onGoToQueue={goToQueue} />}
          {tab === "policy" && <PolicySection tick={tick} />}
          {tab === "audit" && <AuditSection tick={tick} />}
        </div>
      </div>

      <SafetyQueue reviews={reviews} error={reviewsError} highlight={highlight} reload={loadSide} />

      <LossReports losses={losses} error={lossError} />

      <CatbooksPanel data={catbooks} syncing={syncing} onSync={syncCatbooks} canSync={financeUp !== false} />
    </div>
  );
}
