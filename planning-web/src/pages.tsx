// 기획개발팀 탭의 하위 화면 7개
import { useState, type Dispatch } from 'react'
import { Button, Card, Chip, Chips, DataTable, Notice, PageHeader, StatCard, useToast, type Column } from '@dejafix/common-frontend'
import { AUTO_LEVELS, DEPT_NAME, PORTS, PROMOTE_AFTER, type Action, type Port, type PR, type Request, type State as S } from './data'
import { codeOf, traceOf, type CodeLine } from './trace'
import { ActivityList, Dep, Grade, Point, State } from './parts'
import { SendWindow } from './depts'

interface P { s: S; d: Dispatch<Action> }

// ---------------------------------------------------------------- 요청 (들어온·진행 중·해결됨·후속)
export type RequestView = 'incoming' | 'progress' | 'done' | 'followup'
// 후속 요청 = 장애 뒤 재발 방지(link_incident)처럼 끝난 일에서 이어진 요청. 다른 세 화면에서는 뺀다
export const isFollowUp = (r: Request) => r.via.includes('재발 방지')
export const REQUEST_VIEWS: Record<RequestView, { title: string; sub: string; match: (r: Request) => boolean }> = {
  incoming: { title: '들어온 요청', sub: '다른 부서가 보낸 변경 요청 중 아직 기획을 시작하지 않은 것. 같은 요청은 새로 만들지 않고 연결한다.', match: (r) => !isFollowUp(r) && r.state === '접수' },
  progress: { title: '진행 중인 요청', sub: '기획서를 쓰고 있거나 작업·PR이 진행 중인 요청.', match: (r) => !isFollowUp(r) && (r.state === '기획 중' || r.state === '작업 중') },
  done: { title: '해결된 요청', sub: '머지까지 끝나 요청 부서에 회신한 요청과, 같은 요청에 연결해 닫은 요청.', match: (r) => !isFollowUp(r) && (r.state === '완료' || r.state === '중복 연결') },
  followup: { title: '후속 요청', sub: '장애가 난 뒤 재발 방지(link_incident)로 등록된 요청. 같은 사건이 다시 나면 새로 만들지 않고 연결한다.', match: isFollowUp },
}

