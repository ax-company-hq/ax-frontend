// 프로젝트별 보기: 변경 요청 1건(context_id 하나)을 프로젝트 하나로 보고
// 요청 → 작업 → 운영 → 처리 → 소통 → 문서를 한 화면에 모은다. 왼쪽은 프로젝트 목록.
import type { Dispatch } from 'react'
import { Button, Card, Chip, Chips, useToast } from '@dejafix/common-frontend'
import { DEPT_NAME, type Action, type Request, type State as S } from './data'
import { ActivityList, Dep, State } from './parts'

const STAGES = ['요청', '작업', '운영', '처리', '소통', '문서'] as const
type Stage = (typeof STAGES)[number]

// 프로젝트 = 원본 요청 (같은 요청으로 연결만 한 것은 원본에 붙인다)
export const projectsOf = (s: S) => s.requests.filter((r) => r.state !== '중복 연결')

function gather(s: S, r: Request) {
  const spec = s.specs.find((x) => x.id === r.spec || x.request === r.id)
  const tasks = spec ? s.tasks.filter((t) => t.spec === spec.id) : []
  const prs = s.prs.filter((p) => tasks.some((t) => t.id === p.task))
  const incidents = s.incidents.filter((i) => i.candidates.some((c) => prs.some((p) => p.id === c.pr)) || i.ctx === r.ctx)
  const dups = s.requests.filter((x) => x.duplicateOf === r.id)
  const follow = s.requests.filter((x) => incidents.some((i) => i.followUp === x.id) && x.id !== r.id)
  const ids = [r.id, spec?.id].filter(Boolean) as string[]
  const threads = s.threads.filter((t) => (spec && t.on === spec.id))
  const mentions = s.threads.filter((t) => t.kind !== 'spec' && t.on !== spec?.id)
    .flatMap((t) => t.messages.filter((m) => ids.some((id) => m.text.includes(id))).map((m) => ({ ...m, ch: t.title })))
  const decisions = spec ? s.decisions.filter((x) => x.spec === spec.id) : []
  const docs = s.docs.filter((d) => d.about === r.id || d.blocks.some((b) => ids.some((id) => b.text.includes(id))))
  // 이 요청의 context_id + 이 프로젝트 PR이 연결된 장애 사건의 context_id
  const activity = s.activity.filter((a) => a.ctx === r.ctx || incidents.some((i) => i.ctx === a.ctx))
  const replies = activity.filter((a) => a.from === 'planning' && a.to !== 'planning' && a.to !== 'safety' && a.to !== 'shop')
  return { spec, tasks, prs, incidents, dups, follow, threads, mentions, decisions, docs, activity, replies }
}

// 단계별로 어디까지 왔나 (코드 규칙)
function stageDone(r: Request, g: ReturnType<typeof gather>): Record<Stage, boolean> {
  return {
    요청: true,
    작업: g.tasks.length > 0,
    운영: g.prs.some((p) => p.merged),
    처리: r.state === '완료',
    소통: g.threads.some((t) => t.messages.length > 0) || g.mentions.length > 0 || g.decisions.length > 0,
    문서: g.docs.length > 0,
  }
}

