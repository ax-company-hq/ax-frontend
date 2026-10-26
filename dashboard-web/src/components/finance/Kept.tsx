import { shortDateTime } from "@/lib/format";
import type { SelfTest } from "@/lib/finance";

// 예전 재무 화면에서 그대로 가져온 부분: 재무 AI 테스트 결과. (장애 손실은 장애 사건 재무 탭에서 사건별로 본다)

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

// ---------------------------------------------------------------- 장애 손실 리포트 (① 결산·리포트의 일부)
