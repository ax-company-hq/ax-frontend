import { useCallback, useEffect, useRef, useState } from 'react'

import { decideHold, getRegistry, injectIncident, listIncidents, OrchestratorUnreachable } from './api'
import type { DemoOptions, Incident, Registry, StepStatus } from './types'

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: '대기',
  running: '진행 중',
  completed: '완료',
  failed: '실패',
  held: '승인 대기',
  skipped: '건너뜀',
  rejected_by_human: '거절',
  transfer_queued: '이관 큐',
}

const INCIDENT_LABEL: Record<Incident['status'], string> = {
  open: '진행 중',
  resolved: '해결됨',
  degraded: '일부 미완료로 종료',
}

const OPTION_LABELS: [keyof DemoOptions, string][] = [
  ['hold_rollback', '롤백을 C 등급 보류(사람 승인 대기)로'],
  ['fail_marketing', '공지 게시 1회 실패(재시도)'],
  ['wrong_owner', '공지 게시 거절(이관 큐로 넘김)'],
  ['infra_card_empty', '인프라 카드 비어 있음(현재 dev 상태)'],
]

// 실제 모드의 사람 결정은 안전 관문 보류 큐(관리자 재무·안전 화면) 하나로만 간다
const HOLD_QUEUE_URL = `${import.meta.env.VITE_DASHBOARD_WEB_URL || 'http://localhost:3001'}/finance`

const kst = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour12: false }) : ''

const NO_OPTIONS: DemoOptions = {
  hold_rollback: false,
  fail_marketing: false,
  wrong_owner: false,
  infra_card_empty: false,
}