export function Requests({ s, d, view }: P & { view: RequestView }) {
  const v = REQUEST_VIEWS[view]
  const rows = s.requests.filter(v.match)
  const [pick, setSel] = useState<string>()
  const sel = rows.some((x) => x.id === pick) ? pick : rows[0]?.id
  const r = s.requests.find((x) => x.id === sel)
  const cols: Column<Request>[] = [
    { key: 'id', header: '요청', render: (x) => <button type="button" className="linkish mono" onClick={() => setSel(x.id)}>{x.id}</button> },
    { key: 'from', header: '보낸 부서', render: (x) => <Dep d={x.from} /> },
    { key: 'via', header: '들어온 연결 지점', render: (x) => <Point>{x.via}</Point> },
    { key: 'title', header: '내용' },
    { key: 'state', header: '상태', render: (x) => <><State v={x.state} />{x.auto?.ok && <> <Chip tone="green">자동 처리</Chip></>}</> },
  ]
  return (
    <>
      <PageHeader title={v.title} sub={v.sub} />
      <div className="split">
        <Card title={v.title} sub={`${rows.length}건`} as="section">
          {rows.length ? <DataTable columns={cols} rows={rows} rowKey={(x) => x.id} highlight={(x) => x.id === sel} /> : <span className="muted">해당하는 요청이 없습니다.</span>}
        </Card>
        {r && (
          <Card title={`${r.id} 상세`} sub={r.ctx} as="section">
            <dl className="kv">
              <dt>보낸 부서</dt><dd><Dep d={r.from} /> · <Point>{r.via}</Point></dd>
              <dt>내용</dt><dd>{r.title}</dd>
              <dt>근거</dt><dd>{r.evidence}</dd>
              <dt>중복 확인</dt><dd>{r.duplicateOf ? <>같은 요청 {r.duplicateOf}에 연결함 (규칙 확인)</> : '같은 요청 없음 (규칙 확인)'}</dd>
              <dt>연결 문서</dt><dd>{r.spec ? <a href="#/work/specs">{r.spec}</a> : <span className="muted">아직 없음</span>}</dd>
              <dt>상태</dt><dd><State v={r.state} /> <span className="muted">요청 부서는 get_request_status로 같은 상태를 본다</span></dd>
              {r.auto && (
                <>
                  <dt>간단 요청</dt>
                  <dd>
                    <Chip tone={r.auto.ok ? 'green' : 'amber'}>{r.auto.ok ? '통과 · 사람 승인 없이 처리' : '해당 없음 · 팀장 확정'}</Chip>
                    <ul className="flow" style={{ marginTop: 6, fontSize: 13 }}>{r.auto.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                  </dd>
                </>
              )}
            </dl>
            {r.state === '접수' && (r.from === 'hr' || r.from === 'data') && (
              <div className="actions">
                <Button variant="primary" onClick={() => d({ type: 'acceptDraft', request: r.id })}>개선 초안 채택 (review_ticket_draft)</Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 기획 문서 (문서가 원본, 문단에 모든 것이 붙는다)
export function Specs({ s, d }: P) {
  const toast = useToast()
  const [specId, setSpecId] = useState('SPEC-7')
  const spec = s.specs.find((x) => x.id === specId)!
  const [paraId, setParaId] = useState('R2')
  const para = spec.paras.find((p) => p.id === paraId) ?? spec.paras[0]
  const tasks = s.tasks.filter((t) => t.spec === spec.id && t.para === para.id)
  const prs = s.prs.filter((p) => tasks.some((t) => t.id === p.task))
  const decisions = s.decisions.filter((x) => x.spec === spec.id)
  const thread = s.threads.find((t) => t.on === spec.id)
  const inc = s.incidents.find((i) => i.candidates.some((c) => c.spec === spec.id && c.para === para.id))
  const canGenerate = spec.status === '확정' && s.tasks.some((t) => t.spec === spec.id && t.state === '진행 중')

  return (
    <div className="three">
      <aside className="col-left">
        <div className="ph">기획 문서</div>
        {s.specs.map((x) => (
          <button key={x.id} type="button" className={`doc-li${x.id === specId ? ' on' : ''}`} onClick={() => { setSpecId(x.id); setParaId(x.paras[0].id) }}>
            <span className="mono">{x.id}</span> {x.title} <State v={x.status} />
          </button>
        ))}
        <div className="ph" style={{ marginTop: 18 }}>{spec.id} 개요</div>
        <ul className="outline">
          <li>문제 · 목표</li>
          {spec.paras.map((p) => (
            <li key={p.id}><button type="button" onClick={() => setParaId(p.id)} className={p.id === para.id ? 'on' : ''}>{p.id} {p.kind === 'req' ? '요구사항' : '완료 기준'}</button></li>
          ))}
          {spec.question && <li>질문 1개 남음</li>}
          <li>결정 이력 {decisions.length}건</li>
        </ul>
      </aside>

      <section className="col-doc">
        <div className="doc-head">
          <h1 className="page-title" style={{ margin: 0 }}>{spec.title}</h1>
          <State v={spec.status} />
          {spec.auto && <Chip tone="green">자동 처리 · 사람 승인 없음</Chip>}
          <span style={{ flex: 1 }} />
          {spec.status === '초안' ? (
            <Button variant="primary" onClick={() => { d({ type: 'confirmSpec', spec: spec.id }); toast.show(`${spec.id} 확정 → 작업 분할, 인사에 spec_confirmed 전송`) }}>기획서 확정 (팀장)</Button>
          ) : canGenerate ? (
            <Button variant="dark" icon="sparkle" onClick={() => { d({ type: 'generatePrs', spec: spec.id }); toast.show('generate_pr 실행 → 안전 레이어 규칙 검증 → PR 생성') }}>시연: 에이전트가 PR 생성</Button>
          ) : null}
        </div>
        <p className="muted small">
          요청 <span className="mono">{spec.request}</span> · 에이전트가 작성, 사람이 쓴 문장 {spec.humanSentences}개
        </p>
        {spec.status === '초안' && spec.question && <Notice tone="warn">빈 항목 질문이 남아 있습니다. 확정 전에 스레드에서 답을 받는 것을 권합니다.</Notice>}
        <h3 className="sec">문제</h3><p>{spec.problem}</p>
        <h3 className="sec">목표</h3><p>{spec.goal}</p>
        <h3 className="sec">요구사항</h3>
        {spec.paras.filter((p) => p.kind === 'req').map((p) => <ParaBox key={p.id} p={p} on={p.id === para.id} onClick={() => setParaId(p.id)} s={s} spec={spec.id} />)}
        <h3 className="sec">완료 기준</h3>
        {spec.paras.filter((p) => p.kind === 'done').map((p) => <ParaBox key={p.id} p={p} on={p.id === para.id} onClick={() => setParaId(p.id)} s={s} spec={spec.id} />)}
        {spec.question && (
          <div className="question">
            질문 · {spec.question}
            <Button size="small" onClick={() => d({ type: 'answerQuestion', spec: spec.id, text: '재고가 없어진 상품은 남기되 품절로 표시해 주세요.' })}>시연: 고객지원이 스레드에 답함</Button>
          </div>
        )}
        <h3 className="sec">근거</h3>
        <Chips>{spec.basis.map((b) => <Chip key={b}>{b}</Chip>)}</Chips>
      </section>

      <aside className="col-right">
        <div className="ph">선택한 문단 {para.id}에 연결된 것</div>
        <Card title="작업" sub={`${tasks.length}건`}>
          {tasks.length ? tasks.map((t) => <div key={t.id} className="mini-row"><span className="mono">{t.id}</span> {t.title} <State v={t.state} /></div>) : <span className="muted">기획서를 확정하면 split_tasks가 나눈다</span>}
        </Card>
        <Card title="PR" sub="작업 1개 = PR 1개">
          {prs.length ? prs.map((p) => <PrLine key={p.id} p={p} d={d} />) : <span className="muted">아직 없음</span>}
        </Card>
        <Card title="스레드 · 결정">
          {thread?.messages.slice(-2).map((m, i) => <div key={i} className="msg"><b>{m.who}</b> {m.text}{m.decision && <> <Chip tone="green">{m.decision}</Chip></>}</div>)}
          {decisions.map((x) => <div key={x.id} className="msg"><span className="mono">{x.id}</span> {x.text} {x.sentToHr && <span className="muted">· 인사에 ① 전송</span>}</div>)}
        </Card>
        <Card title="장애 연결" sub="DejaFix 사후관리">
          {inc ? <div className="msg"><span className="mono">{inc.ctx}</span> {inc.title} → 관련 PR {inc.candidates.map((c) => c.pr).join(', ')}</div> : <span className="muted">연결된 사건 없음</span>}
        </Card>
        <div className="ph" style={{ marginTop: 6 }}>최근 에이전트 활동</div>
        <ActivityList items={s.activity.filter((a) => a.ctx === (s.requests.find((r) => r.id === spec.request)?.ctx ?? 'ctx_req_0012')).slice(-4).reverse()} compact />
      </aside>
    </div>
  )
}

function ParaBox({ p, on, onClick, s, spec }: { p: S['specs'][number]['paras'][number]; on: boolean; onClick: () => void; s: S; spec: string }) {
  const tasks = s.tasks.filter((t) => t.spec === spec && t.para === p.id)
  const prs = s.prs.filter((x) => tasks.some((t) => t.id === x.task))
  const done = tasks.length > 0 && tasks.every((t) => t.state === '완료')
  return (
    <button type="button" className={`para${on ? ' on' : ''}`} onClick={onClick}>
      <div><span className="pid">{p.id}</span>{p.text}</div>
      {p.warn && <div className="warnline">인사운영 ② 경고 ({p.warn.card}) · {p.warn.text}</div>}
      {p.incident && <div className="incline">장애 표시 · {p.incident} (link_incident)</div>}
      {(tasks.length > 0 || done) && (
        <Chips>
          {tasks.map((t) => <Chip key={t.id}>{t.id}</Chip>)}
          {prs.map((x) => <Chip key={x.id}>{x.id}</Chip>)}
          {done && <Chip tone="green">구현됨</Chip>}
        </Chips>
      )}
    </button>
  )
}

function PrLine({ p, d, onTrace }: { p: PR; d: Dispatch<Action>; onTrace?: () => void }) {
  const last = p.reviews[p.reviews.length - 1]
  return (
    <div className="pr-line">
      <div><b>{p.id}</b> {p.title}</div>
      <div className="muted small mono">{p.branch} · generated-pr{p.auto ? ' · 자동 머지' : ''}</div>
      <Chips>
        <Chip tone={last === '통과' ? 'green' : 'amber'}>검수 {last}{p.reviews.length > 1 ? ` (${p.reviews.length}회차)` : ''}</Chip>
        <Chip>execute() {p.gate.result}</Chip>
        {p.merged && <Chip tone="green">머지됨</Chip>}
      </Chips>
      {!p.merged && last === '불일치' && <Button size="small" onClick={() => d({ type: 'reviewPr', pr: p.id })}>시연: 수정 커밋 후 재검수</Button>}
      {!p.merged && last === '통과' && <Button size="small" variant="primary" onClick={() => d({ type: 'mergePr', pr: p.id })}>PR 머지 (팀장)</Button>}
      {onTrace && <button type="button" className="linkish small" onClick={onTrace}>이 코드 왜 이렇게 했지?</button>}
    </div>
  )
}

// ---------------------------------------------------------------- 작업·PR
export function Work({ s, d }: P) {
  const cols = ['진행 중', 'PR 검수', '머지 대기', '완료'] as const
  const [sel, setSel] = useState<{ pr: string; line?: CodeLine }>({ pr: s.prs[0]?.id ?? '' })
  return (
    <>
      <PageHeader title="작업·PR" sub="작업 1개 = PR 1개. PR은 안전 레이어 코드 규칙(변경 줄 수·파일 수·허용 경로)을 통과해야 열리고, 머지는 사람이 한다. 간단 요청 규칙을 통과한 것만 자동 머지." />
      <div className="kanban">
        {cols.map((c) => {
          const tasks = s.tasks.filter((t) => t.state === c)
          return (
            <section key={c} className="kcol">
              <div className="kcol-h">{c} <span className="muted">{tasks.length}</span></div>
              {tasks.map((t) => {
                const pr = s.prs.find((p) => p.task === t.id)
                return (
                  <div key={t.id} className="kcard">
                    <div><span className="mono">{t.id}</span> {t.title}</div>
                    <div className="muted small">{t.spec} {t.para} · 담당 제안 {t.owner}</div>
                    {pr && <PrLine p={pr} d={d} onTrace={() => setSel({ pr: pr.id })} />}
                  </div>
                )
              })}
              {!tasks.length && <div className="muted small">비어 있음</div>}
            </section>
          )
        })}
      </div>
      <Trace s={s} sel={sel} setSel={setSel} />
      <Notice icon="bell">기준을 넘는 PR(C 등급)은 여기에 보류 목록을 따로 두지 않고, 대시보드의 공통 C 보류 큐에 올라가 담당자가 승인·거절한다 (10분 미처리 시 자동 거절).</Notice>
    </>
  )
}

// ---------------------------------------------------------------- 코드 역추적 (코드 줄 → PR → 작업 → 문단 → 결정 → 요청 → 근거)
function Trace({ s, sel, setSel }: { s: S; sel: { pr: string; line?: CodeLine }; setSel: (x: { pr: string; line?: CodeLine }) => void }) {
  const pr = s.prs.find((p) => p.id === sel.pr)
  if (!pr) return null
  const lines = codeOf(s, pr)
  const line = sel.line ?? lines[0]
  const steps = traceOf(s, pr.id, line)
  return (
    <Card as="section" title="코드 역추적" sub="코드 한 줄에서 PR·작업·기획서 문단·결정·원래 요청·근거까지 문단 id로 거슬러 올라간다. 연결은 코드 규칙으로만 따라가고 판정 문장은 만들지 않는다.">
      <div className="trace">
        <div className="trace-code">
          <div className="trace-h">PR</div>
          <div className="trace-prs">
            {s.prs.map((p) => (
              <button key={p.id} type="button" className={p.id === pr.id ? 'on' : ''} onClick={() => setSel({ pr: p.id })}>
                {p.id}{p.auto ? ' · 자동' : ''}
              </button>
            ))}
          </div>
          <div className="trace-h">바뀐 줄 (눌러서 추적)</div>
          {lines.map((l) => (
            <button key={`${l.path}:${l.line}`} type="button" className={`code-line${l.line === line.line && l.path === line.path ? ' on' : ''}`} onClick={() => setSel({ pr: pr.id, line: l })}>
              <span className="muted small mono">{l.path}:{l.line}</span>
              <code>{l.text}</code>
            </button>
          ))}
        </div>
        <ol className="trace-chain">
          {steps.map((x, i) => (
            <li key={i} className="trace-step">
              <span className="trace-kind">{x.kind}</span>
              <div>
                <div>{x.href ? <a href={x.href}>{x.title}</a> : <b>{x.title}</b>}</div>
                {x.detail && <div className="muted small">{x.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- 자동 처리 범위 (간단 요청 자동 머지의 신뢰 이력)
export function Autonomy({ s, d }: P) {
  const toast = useToast()
  const pol = s.autoPolicy
  const cur = AUTO_LEVELS[pol.level]
  const linked = pol.history.filter((h) => h.result === '장애 연결').length
  const proposal = pol.proposal
  return (
    <>
      <PageHeader title="자동 처리 범위" sub="간단 요청 자동 머지가 정상으로 쌓이면 범위를 넓히자고 제안하고 승인은 팀장이 한다. 자동 머지한 PR이 장애에 연결되면 승인 없이 바로 한 단계 줄인다. 단계·기준값은 시연값이다." />
      <div className="grid kpi metrics" style={{ marginBottom: 16 }}>
        <StatCard label="현재 단계" value={`L${pol.level}`} hint={cur.name} />
        <StatCard label="자동 처리 기준" value={pol.level ? `${cur.lines}줄·${cur.files}파일` : '중지'} hint={`허용 경로 ${pol.paths}`} />
        <StatCard label="연속 정상" value={`${pol.streak}/${PROMOTE_AFTER}`} hint="마지막 단계 변경 뒤" />
        <StatCard label="자동 머지 / 장애 연결" value={`${pol.history.length} / ${linked}`} hint="건" />
      </div>
      {proposal && (
        <Notice icon="sparkle">
          <b>L{pol.level} → L{proposal.to} 승급 제안</b> · {proposal.why}. 승인하면 간단 요청 기준이 {AUTO_LEVELS[proposal.to].lines}줄·{AUTO_LEVELS[proposal.to].files}파일로 넓어진다.{' '}
          <Button size="small" variant="primary" onClick={() => { d({ type: 'approvePromotion' }); toast.show(`L${proposal.to}로 승급`) }}>승급 승인 (팀장)</Button>{' '}
          <Button size="small" onClick={() => d({ type: 'rejectPromotion' })}>보류</Button>
        </Notice>
      )}
      <div className="auto-grid">
        <Card as="section" title="단계" sub="넓히기 = 사람 승인, 줄이기 = 자동">
          <ul className="levels">
            {AUTO_LEVELS.map((l) => (
              <li key={l.level} className={l.level === pol.level ? 'on' : ''}>
                <b>L{l.level}</b> {l.name} <span className="muted small">{l.level ? `${l.lines}줄·${l.files}파일 이하` : '모든 요청 사람 확정'}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card as="section" title="변경 기록" sub="누가(사람·자동) 언제 바꿨나">
          <ul className="levels">
            {pol.log.slice().reverse().map((x, i) => (
              <li key={i}><Chip tone={x.by === '사람' ? 'neutral' : 'amber'}>{x.by}</Chip> <span className="muted small mono">{x.t}</span> {x.text}</li>
            ))}
          </ul>
        </Card>
      </div>
      <Card as="section" title="자동 처리 이력" sub="간단 요청 규칙으로 자동 머지한 PR과 그 뒤 결과">
        {pol.history.length ? (
          <table className="auto-table">
            <thead><tr><th>시각</th><th>PR</th><th>요청</th><th>변경</th><th>결과</th></tr></thead>
            <tbody>
              {pol.history.slice().reverse().map((h) => (
                <tr key={h.pr}>
                  <td className="mono small">{h.t}</td><td>{h.pr}</td><td>{h.req}</td><td>{h.lines}줄·{h.files}파일</td>
                  <td><Chip tone={h.result === '정상' ? 'green' : 'amber'}>{h.result}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="muted small">아직 자동 처리한 요청이 없습니다. 다른 부서 화면에서 "간단 요청 보내기"를 눌러 보세요.</div>}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 지표 (모두 코드로 계산)
export function Metrics({ s }: { s: S }) {
  const prs = s.prs
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null)
  const avgPr = s.firstPrMinutes.length ? Math.round(s.firstPrMinutes.reduce((a, b) => a + b, 0) / s.firstPrMinutes.length) : null
  const human = s.specs.reduce((a, x) => a + x.humanSentences, 0) + s.threads.flatMap((t) => t.messages).filter((m) => m.dept !== 'planning').length
  return (
    <>
      <PageHeader title="지표" sub="숫자는 코드가 계산한다. 지금 값은 목 데이터 기준이고, 실제 수치는 시연 실측값만 쓴다." />
      <div className="grid kpi metrics">
        <StatCard label="기획 한 줄 → 첫 PR" value={avgPr} unit="분" hint="요청 등록부터 첫 PR까지 평균" />
        <StatCard label="완료 기준 일치율" value={pct(prs.filter((p) => p.reviews[p.reviews.length - 1] === '통과').length, prs.length)} unit="%" hint={`PR ${prs.length}건 중 검수 통과`} />
        <StatCard label="사람이 쓴 문장 수" value={human} unit="개" hint="확정·머지 클릭은 따로 센다" />
        <StatCard label="PR 검수 1회 통과율" value={pct(prs.filter((p) => p.reviews[0] === '통과').length, prs.length)} unit="%" hint="수정 없이 첫 검수 통과" />
        <StatCard label="기각 안 경고" value={s.warnings} unit="건" hint="인사운영 ② check_plan" />
        <StatCard label="개선 초안 채택률" value={pct(s.draftsAccepted, s.draftsIn)} unit="%" hint={`인사·데이터 초안 ${s.draftsIn}건 중`} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 사후관리 (DejaFix 연동)
// ---------------------------------------------------------------- 운영·배포 (머지된 PR이 어디까지 나갔나)
export function Ops({ s }: { s: S }) {
  const merged = s.prs.filter((p) => p.merged)
  const open = s.prs.filter((p) => !p.merged)
  const incidentOf = (pr: string) => s.incidents.find((i) => i.candidates.some((c) => c.pr === pr))
  return (
    <>
      <PageHeader title="운영·배포" sub="머지된 PR이 dev에 배포되고, 장애가 나면 어느 PR과 연결됐는지 본다. 배포·롤백 실행은 인프라(DejaFix)가 한다." />
      <div className="grid kpi metrics" style={{ marginBottom: 16 }}>
        <StatCard label="배포된 PR" value={merged.length} />
        <StatCard label="자동 머지" value={merged.filter((p) => p.auto).length} />
        <StatCard label="머지 전 PR" value={open.length} />
      </div>
      <Card title="배포 이력" sub="머지 = dev 배포 (데모 기준)" as="section">
        <DataTable
          rows={merged.slice().reverse()}
          rowKey={(p) => p.id}
          columns={[
            { key: 'id', header: 'PR', render: (p) => <span className="mono">{p.id}</span> },
            { key: 'title', header: '내용' },
            { key: 'branch', header: '브랜치', render: (p) => <span className="mono small">{p.branch}</span> },
            { key: 'how', header: '머지', render: (p) => <Chip tone={p.auto ? 'green' : 'neutral'}>{p.auto ? '자동 (간단 요청)' : '사람 (팀장)'}</Chip> },
            { key: 'gate', header: '안전 레이어', render: (p) => `${p.gate.result} · ${p.gate.lines}줄·${p.gate.files}파일` },
            { key: 'inc', header: '장애 연결', render: (p) => { const i = incidentOf(p.id); return i ? <Chip tone="amber">{i.ctx}</Chip> : <span className="muted">없음</span> } },
          ]}
        />
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 사후관리 (DejaFix 연동)
export function Aftercare({ s }: { s: S }) {
  return (
    <>
      <PageHeader title="사후관리" sub="원인 판정과 롤백은 인프라(DejaFix)가 한다. 기획개발은 관련 PR 후보 회신, 롤백 교차검증, 문단 장애 표시, 재발 방지 요청 등록까지." />
      {s.incidents.map((i) => (
        <Card key={i.ctx} title={i.title} sub={`${i.ctx} · ${i.at}`} as="section">
          <ol className="flow">
            <li><Dep d="infra" />·<Dep d="data" /> → 기획개발 <Point>find_related_prs</Point> : 관련 PR 후보 {i.candidates.map((c) => `${c.pr} (${c.spec} ${c.para}, ${c.mergedAt} 머지)`).join(', ')}</li>
            {i.rollbackCheck && <li><Dep d="safety" /> → 기획개발 <Point>verify_rollback_target</Point> : {i.rollbackCheck.target} 롤백 <State v={i.rollbackCheck.result} /> · {i.rollbackCheck.why}</li>}
            <li>기획개발 <Point>link_incident</Point> : 문단 {i.candidates.map((c) => `${c.spec} ${c.para}`).join(', ')}에 장애 표시 {i.linked ? <State v="완료" /> : null}</li>
            {i.followUp && <li>재발 방지 요청 <a href="#/requests/followup" className="mono">{i.followUp}</a> 후속 요청으로 등록</li>}
          </ol>
        </Card>
      ))}
      <Card title="이 사건의 활동" as="section">
        <ActivityList items={s.activity.filter((a) => a.ctx.startsWith('ctx_inc_'))} />
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 에이전트 활동 (부서별로 걸러 보기)
export function Activity({ s }: { s: S }) {
  const [peer, setPeer] = useState<string>('all')
  const peers = Array.from(new Set(s.activity.flatMap((a) => [a.from, a.to]).filter((d) => d !== 'planning')))
  const rows = [...s.activity].reverse().filter((a) => peer === 'all' || a.from === peer || a.to === peer)
  return (
    <>
      <PageHeader title="에이전트 활동" sub="기획개발이 다른 부서와 주고받은 연결 지점을 시간 역순으로 본다. 사건·요청 단위는 context_id로 묶인다." />
      <div className="chips" style={{ marginBottom: 14 }}>
        <button type="button" className={`q-chip${peer === 'all' ? ' on' : ''}`} onClick={() => setPeer('all')}>전체 {s.activity.length}</button>
        {peers.map((d) => (
          <button key={d} type="button" className={`q-chip${peer === d ? ' on' : ''}`} onClick={() => setPeer(d)}>
            {DEPT_NAME[d]} {s.activity.filter((a) => a.from === d || a.to === d).length}
          </button>
        ))}
      </div>
      <Card title="활동 로그" sub={`${rows.length}건`} as="section">
        <ActivityList items={rows} />
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 연동 (부서 간 연결 지점)
export function Links({ s, d }: P) {
  const count = (p: Port) => s.activity.filter((a) => a.point.startsWith(p.point.split(' ')[0]) && (p.dir === 'in' ? a.from === p.peer || p.peer === 'support' && a.from === 'marketing' : a.to === p.peer)).length
  const cols: Column<Port>[] = [
    { key: 'peer', header: '상대', render: (p) => <Dep d={p.peer} /> },
    { key: 'point', header: '연결 지점', render: (p) => <Point>{p.point}</Point> },
    { key: 'kind', header: '방식' },
    { key: 'grade', header: '등급', render: (p) => <Grade g={p.grade} /> },
    { key: 'priority', header: '우선순위', render: (p) => <Chip tone={p.priority === 'required' ? 'green' : 'neutral'}>{p.priority}</Chip> },
    { key: 'what', header: '하는 일' },
    { key: 'n', header: '오늘 호출', numeric: true, render: (p) => count(p) },
  ]
  return (
    <>
      <PageHeader title="연동" sub="기획개발이 다른 부서와 만나는 연결 지점. 공통 구성안·부서별 수정 요청(10/22) 기준이고, 시나리오 A 필수는 required." />
      <SendWindow d={d} />
      <div className="grid two">
        <Card title="받는 연결 (← 다른 부서가 기획개발을 부름)" as="section">
          <DataTable columns={cols} rows={PORTS.filter((p) => p.dir === 'in')} rowKey={(p) => `${p.point}|${p.peer}`} highlight={(p) => p.priority === 'required'} />
        </Card>
        <Card title="보내는 연결 (→ 기획개발이 다른 부서를 부름)" as="section">
          <DataTable columns={cols} rows={PORTS.filter((p) => p.dir === 'out')} rowKey={(p) => `${p.point}|${p.peer}`} />
        </Card>
      </div>
      <Card title="전체 활동 로그" sub="context_id로 사건·요청 단위가 묶인다" as="section">
        <ActivityList items={[...s.activity].reverse()} />
      </Card>
    </>
  )
}
