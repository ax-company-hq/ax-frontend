// 여러 화면이 같이 쓰는 작은 조각
import { Chip, type ChipTone } from '@dejafix/common-frontend'
import { DEPT_NAME, type Activity, type Dept } from './data'

export function Dep({ d }: { d: Dept }) {
  return <span className="dep">{DEPT_NAME[d]}</span>
}

export function Point({ children }: { children: string }) {
  return <code className="point">{children}</code>
}

const GRADE_TONE: Record<string, ChipTone> = { A: 'green', B: 'amber', C: 'amber', read: 'neutral' }
export function Grade({ g }: { g?: string }) {
  if (!g || g === '-') return null
  return (
    <Chip tone={GRADE_TONE[g] ?? 'neutral'} title={g === 'read' ? '상태를 바꾸지 않는 읽기' : `${g} 등급`}>
      {g === 'read' ? '읽기' : g}
    </Chip>
  )
}

export function State({ v }: { v: string }) {
  const tone: ChipTone = ['완료', '확정', '통과', '승인', '구현됨'].includes(v) ? 'green' : ['접수', '초안', '머지 대기', '불일치', 'C 보류', '중복 연결'].includes(v) ? 'amber' : 'neutral'
  return <Chip tone={tone}>{v}</Chip>
}

export function ActivityList({ items, compact }: { items: Activity[]; compact?: boolean }) {
  return (
    <ol className={`act${compact ? ' compact' : ''}`}>
      {items.map((a, i) => (
        <li key={i}>
          <span className="act-t mono">{a.t}</span>
          <div className="act-main">
            <div className="act-route">
              <Dep d={a.from} /> <span className="arrow">→</span> <Dep d={a.to} /> <Point>{a.point}</Point> <span className="kind">{a.kind}</span> <Grade g={a.grade} />
            </div>
            <div className="act-text">{a.text}</div>
            {!compact && <div className="act-ctx mono">{a.ctx}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
