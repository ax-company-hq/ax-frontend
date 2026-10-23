import { useState } from "react";
import { finance, krw, percent, rateChange, type FindingSeverity } from "@/lib/finance";
import { Chip, Empty, Panel, ResourceBody, TONE, useResource } from "./bits";

// ⑦ 내부통제·감사: 지난 며칠 동안의 쿠폰·환불·실행 관문 기록을 전부 다시 훑어 수상한 패턴을 찾는다.
// 건마다 막는 것이 아니라 나중에 점검하는 것(사후 감사)이다.

const SEVERITY: Record<FindingSeverity, { label: string; tone: string; rank: number }> = {
  high: { label: "높음", tone: TONE.bad, rank: 0 },
  medium: { label: "중간", tone: TONE.warn, rank: 1 },
  low: { label: "낮음", tone: TONE.muted, rank: 2 },
};
const FINDING_KO: Record<string, string> = {
  split_under_limit: "한도 바로 아래로 쪼개기",
  repeat_refund: "같은 고객 반복 환불",
  duplicate_coupon: "같은 고객 쿠폰 중복",
  refund_rate_jump: "환불률 급변",
  amount_recheck_failed: "금액 재계산 불일치",
  gate_hold_trend: "실행 관문 보류·거절 증가",
};
const DAYS = [7, 14, 30] as const;

export function AuditSection({ tick }: { tick: number }) {
  const [days, setDays] = useState<number>(7);
  const res = useResource(`audit:${days}`, () => finance.audit(days), tick);

  const tools = (
    <div role="group" aria-label="기간" className="inline-flex rounded-full border border-ink-100 p-0.5 text-sm">
      {DAYS.map((d) => (
        <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
          className={`rounded-full px-3 py-1 ${days === d ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-100"}`}>
          {d}일
        </button>
      ))}
    </div>
  );

  return (
    <Panel id="audit" title="⑦ 내부통제·감사" meta={res.env?.meta} tools={tools}
      hint="한 건씩 막는 일은 안전 장치가 합니다. 재무 AI는 지난 기록을 전부 다시 훑어, 한도를 피하려고 쪼갠 쿠폰이나 같은 고객의 반복 환불 같은 수상한 패턴을 찾습니다. 의심 건은 조사해 보고 결론을 남기세요.">
      <ResourceBody res={res}>
        {(a) => {
          const s = a.stats;
          const jump = s.refund_rate != null && s.refund_rate_prev != null && s.refund_rate > s.refund_rate_prev;
          const findings = [...a.findings].sort((x, y) => (SEVERITY[x.severity]?.rank ?? 9) - (SEVERITY[y.severity]?.rank ?? 9));
          const stats: [string, string, string, boolean?][] = [
            ["환불", s.refund_count == null ? "확인할 수 없음" : `${s.refund_count.toLocaleString("ko-KR")}건`, krw(s.refund_amount)],
            ["환불률", percent(s.refund_rate), rateChange(s.refund_rate, s.refund_rate_prev), jump],
            ["쿠폰", s.coupon_count == null ? "확인할 수 없음" : `${s.coupon_count.toLocaleString("ko-KR")}장`, krw(s.coupon_amount)],
            ["실행 관문 보류·거절", s.gate_held == null && s.gate_rejected == null ? "확인할 수 없음" : `${s.gate_held ?? "–"}건 · ${s.gate_rejected ?? "–"}건`, "사람 확인으로 간 건 · 막힌 건"],
          ];
          return (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map(([label, value, sub, warn]) => (
                  <div key={label} className="rounded-2xl bg-surface-2 px-3 py-2">
                    <dt className="text-[11px] text-ink-500">{label}</dt>
                    <dd className={`text-base font-semibold tabular-nums ${value.startsWith("확인할 수 없음") ? "text-ink-500" : ""}`}>{value}</dd>
                    <dd className={`text-[11px] ${warn ? "font-medium text-red-700" : "text-ink-500"}`}>{sub}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className="text-sm font-semibold text-ink-900">찾은 의심 건 <span className="font-normal text-ink-500">{findings.length}건</span></h3>
                {findings.length ? (
                  <ul className="mt-2 space-y-2">
                    {findings.map((f, i) => (
                      <li key={`${f.code}-${i}`} className="rounded-2xl border border-ink-100 px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip label={`위험 ${SEVERITY[f.severity]?.label ?? f.severity}`} tone={SEVERITY[f.severity]?.tone ?? TONE.muted} />
                          <b className="text-ink-900">{f.title}</b>
                          <span className="text-xs text-ink-500">{FINDING_KO[f.code] ?? f.code}</span>
                        </div>
                        <p className="mt-1 text-ink-700">{f.detail}</p>
                        {f.refs.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1 text-[11px] text-ink-500">
                            관련 기록: {f.refs.map((r) => <code key={r} className="rounded bg-ink-100 px-1.5 py-0.5">{r}</code>)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <div className="mt-2"><Empty>이 기간에는 수상한 패턴이 없습니다.</Empty></div>}
              </div>
            </div>
          );
        }}
      </ResourceBody>
    </Panel>
  );
}
