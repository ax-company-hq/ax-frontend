import { useCallback, useEffect, useState } from "react";
import { ErrorNote, PageTitle } from "@/components/shop/bits";
import { adminApi } from "@/lib/adminApi";
import { deptKo, INCIDENT_STATUS_KO, INCIDENT_STATUS_TONE, SHARED_KO, STEP_STATUS_KO, STEP_STATUS_TONE } from "@/lib/adminLabels";
import type { Incident } from "@/lib/adminTypes";

const POLL_MS = 10_000;

function time(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour12: false });
}

function describe(error: { status?: number; message: string }): string {
  if (error.status === 502) return "총괄에 연결할 수 없습니다. 총괄 서버가 켜져 있는지 확인해 주세요.";
  if (error.status === 504) return "총괄이 제때 응답하지 않았습니다.";
  if (error.status === 401 || error.status === 403) return "관리자 권한이 없습니다.";
  return error.message;
}

export default function AdminOrchestratorPage() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await adminApi.incidents();
      setIncidents(data);
      setError(null);
      setUpdatedAt(new Date());
      setSelected((cur) => cur ?? data.at(-1)?.context_id ?? null);
    } catch (e) {
      setError(describe(e as { status?: number; message: string }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const list = [...(incidents ?? [])].reverse();
  const current = list.find((i) => i.context_id === selected) ?? null;

  return (
    <>
      <PageTitle
        title="총괄 에이전트"
        sub="캣북스에서 문제가 터지면 총괄이 사건으로 묶고 부서에 맡깁니다. 이 화면은 읽기 전용입니다."
        right={
          <button className="btn-ghost text-sm" onClick={load}>
            새로고침{updatedAt ? ` · ${time(updatedAt.toISOString())}` : ""}
          </button>
        }
      />
      <ErrorNote error={error} />
      {incidents && !incidents.length && !error && (
        <p className="rounded-xl border border-dashed border-ink-300 p-6 text-sm text-ink-500">
          아직 사건이 없습니다. 판매 사이트에서 장애를 주입하거나 총괄 시연 화면(/demo)에서 장애를 넣으면 여기에 나타납니다.
        </p>
      )}
      {!!list.length && (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <ul className="space-y-2" aria-label="사건 목록">
            {list.map((i) => (
              <li key={i.context_id}>
                <button
                  onClick={() => setSelected(i.context_id)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition ${i.context_id === selected ? "border-brand-500 bg-brand-50" : "border-ink-100 bg-surface hover:border-brand-500"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`chip ${INCIDENT_STATUS_TONE[i.status]}`}>{INCIDENT_STATUS_KO[i.status]}</span>
                    <span className="text-xs tabular-nums text-ink-500">{time(i.opened_at)}</span>
                  </span>
                  <span className="mt-1.5 block truncate font-semibold">{i.title}</span>
                  <span className="block truncate text-xs text-ink-500">{i.context_id}</span>
                </button>
              </li>
            ))}
          </ul>
          {current && <IncidentDetail incident={current} />}
        </div>
      )}
    </>
  );
}

function IncidentDetail({ incident }: { incident: Incident }) {
  const shared = Object.entries(incident.shared ?? {});
  return (
    <div className="min-w-0 space-y-5">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="card-title">{incident.title}</h2>
          <span className={`chip ${INCIDENT_STATUS_TONE[incident.status]}`}>{INCIDENT_STATUS_KO[incident.status]}</span>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {incident.context_id} · 시작 {time(incident.opened_at)} · 종료 {time(incident.closed_at)}
        </p>
        {!!shared.length && (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {shared.map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="text-ink-500">{SHARED_KO[key] ?? key}</dt>
                <dd className="font-medium tabular-nums">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        {!!incident.pending_holds.length && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            <p className="font-semibold">사람 승인 대기 {incident.pending_holds.length}건</p>
            <ul className="mt-1 list-inside list-disc">
              {incident.pending_holds.map((h) => (
                <li key={h.step_id}>{h.label}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">승인·거절은 총괄이 하지 않고, 사람이 안전 관문 보류 큐에서 합니다.</p>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto p-4">
        <h3 className="panel-title mb-2">단계</h3>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-ink-500">
            <tr>
              <th className="py-1 pr-3 font-medium">단계</th>
              <th className="py-1 pr-3 font-medium">부서</th>
              <th className="py-1 pr-3 font-medium">상태</th>
              <th className="py-1 pr-3 font-medium">시도</th>
              <th className="py-1 font-medium">메모</th>
            </tr>
          </thead>
          <tbody>
            {incident.steps.map((s) => (
              <tr key={s.step_id} className="border-t border-ink-100 align-top">
                <td className="py-2 pr-3">
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-xs text-ink-500">{s.skill}</span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3">
                  {deptKo(s.dept)}
                  {s.transferred_to && <span className="block text-xs text-ink-500">→ {deptKo(s.transferred_to)}로 이관</span>}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">
                  <span className={`chip ${STEP_STATUS_TONE[s.status] ?? "bg-ink-100 text-ink-700"}`}>{STEP_STATUS_KO[s.status] ?? s.status}</span>
                  {s.grade && <span className="ml-1 text-[11px] text-ink-500">{s.grade}</span>}
                </td>
                <td className="py-2 pr-3 tabular-nums">{s.attempts || "–"}</td>
                <td className="py-2 text-xs text-ink-500">{s.note || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!!incident.summary.length && (
        <div className="card p-4">
          <h3 className="panel-title mb-2">요약</h3>
          <ul className="list-inside list-disc space-y-0.5 text-sm">
            {incident.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <h3 className="panel-title mb-2">진행 기록</h3>
        <ol className="space-y-1 text-sm">
          {incident.events.map((e, idx) => (
            <li key={`${e.at}-${idx}`} className="flex gap-3">
              <span className="w-16 shrink-0 text-xs tabular-nums text-ink-500">{time(e.at)}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