export function App() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [registry, setRegistry] = useState<Registry | null>(null)
  const [options, setOptions] = useState<DemoOptions>(NO_OPTIONS)
  const [pinned, setPinned] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mock, setMock] = useState(true)
  const flowRef = useRef<HTMLElement>(null)

  const refreshRegistry = useCallback(async () => {
    try {
      setRegistry(await getRegistry())
    } catch (e) {
      if (e instanceof OrchestratorUnreachable) setError(e.message)
    }
  }, [])

  const tick = useCallback(async () => {
    try {
      const result = await listIncidents()
      setIncidents(result.incidents)
      setMock(result.mock)
      setError(null)
    } catch (e) {
      setError(e instanceof OrchestratorUnreachable ? e.message : '알 수 없는 오류')
    }
  }, [])

  useEffect(() => {
    void tick()
    void refreshRegistry()
    const timer = setInterval(() => void tick(), 800)
    return () => clearInterval(timer)
  }, [tick, refreshRegistry])

  const latest = incidents[incidents.length - 1]
  const current =
    (pinned && incidents.find((i) => i.context_id === pinned)) || latest || undefined

  async function inject() {
    setBusy(true)
    try {
      const created = await injectIncident(options)
      setPinned(created.context_id)
      await refreshRegistry()
      await tick()
      flowRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof OrchestratorUnreachable ? e.message : '장애 주입에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  async function decide(stepId: string, approved: boolean) {
    if (!current) return
    await decideHold(current.context_id, stepId, approved)
    await tick()
  }

  const metrics = current?.metrics
  const hasMetrics = metrics?.mttr_seconds !== undefined

  return (
    <>
      <div className="banner">
        <div className="wrap">
          <span className="tag">MOCK</span>
          <span>개발·시연용 콘솔이에요. 가짜 부서 7곳으로 총괄을 돌리고, 값은 모두 지어낸 데이터예요.</span>
          <a href="#flow">사건 흐름 보기 →</a>
        </div>
      </div>
      <nav>
        <div className="wrap">
          <span className="logo">axcompany</span>
          <a className="item" href="#flow">사건 흐름</a>
          <a className="item" href="#registry">부서 에이전트</a>
          <a className="item" href="#holds">승인 대기열</a>
          <a className="item" href="#kpi">KPI</a>
          <span className="sp" />
          <button className="btn primary" onClick={() => void inject()} disabled={busy}>
            장애 주입
          </button>
        </div>
      </nav>

      <div className="wrap">
        <section className="hero">
          <h1>
            사건 발생부터 기록까지
            <br />
            하나의 총괄 에이전트로
          </h1>
          <div className="chips">
            <span className="chip">감지</span> 에서 <span className="chip">분배</span>
            <span className="chip">취합</span> <span className="chip">종료</span> 까지, 부서
            에이전트가 알아서 움직여요
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => void inject()} disabled={busy}>
              결제 장애 주입 (시나리오 A)
            </button>
            <button className="btn" onClick={() => setPinned(null)}>
              최신 사건 보기
            </button>
            <span className="pill">{current ? INCIDENT_LABEL[current.status] : '대기 중'}</span>
          </div>
          <div className="opts">
            {OPTION_LABELS.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                />{' '}
                {label}
              </label>
            ))}
          </div>
          {error && <ConnectionHelp message={error} />}
        </section>

        <section className="stage" id="flow" ref={flowRef}>
          <div className="grid">
            <div className="card">
              <h3>
                <span>{current?.title ?? '사건 흐름'}</span>
                <span className="pill">{current?.context_id ?? '-'}</span>
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>부서</th>
                    <th>상태</th>
                    <th>시도</th>
                  </tr>
                </thead>
                <tbody>
                  {current ? (
                    current.steps.map((s) => (
                      <tr key={s.step_id}>
                        <td>
                          {s.label}
                          {s.grade && s.grade !== 'read' && (
                            <span className={`grade ${s.grade}`}>{s.grade}</span>
                          )}
                          {s.note && (
                            <div className="note">
                              {s.note}
                              {s.transferred_to ? ` → ${s.transferred_to}` : ''}
                            </div>
                          )}
                        </td>
                        <td>{s.dept ?? '-'}</td>
                        <td>
                          <span className={`st ${s.status}`}>
                            <i className="dot" />
                            {STATUS_LABEL[s.status] ?? s.status}
                          </span>
                        </td>
                        <td>{s.attempts || ''}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty">
                        장애를 주입하면 사건이 열려요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="label" style={{ marginTop: 18 }}>
                진행 기록
              </div>
              <div className="log">
                {current?.events
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <div key={`${e.at}-${i}`}>
                      <span>{kst(e.at)}</span>
                      {e.message}
                    </div>
                  ))}
              </div>
            </div>

            <div className="card" id="registry">
              <h3>
                <span>부서 에이전트 (Agent Card)</span>
                <span className="pill">skill → 부서</span>
              </h3>
              {registry ? (
                registry.depts.map((d) => (
                  <div className="dept" key={d.name}>
                    <b>{d.name}</b>
                    <small>{d.owner}</small>
                    <span className={`grade ${d.mode === 'real' ? 'A' : ''}`}>
                      {d.mode === 'real' ? '실제' : '목'}
                    </span>
                    <div className="skills">
                      {d.skills
                        .filter((s) => s.orchestrator)
                        .map((s) => (
                          <span key={s.id} className={`skill ${s.grade}`}>
                            {s.id} · {s.grade}
                          </span>
                        ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">카드를 수집하는 중이에요.</div>
              )}
              {registry && Object.keys(registry.unavailable).length > 0 && (
                <div className="warn">
                  확인할 수 없음:{' '}
                  {Object.entries(registry.unavailable)
                    .map(([k, v]) => `${k} (${v})`)
                    .join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="grid2">
            <div className="card" id="holds">
              <h3>
                <span>승인 대기열</span>
                <span className="pill">C 등급</span>
              </h3>
              {current && current.pending_holds.length > 0 ? (
                current.pending_holds.map((h) => (
                  <div className="hold" key={h.step_id}>
                    <b>{h.label}</b>
                    <div className="note">{h.skill} — 사람 승인이 필요해 보류됨</div>
                    {mock ? (
                      <div className="row">
                        <button className="btn primary" onClick={() => void decide(h.step_id, true)}>
                          승인
                        </button>
                        <button className="btn" onClick={() => void decide(h.step_id, false)}>
                          거절
                        </button>
                      </div>
                    ) : (
                      <div className="row">
                        <a className="btn primary" href={HOLD_QUEUE_URL} target="_blank" rel="noreferrer">
                          안전 관문 보류 큐에서 결정하기
                        </a>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty">보류된 단계가 없어요.</div>
              )}
            </div>

            <div className="card" id="kpi">
              <h3>
                <span>사건 지표</span>
                <span className="pill">실측</span>
              </h3>
              <div className="label">감지→종료 시간</div>
              <div className="kpi">
                {hasMetrics ? (
                  <>
                    {metrics?.mttr_seconds}
                    <small>초</small>
                  </>
                ) : (
                  '-'
                )}
              </div>
              <div className="label" style={{ marginTop: 14 }}>
                자동 처리율 · 재시도 · 이관
              </div>
              <div className="kpi">
                {metrics?.auto_rate !== undefined ? (
                  <>
                    {Math.round(metrics.auto_rate * 100)}
                    <small>
                      % · 재시도 {metrics.retries} · 이관 {metrics.transfers}
                    </small>
                  </>
                ) : (
                  '-'
                )}
              </div>
            </div>

            <div className="card">
              <h3>
                <span>사건 요약</span>
                <span className="pill">부서 결과 취합</span>
              </h3>
              <div className="log">
                {current && current.summary.length > 0 ? (
                  current.summary.map((line) => <div key={line}>{line}</div>)
                ) : (
                  <div className="empty">사건이 끝나면 정리돼요.</div>
                )}
              </div>
            </div>
          </div>
        </section>
        <footer>
          목업 · 실제 부서 연동 전 단계. 총괄은 승인하지 않고, 승인 버튼은 사람이 누르는 대시보드 동작을 흉내 낸 것입니다.
        </footer>
      </div>
    </>
  )
}

/** 총괄이 안 떠 있을 때: 무엇을 하면 되는지 바로 보여 준다 */
function ConnectionHelp({ message }: { message: string }) {
  return (
    <div className="help">
      <b>총괄(백엔드)에 연결되지 않았어요</b> — {message}
      <ol>
        <li>
          <code>ax-backend</code> 폴더에서 총괄을 띄워요:{' '}
          <code>uv run python -m ax_orchestrator --port 8000 --no-browser</code>
        </li>
        <li>
          터미널에 나온 포트가 8000이 아니면, 이 화면을 이렇게 다시 켜요:{' '}
          <code>ORCHESTRATOR_PROXY_TARGET=http://localhost:&lt;포트&gt; npm run dev:orchestrator</code>
        </li>
      </ol>
    </div>
  )
}
