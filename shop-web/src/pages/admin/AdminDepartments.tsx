import { useCallback, useEffect, useState } from "react";
import { ErrorNote, PageTitle } from "@/components/shop/bits";
import { adminApi } from "@/lib/adminApi";
import type { Department, DepartmentsMeta, UsageBucket } from "@/lib/adminDeptTypes";
import { deptKo } from "@/lib/adminLabels";

const POLL_MS = 10_000;
const UNKNOWN = "확인할 수 없음";

const pct = (v: number | null) => (v == null ? UNKNOWN : `${Math.round(v * 100)}%`);
const ms = (v: number | null) => (v == null ? UNKNOWN : `${v.toLocaleString("ko-KR")}ms`);
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("ko-KR", { hour12: false }) : UNKNOWN);
const GRADE_TONE: Record<string, string> = {
  read: "bg-ink-100 text-ink-700",
  A: "bg-emerald-50 text-emerald-700",
  B: "bg-brand-50 text-brand-700",
  C: "bg-amber-50 text-amber-700",
};
const GRADE_KO: Record<string, string> = { read: "조회", A: "A 바로", B: "B 확인 후", C: "C 사람 승인" };

function describe(error: { status?: number; message: string }): string {
  if (error.status === 404) return "부서 사용량 경로가 아직 서버에 없습니다(shop-api 요청 #378 처리 후 열립니다).";
  if (error.status === 502) return "총괄에 연결할 수 없습니다. 총괄 서버가 켜져 있는지 확인해 주세요.";
  if (error.status === 504) return "총괄이 제때 응답하지 않았습니다.";
  if (error.status === 401 || error.status === 403) return "관리자 권한이 없습니다.";
  return error.message;
}

function Bars({ series }: { series: UsageBucket[] }) {
  const max = Math.max(1, ...series.map((b) => b.calls));
  return (
    <div className="flex h-10 items-end gap-px" role="img" aria-label="최근 호출 수 추이">
      {series.map((b) => (
        <span
          key={b.t}
          title={`${time(b.t)} · 호출 ${b.calls}${b.errors ? ` · 오류 ${b.errors}` : ""}`}
          className={`w-full rounded-sm ${b.errors ? "bg-red-400" : b.calls ? "bg-brand-400" : "bg-ink-100"}`}
          style={{ height: `${Math.max(8, (b.calls / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-ink-50 px-3 py-2">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function DeptCard({ d, open, onToggle }: { d: Department; open: boolean; onToggle: () => void }) {
  const idle = d.available && d.usage.calls === 0;
  return (
    <article className="card space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{deptKo(d.name)}</h2>
        <span className={`chip ${d.mode === "real" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>
          {d.mode === "real" ? "실제 연결" : "가상 부서"}
        </span>
        {!d.available && <span className="chip bg-red-50 text-red-700">카드 없음</span>}
        <span className="ml-auto text-xs text-ink-500">담당 {d.owner ?? UNKNOWN}</span>
      </header>

      {!d.available ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{d.unavailable_reason ?? "부서 카드를 읽지 못했습니다."}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="호출" value={d.usage.calls} />
            <Stat label="오류" value={d.usage.errors} tone={d.usage.errors ? "text-red-700" : ""} />
            <Stat label="성공률" value={pct(d.usage.success_rate)} />
            <Stat label="평균 응답" value={ms(d.usage.avg_ms)} />
          </div>
          <Bars series={d.series} />
          <p className="text-[11px] text-ink-500">
            {idle ? "아직 총괄이 부른 기록이 없습니다." : `마지막 호출 ${time(d.usage.last_called_at)} · 재시도 ${d.usage.retries}건`}
            {d.usage.waiting ? ` · 사람 입력 대기 ${d.usage.waiting}건` : ""}
          </p>
          <button className="btn-ghost text-xs" onClick={onToggle} aria-expanded={open}>
            {open ? "접기" : `skill ${d.skills.length}개와 최근 호출 보기`}
          </button>
          {open && <Detail d={d} />}
        </>
      )}
    </article>
  );
}

function Detail({ d }: { d: Department }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-ink-500">
            <tr>
              <th className="py-1 pr-3 font-medium">skill</th>
              <th className="pr-3 font-medium">등급</th>
              <th className="pr-3 text-right font-medium">호출</th>
              <th className="pr-3 text-right font-medium">오류</th>
              <th className="pr-3 text-right font-medium">성공률</th>
              <th className="text-right font-medium">평균</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {d.skills.map((s) => (
              <tr key={s.id}>
                <td className="py-1.5 pr-3 font-mono">
                  {s.id}
                  {s.orchestrator ? "" : <span className="ml-1 text-ink-500">(총괄은 안 부름)</span>}
                </td>
                <td className="pr-3"><span className={`chip ${GRADE_TONE[s.grade] ?? "bg-ink-100 text-ink-700"}`}>{GRADE_KO[s.grade] ?? s.grade}</span></td>
                <td className="pr-3 text-right tabular-nums">{s.calls}</td>
                <td className="pr-3 text-right tabular-nums">{s.errors}</td>
                <td className="pr-3 text-right tabular-nums">{pct(s.success_rate)}</td>
                <td className="text-right tabular-nums">{ms(s.avg_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium">최근 호출</p>
        {d.recent.length === 0 ? (
          <p className="text-xs text-ink-500">기록이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-ink-100 text-xs">
            {d.recent.slice(0, 8).map((r, i) => (
              <li key={`${r.at}${i}`} className="flex flex-wrap items-baseline gap-x-3 py-1">
                <span className="tabular-nums text-ink-500">{time(r.at)}</span>
                <span className="font-mono">{r.skill}</span>
                <span className={r.status === "completed" ? "text-emerald-700" : "text-amber-700"}>{r.status}</span>
                {r.outcome && <span className="text-ink-500">{r.outcome}</span>}
                <span className="ml-auto tabular-nums text-ink-500">{ms(r.duration_ms)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminDepartmentsPage() {
  const [depts, setDepts] = useState<Department[] | null>(null);
  const [meta, setMeta] = useState<DepartmentsMeta>({});
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, meta: m } = await adminApi.departments();
      setDepts(data);
      setMeta(m as DepartmentsMeta);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(describe(e as { status?: number; message: string }));
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const windowMin = meta.window_seconds ? Math.round(meta.window_seconds / 60) : null;
  return (
    <>
      <PageTitle
        title="부서 카드·사용량"
        sub={`총괄이 부서마다 몇 번, 얼마나 잘 불렀는지 보여 줍니다.${windowMin ? ` 최근 ${windowMin}분 기준이고` : ""} 숫자는 총괄이 부른 호출을 센 실측입니다. 읽기 전용입니다.`}
        right={
          <button className="btn-ghost text-sm" onClick={load}>
            새로고침{updatedAt ? ` · ${time(updatedAt.toISOString())}` : ""}
          </button>
        }
      />
      <ErrorNote error={error} />
      {meta.mock && <p className="mb-3 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">총괄 목 모드의 가상 데이터입니다. 실제 부서를 붙이면 「실제 연결」로 바뀝니다.</p>}
      {depts && (
        <div className="grid gap-4 xl:grid-cols-2">
          {depts.map((d) => (
            <DeptCard key={d.name} d={d} open={open === d.name} onToggle={() => setOpen(open === d.name ? null : d.name)} />
          ))}
        </div>
      )}
    </>
  );
}
