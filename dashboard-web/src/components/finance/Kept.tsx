import { ago, shortDateTime, won } from "@/lib/format";
import type { CatbooksItem, CatbooksItems, LossReport, SelfTest } from "@/lib/finance";
import { Chip } from "./bits";

// 예전 재무 화면에서 그대로 가져온 부분: 재무 AI 테스트 결과, 캣북스에서 들어온 일, 장애 손실 리포트.

const money = (n: number | null | undefined) => (n == null ? "–" : won(n));

export const TEST_TTL_HOURS = 12; // 서버와 같다. 지난 결과는 믿지 않고 다시 테스트하게 한다
export const freshTest = (t: SelfTest | null) =>
  t && Date.now() - new Date(t.ran_at).getTime() < TEST_TTL_HOURS * 3600 * 1000 ? t : null;
const TEST_TONE = {
  pass: { box: "bg-emerald-50 ring-emerald-100 text-emerald-800", label: "정상" },
  warn: { box: "bg-amber-50 ring-amber-100 text-amber-800", label: "주의" },
  fail: { box: "bg-red-50 ring-red-100 text-red-800", label: "실패" },
} as const;

/** 재무 AI 테스트 결과. 버튼을 누른 직후에는 항목을 펼쳐서 보여 준다. */
export function SelfTestPanel({ test, open }: { test: SelfTest; open: boolean }) {
  const tone = TEST_TONE[test.result];
  const bad = test.checks.filter((c) => !c.ok);
  return (
    <section aria-live="polite" className={`rounded-2xl px-4 py-4 ring-1 sm:px-5 ${tone.box}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">재무 AI 테스트: {tone.label}</h2>
        <p className="text-sm">{test.summary}</p>
        <p className="ml-auto text-xs opacity-80">{shortDateTime(test.ran_at)} · {test.passed}/{test.total} 통과 · {(test.duration_ms / 1000).toFixed(1)}초</p>
      </div>
      {test.result !== "pass" && (
        <p className="mt-1 text-xs font-medium">
          {test.result === "fail"
            ? "테스트를 통과하지 못했습니다. 문제가 해결될 때까지 재무 AI의 숫자와 리포트를 믿고 쓰지 마세요."
            : "연결 문제가 해결될 때까지 일부 숫자가 ‘확인할 수 없음’으로 보일 수 있습니다."}
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

export function CatbooksPanel({ data, syncing, onSync, canSync }: { data: CatbooksItems | null; syncing: boolean; onSync: () => void; canSync: boolean }) {
  const items = data?.data ?? [];
  const sync = data?.meta.sync ?? null;
  const count = (k: CatbooksItem["result"]) => items.filter((i) => i.result === k).length;
  const sorted = [...items].sort((a, b) => CB_ORDER.indexOf(a.result) - CB_ORDER.indexOf(b.result));
  const every = data?.meta.poll_seconds ? `${data.meta.poll_seconds}초마다 자동으로 가져옵니다.` : "자동 가져오기가 꺼져 있습니다.";
  return (
    <section aria-labelledby="catbooks" className="card p-4 sm:p-5">
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

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
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

// ---------------------------------------------------------------- 장애 손실 리포트 (① 결산·리포트의 일부)
export function LossReports({ losses, error }: { losses: LossReport[] | null; error: string | null }) {
  return (
    <section aria-labelledby="losses" className="space-y-3">
      <div>
        <h2 id="losses" className="text-base font-semibold text-ink-900">장애로 생긴 손실</h2>
        <p className="mt-0.5 text-xs text-ink-500">피해 숫자는 데이터 AI가 센 값을 그대로 쓰고, 재무 AI는 보상으로 나간 돈을 더해 총 손실을 냅니다.</p>
      </div>
      {error && !losses && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {losses && (
        <div className="grid gap-4 md:grid-cols-2">
          {losses.map((l) => (
            <article key={l.context_id} className="card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">장애 {l.context_id.replace("ctx_inc_", "#")}</h3>
                <span className="text-xs text-ink-500">{shortDateTime(l.at)} 정리</span>
              </div>
              <p className="mt-2 text-xs text-ink-500">총 손실</p>
              <p className="text-3xl font-bold tabular-nums text-red-700">{l.total_loss == null ? "확인할 수 없음" : won(l.total_loss)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-ink-100 pt-3 text-sm">
                <dt className="text-ink-500">실패한 주문</dt><dd className="text-right tabular-nums">{l.failed_orders == null ? "확인할 수 없음" : `${l.failed_orders}건`}</dd>
                <dt className="text-ink-500">피해 고객</dt><dd className="text-right tabular-nums">{l.affected_customers == null ? "확인할 수 없음" : `${l.affected_customers}명`}</dd>
                <dt className="text-ink-500">피해 금액</dt><dd className="text-right tabular-nums">{l.lost_amount == null ? "확인할 수 없음" : won(l.lost_amount)}</dd>
                <dt className="text-ink-500">보상으로 나간 돈</dt><dd className="text-right tabular-nums">{won(l.compensation_total)} ({l.compensation_coupon_count}장)</dd>
                <dt className="text-ink-500">피해 대비 보상</dt><dd className="text-right tabular-nums">{l.lost_amount ? `${Math.round((l.compensation_total / l.lost_amount) * 100)}%` : "확인할 수 없음"}</dd>
              </dl>
            </article>
          ))}
          {!losses.length && <p className="card p-5 text-sm text-ink-500">아직 정리한 손실이 없습니다. 장애가 끝나면 총괄 AI가 재무 AI에 손실 정리를 요청합니다.</p>}
        </div>
      )}
    </section>
  );
}
