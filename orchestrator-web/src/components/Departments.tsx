import { useState } from 'react'

import { deptDesc, deptTitle } from '../deptLabels'
import type { Department, Step } from '../types'
import { Sparkline, UsageChart } from './Charts'

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul' }) : '-'
const pct = (v: number | null) => (v === null ? '-' : `${Math.round(v * 100)}%`)
const ms = (v: number | null) => (v === null ? '-' : `${v}ms`)

const STEP_LABEL: Record<string, string> = {
  pending: '대기',
  running: '진행 중',
  completed: '완료',
  failed: '실패',
  held: '승인 대기',
  skipped: '건너뜀',
  rejected_by_human: '거절',
  transfer_queued: '이관 큐',
}

function ModeChip({ mode }: { mode: Department['mode'] }) {
  return <span className={`grade ${mode === 'real' ? 'A' : ''}`}>{mode === 'real' ? '실제' : '목'}</span>
}

function StatusChip({ dept }: { dept: Department }) {
  if (!dept.available) return <span className="chip-state bad">카드 없음</span>
  return <span className="chip-state ok">정상</span>
}

/** 왼쪽: 부서별 카드 목록. 카드를 누르면 오른쪽에 그 부서의 세부 내용이 뜬다 */
function DeptCard({
  dept,
  selected,
  onSelect,
}: {
  dept: Department
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button className={`dept-card${selected ? ' selected' : ''}`} onClick={onSelect}>
      <div className="dept-card-head">
        <div>
          <div className="dept-card-title">{deptTitle(dept.name)}</div>
          <div className="dept-card-sub">
            {dept.name} · {dept.owner ?? '담당 미확인'}
          </div>
        </div>
        <span className={`status-dot ${dept.available ? 'ok' : 'bad'}`} aria-label={dept.available ? '정상' : '카드 없음'} />
      </div>
      <div className="dept-card-foot">
        <Sparkline points={dept.series} />
        <div className="dept-card-num">
          {dept.usage.calls}
          <small>건/10분</small>
        </div>
      </div>
    </button>
  )
}

function Detail({ dept, steps }: { dept: Department; steps: Step[] }) {
  const mine = steps.filter((s) => s.dept === dept.name)
  const u = dept.usage
  return (
    <div className="dept-detail">
      <div className="detail-head">
        <div>
          <h3 className="detail-title">
            {deptTitle(dept.name)} <ModeChip mode={dept.mode} />
          </h3>
          <div className="detail-sub">
            {deptDesc(dept.name)} · 담당 {dept.owner ?? '미확인'}
          </div>
        </div>
        <StatusChip dept={dept} />
      </div>

      {!dept.available && (
        <div className="warn" style={{ marginBottom: 14 }}>
          확인할 수 없음: {dept.unavailable_reason}. 이 부서의 Agent Card에 skill이 없으면 총괄은 그
          단계를 건너뛰고 "확인할 수 없음"으로 보고해요.
        </div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="label">호출 (최근 10분)</div>
          <div className="kpi">
            {u.calls}
            <small>건</small>
          </div>
        </div>
        <div className="tile">
          <div className="label">성공률</div>
          <div className="kpi">{pct(u.success_rate)}</div>
          <div className="bar">
            <i style={{ width: `${Math.round((u.success_rate ?? 0) * 100)}%` }} />
          </div>
        </div>
        <div className="tile">
          <div className="label">평균 응답 · p95</div>
          <div className="kpi">
            {u.avg_ms ?? '-'}
            <small>ms · {ms(u.p95_ms)}</small>
          </div>
        </div>
        <div className="tile">
          <div className="label">재시도 · 승인 대기</div>
          <div className="kpi">
            {u.retries}
            <small>회 · {u.waiting}건</small>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <div className="label">
          호출 사용량 — 막대: 30초당 호출 수(빨강=오류), 노랑 선: 평균 응답 시간
        </div>
        <UsageChart points={dept.series} />
      </div>

      <div className="label" style={{ margin: '18px 0 8px' }}>
        skill별 사용 현황
      </div>
      {dept.skills.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>skill</th>
              <th>등급</th>
              <th>호출 (10분)</th>
              <th>성공률</th>
              <th>평균 응답</th>
              <th>재시도</th>
            </tr>
          </thead>
          <tbody>
            {dept.skills
              .filter((s) => s.orchestrator)
              .map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.id}</b>
                    <div className="note">{s.priority === 'required' ? '필수' : '권장'}</div>
                  </td>
                  <td>
                    <span className={`grade ${s.grade}`} style={{ marginLeft: 0 }}>
                      {s.grade}
                    </span>
                  </td>
                  <td>
                    <div className="spark-cell">
                      <Sparkline points={s.series} width={96} height={24} />
                      <span>{s.calls}건</span>
                    </div>
                  </td>
                  <td>
                    <div className="mini-bar">
                      <i style={{ width: `${Math.round((s.success_rate ?? 0) * 100)}%` }} />
                    </div>
                    <span className="note">{pct(s.success_rate)}</span>
                  </td>
                  <td>{ms(s.avg_ms)}</td>
                  <td>{s.retries || ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">표시할 skill이 없어요.</div>
      )}

      <div className="label" style={{ margin: '18px 0 8px' }}>
        이번 사건에서 맡은 일
      </div>
      {mine.length > 0 ? (
        <table>
          <tbody>
            {mine.map((s) => (
              <tr key={s.step_id}>
                <td>
                  {s.label}
                  {s.note && <div className="note">{s.note}</div>}
                </td>
                <td>
                  <span className={`st ${s.status}`}>
                    <i className="dot" />
                    {STEP_LABEL[s.status] ?? s.status}
                  </span>
                </td>
                <td>{s.attempts ? `${s.attempts}회` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">이 부서가 맡은 단계가 없어요.</div>
      )}

      <div className="label" style={{ margin: '18px 0 8px' }}>
        최근 호출 기록
      </div>
      <div className="logbox">
        {dept.recent.length > 0 ? (
          dept.recent.map((r, i) => (
            <div key={`${r.at}-${i}`}>
              <span className="t">{time(r.at)}</span>
              <span className={`lv ${r.status === 'completed' ? 'info' : 'warn'}`}>
                {r.status === 'completed' ? 'INFO' : 'WARN'}
              </span>
              {r.skill} · {r.status}
              {r.outcome ? ` (${r.outcome})` : ''} · {r.duration_ms}ms
            </div>
          ))
        ) : (
          <div className="t">아직 호출이 없어요.</div>
        )}
      </div>
    </div>
  )
}

export function Departments({ depts, steps }: { depts: Department[] | null; steps: Step[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  if (!depts) return <div className="empty">부서 정보를 불러오는 중이에요.</div>
  const current = depts.find((d) => d.name === selected) ?? depts[0]
  return (
    <div className="dept-layout">
      <div className="dept-list">
        {depts.map((d) => (
          <DeptCard key={d.name} dept={d} selected={d.name === current?.name} onSelect={() => setSelected(d.name)} />
        ))}
      </div>
      {current && <Detail dept={current} steps={steps} />}
    </div>
  )
}
