// 프로젝트별 보기: 변경 요청 1건(context_id 하나)을 프로젝트 하나로 본다. 왼쪽은 프로젝트 목록.
// 가운데는 순서대로 진행되는 요청 → 작업 → 운영 → 처리를 세로 흐름으로, 오른쪽은 아무 때나 생기는 소통·문서.
// 단계 한 줄·곁 블록은 통째로 눌러 그 내용을 다루는 화면(해당 프로젝트 항목)으로 간다.
import type { Dispatch, ReactNode } from 'react'
import {Button, useToast } from '@dejafix/common-frontend'
import { DEPT_NAME, type Action, type Request, type State as S } from './data'
import { ActivityList, Dep, State, rowNav, Tag } from './parts'
import { Linked, Ref, convoHref, hrefOf, prSlug } from './links'

const STAGES = ['요청', '작업', '운영', '처리', '소통', '문서'] as const
type Stage = (typeof STAGES)[number]
// 진행 막대에 넣는 단계는 순서대로 진행되는 요청→작업→운영→처리만. 소통·문서는 아무 때나 생겨 막대 밖에 따로 표시한다
const PROGRESS = STAGES.filter((st) => st !== '소통' && st !== '문서')

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
  const talks = g.threads.reduce((n, t) => n + t.messages.length, 0) + g.mentions.length

  // 단계마다 눌렀을 때 갈 곳: 그 단계를 실제로 다루는 화면의 이 프로젝트 항목
  const to: Record<(typeof PROGRESS)[number], string | undefined> = {
    요청: hrefOf(s, r.id),
    작업: g.spec ? `#/work/specs/${g.spec.id}` : hrefOf(s, r.id),
    운영: g.prs.length ? `#/work/ops/${r.id}` : undefined,
    처리: g.incidents[0] ? hrefOf(s, g.incidents[0].ctx) : g.replies.length ? convoHref(r.ctx) : undefined,
  }

  return (
    <div className="proj">
      <aside className="col-left proj-list" aria-label="프로젝트 목록">
        <div className="ph">프로젝트 {list.length}</div>
        {sorted.map((x) => (
          <a key={x.id} href={`#/projects/${x.id}`} className={`doc-li${x.id === r.id ? ' on' : ''}`}>
            <span className="li-title">{x.title}</span>
            <span className="proj-li-meta">{DEPT_NAME[x.from]} <State v={x.state} /></span>
          </a>
        ))}
      </aside>

      <section className="proj-main">
        <header className="proj-head">
          <div>
            <p className="proj-kicker">{r.id} · {DEPT_NAME[r.from]}</p>
            <h1 className="proj-title">{r.title}</h1>
          </div>
          <div className="proj-head-side">
            <State v={r.state} />
            <Button size="small" onClick={() => { d({ type: 'gatherDoc', about: r.id }); toast.show(`${r.id} 정리 문서를 만들었습니다`) }}>문서로 정리</Button>
          </div>
        </header>

        <div className="proj-body">
          <ol className="pflow" aria-label="진행 흐름">
            <Stage name="요청" on={done.요청} href={to.요청} title={`${DEPT_NAME[r.from]}에서 요청함`}>
              <p>근거: <Linked s={s} text={r.evidence} /></p>
              <p className="muted">받은 경로 {r.via}</p>
              {r.auto && <ul>{r.auto.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}
              {g.dups.map((x) => <p key={x.id} className="muted">같은 요청으로 연결: <Ref s={s} id={x.id} /> ({DEPT_NAME[x.from]})</p>)}
            </Stage>

            <Stage name="작업" on={done.작업} href={to.작업} title={g.spec ? `기획서 ${g.spec.status === '확정' ? '확정' : '작성 중'} · 작업 ${g.tasks.length}개` : '기획서 아직 없음'}
              empty={!g.spec && '요청을 채택하거나 확정하면 기획서와 작업이 생깁니다.'}>
              {g.spec && (
                <ul>
                  {g.spec.paras.map((p) => {
                    const ts = g.tasks.filter((t) => t.para === p.id)
                    return (
                      <li key={p.id}>
                        <a href={`#/work/specs/${g.spec!.id}/${p.id}`} className="plain-link">{p.text}</a>
                        {p.warn && <Tag tone="amber"> · 기각 이력 {p.warn.card}</Tag>}
                        {p.incident && <Tag tone="amber"> · 장애 연결</Tag>}
                        {ts.map((x) => <div key={x.id} className="muted">작업 {x.title} · {x.state}</div>)}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Stage>

            <Stage name="운영" on={done.운영} href={to.운영} title={g.prs.length ? `PR ${g.prs.length}건 중 ${g.prs.filter((p) => p.merged).length}건 머지` : 'PR 아직 없음'}
              empty={!g.prs.length && '작업이 PR로 만들어지면 여기에 쌓입니다.'}>
              <ul>
                {g.prs.map((p) => (
                  <li key={p.id}>
                    <a href={`#/work/prs/${prSlug(p.id)}`} className="plain-link">{p.title.replace(/^[A-Z]\d+: /, '')}</a>
                    <div className="muted">{p.id} · 검수 {p.reviews[p.reviews.length - 1]} · {p.merged ? (p.auto ? '자동 머지' : '팀장이 머지') : '머지 전'} · {p.gate.lines}줄 {p.gate.files}파일</div>
                  </li>
                ))}
              </ul>
            </Stage>

            <Stage name="처리" on={done.처리} href={to.처리} title={r.state === '완료' ? '요청 부서에 결과를 알림' : '아직 처리 전'}
              empty={!g.replies.length && !g.incidents.length && '머지 뒤 회신·장애 연결·후속 요청이 여기에 남습니다.'}>
              <ul>
                {g.replies.slice(-3).map((a, i) => <li key={i}><Dep d={a.to} />에 알림: <Linked s={s} text={a.text} /></li>)}
                {g.incidents.map((i) => (
                  <li key={i.ctx}>
                    장애 <Ref s={s} id={i.ctx} className="plain-link">{i.title}</Ref>
                    {i.rollbackCheck && <div className="muted">롤백 교차검증 {i.rollbackCheck.result} · {i.rollbackCheck.why}</div>}
                  </li>
                ))}
                {g.follow.map((x) => <li key={x.id}>후속 요청 <Ref s={s} id={x.id} /> {x.title}</li>)}
              </ul>
            </Stage>
          </ol>

          <aside className="pside">
            <Side title="소통" href={g.threads[0] ? `#/talk/${g.threads[0].id}` : convoHref(r.ctx)} sum={`${talks ? `대화 ${talks}개` : '대화 없음'}${g.decisions.length ? ` · 결정 ${g.decisions.length}건` : ''}`}>
              {g.threads.flatMap((t) => t.messages.slice(-2).map((m, i) => <p key={`${t.id}-${i}`} className="pside-msg"><b>{m.who}</b> <Linked s={s} text={m.text} /></p>))}
              {g.decisions.map((x) => <p key={x.id} className="pside-msg">결정: {x.text}</p>)}
              <a href={convoHref(r.ctx)} className="pside-link">에이전트 대화 {g.activity.length}건</a>
            </Side>
            <Side title="문서" href={g.docs.length ? `#/docs/${g.docs[g.docs.length - 1].id}` : undefined} sum={g.docs.length ? `정리 문서 ${g.docs.length}개` : '정리 문서가 없습니다. 문서로 정리를 누르면 지금까지의 내용을 한 장으로 모읍니다.'}>
              {g.docs.map((x) => <p key={x.id} className="pside-msg"><Ref s={s} id={x.id} /> {x.title}</p>)}
            </Side>
          </aside>
        </div>

        <details className="proj-activity">
          <summary>에이전트 활동 {g.activity.length}건</summary>
          <ActivityList s={s} items={g.activity.slice().reverse()} compact />
        </details>
      </section>
    </div>
  )
}

// 흐름 한 단계. 왼쪽 레일의 점은 단계에 기록이 있으면 채운다. 통째로 누르면 그 단계 화면으로 간다
function Stage({ name, on, href, title, badge, empty, children }: { name: string; on: boolean; href?: string; title: string; badge?: ReactNode; empty?: ReactNode; children?: ReactNode }) {
  const nav = rowNav(href, `${name} 화면에서 이 프로젝트 보기`)
  return (
    <li {...nav} className={`pstage${on ? ' on' : ''}${nav.className ? ` ${nav.className}` : ''}`}>
      <span className="pstage-dot" aria-hidden />
      <div>
        <div className="pstage-head">
          <span className="pstage-name">{name}</span>
          <span className="pstage-title">{title}</span>
          {badge}
          {href && <span className="pstage-go" aria-hidden>›</span>}
        </div>
        {empty ? <p className="pstage-empty">{empty}</p> : <div className="pstage-detail">{children}</div>}
      </div>
    </li>
  )
}

function Side({ title, sum, href, children }: { title: string; sum: string; href?: string; children?: ReactNode }) {
  const nav = rowNav(href, `${title} 열기`)
  return (
    <section {...nav} className={`pside-block${nav.className ? ` ${nav.className}` : ''}`}>
      <div className="pstage-head"><h2>{title}</h2>{href && <span className="pstage-go" aria-hidden>›</span>}</div>
      <p className="pside-sum">{sum}</p>
      {children}
    </section>
  )
}