export function Projects({ s, d, sel }: { s: S; d: Dispatch<Action>; sel?: string }) {
  const toast = useToast()
  const list = projectsOf(s)
  const order = (r: Request) => (r.state === '작업 중' || r.state === '기획 중' ? 0 : r.state === '접수' ? 1 : 2)
  const sorted = list.slice().sort((a, b) => order(a) - order(b))
  const r = list.find((x) => x.id === sel) ?? sorted[0]
  if (!r) return null
  const g = gather(s, r)
  const done = stageDone(r, g)

  return (
    <div className="proj">
      <aside className="col-left proj-list" aria-label="프로젝트 목록">
        <div className="ph">프로젝트 {list.length}</div>
        {sorted.map((x) => (
          <a key={x.id} href={`#/projects/${x.id}`} className={`doc-li${x.id === r.id ? ' on' : ''}`}>
            <span className="mono">{x.id}</span> {x.title}
            <span className="proj-li-meta"><Dep d={x.from} /> <State v={x.state} />{x.auto?.ok && <Chip>자동</Chip>}</span>
          </a>
        ))}
      </aside>

      <section className="proj-main">
        <header className="proj-head">
          <div>
            <div className="muted small mono">{r.ctx}</div>
            <h1 className="proj-title">{r.id} {r.title}</h1>
            <Chips><Dep d={r.from} /><State v={r.state} />{g.spec && <Chip>{g.spec.id} {g.spec.status}</Chip>}{g.dups.length > 0 && <Chip>같은 요청 {g.dups.length}건 연결</Chip>}</Chips>
          </div>
          <Button size="small" onClick={() => { d({ type: 'gatherDoc', about: r.id }); toast.show(`${r.id} 정리 문서를 만들었습니다`) }}>이 프로젝트 문서로 정리</Button>
        </header>

        <ol className="proj-steps" aria-label="진행 단계">
          {STAGES.map((st) => (
            <li key={st} className={done[st] ? 'on' : ''}>
              {/* 해시 라우팅이라 앵커 대신 스크롤로 이동 */}
              <button type="button" className="linkish" onClick={() => document.getElementById(`stage-${st}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>{st}</button>
            </li>
          ))}
        </ol>

        <div className="proj-grid">
          <Card as="section" title="요청" sub={`${DEPT_NAME[r.from]} · ${r.via}`}>
            <div id="stage-요청" className="small">{r.evidence}</div>
            {r.auto && <ul className="proj-ul small">{r.auto.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}
            {g.dups.map((x) => <div key={x.id} className="small muted">연결된 같은 요청: {x.id} ({DEPT_NAME[x.from]})</div>)}
            <a href="#/requests/incoming" className="small">요청 화면에서 보기</a>
          </Card>

          <Card as="section" title="작업" sub={g.spec ? `${g.spec.id} 문단 ${g.spec.paras.length}개 · 작업 ${g.tasks.length}개` : '기획서 없음'}>
            <div id="stage-작업" />
            {g.spec ? (
              <ul className="proj-ul small">
                {g.spec.paras.map((p) => {
                  const ts = g.tasks.filter((t) => t.para === p.id)
                  return (
                    <li key={p.id}>
                      <b>{p.id}</b> {p.text}
                      {p.warn && <Chip tone="amber">{p.warn.card}</Chip>}
                      {p.incident && <Chip tone="amber">장애 {p.incident}</Chip>}
                      {ts.map((t) => <div key={t.id} className="muted">↳ {t.id} {t.title} · {t.state}</div>)}
                    </li>
                  )
                })}
              </ul>
            ) : <div className="muted small">아직 기획서가 없습니다. 요청 화면에서 채택하거나 확정하면 생깁니다.</div>}
            <a href="#/work/specs" className="small">기획서·작업 화면에서 보기</a>
          </Card>

          <Card as="section" title="운영" sub={`PR ${g.prs.length}건 · 머지 ${g.prs.filter((p) => p.merged).length}건`}>
            <div id="stage-운영" />
            {g.prs.length ? (
              <ul className="proj-ul small">
                {g.prs.map((p) => (
                  <li key={p.id}>
                    <b>{p.id}</b> {p.title}
                    <div className="muted mono">{p.branch} · {p.gate.lines}줄·{p.gate.files}파일 · execute() {p.gate.result}</div>
                    <Chips>
                      <Chip tone={p.reviews[p.reviews.length - 1] === '통과' ? 'green' : 'amber'}>검수 {p.reviews.join(' → ')}</Chip>
                      {p.merged ? <Chip tone="green">{p.auto ? '자동 머지' : '사람 머지'}</Chip> : <Chip>머지 전</Chip>}
                    </Chips>
                  </li>
                ))}
              </ul>
            ) : <div className="muted small">PR이 없습니다.</div>}
            <a href="#/work/ops" className="small">운영·배포에서 보기</a>
          </Card>

          <Card as="section" title="처리" sub="회신·장애 연결·후속 요청">
            <div id="stage-처리" />
            <ul className="proj-ul small">
              {g.replies.slice(-4).map((a, i) => <li key={i}><Dep d={a.to} /> <span className="mono">{a.point}</span> {a.text}</li>)}
              {g.incidents.map((i) => (
                <li key={i.ctx}>
                  <Chip tone="amber">장애</Chip> {i.ctx} {i.title}
                  {i.rollbackCheck && <div className="muted">롤백 교차검증 {i.rollbackCheck.result} · {i.rollbackCheck.why}</div>}
                </li>
              ))}
              {g.follow.map((x) => <li key={x.id}>후속 요청 <a href="#/requests/followup">{x.id}</a> {x.title} · {x.state}</li>)}
              {!g.replies.length && !g.incidents.length && <li className="muted">아직 처리 기록이 없습니다.</li>}
            </ul>
          </Card>

          <Card as="section" title="소통" sub={`스레드 ${g.threads.length} · 언급 ${g.mentions.length} · 결정 ${g.decisions.length}`}>
            <div id="stage-소통" />
            <ul className="proj-ul small">
              {g.threads.flatMap((t) => t.messages.slice(-3).map((m, i) => <li key={`${t.id}-${i}`}><b>{m.who}</b> {m.text}{m.decision && <Chip tone="green">결정 {m.decision}</Chip>}</li>))}
              {g.mentions.slice(-3).map((m, i) => <li key={`m-${i}`}><span className="muted">#{m.ch}</span> <b>{m.who}</b> {m.text}</li>)}
              {g.decisions.map((x) => <li key={x.id}><Chip tone="green">{x.id}</Chip> {x.text} <span className="muted">· 이유 {x.reason} · 대안 {x.alternatives}</span></li>)}
              {!g.threads.length && !g.mentions.length && !g.decisions.length && <li className="muted">관련 대화가 없습니다.</li>}
            </ul>
            <a href="#/talk" className="small">소통에서 보기</a>
          </Card>

          <Card as="section" title="문서" sub={`기획서 ${g.spec ? 1 : 0} · 정리 문서 ${g.docs.length}`}>
            <div id="stage-문서" />
            <ul className="proj-ul small">
              {g.spec && <li><a href="#/work/specs">{g.spec.id}</a> {g.spec.title} · 근거 {g.spec.basis.length}건</li>}
              {g.docs.map((x) => <li key={x.id}><a href="#/docs">{x.id}</a> {x.title}{x.by === 'ai' && <Chip>AI 정리</Chip>}</li>)}
              {!g.docs.length && <li className="muted">정리 문서가 없습니다. 위 "이 프로젝트 문서로 정리"를 누르면 생깁니다.</li>}
            </ul>
          </Card>
        </div>

        <Card as="section" title="프로젝트 활동" sub={`${r.ctx}${g.incidents.length ? ` + 연결된 사건 ${g.incidents.map((i) => i.ctx).join(', ')}` : ''}로 묶인 연결 지점 ${g.activity.length}건`}>
          <ActivityList items={g.activity.slice().reverse()} compact />
        </Card>
      </section>
    </div>
  )
}
