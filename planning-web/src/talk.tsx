// 소통 (슬랙 벤치마킹): 왼쪽 채널 목록, 가운데 대화, 오른쪽 채널 정보.
// 부서 채널에 쓴 메시지는 그 부서 창구(다른 부서 페이지)로 가고, 메시지는 결정으로 기록하거나 정리 문서에 옮길 수 있다.
import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent } from 'react'
import { Chip, Select, useToast } from '@dejafix/common-frontend'
import { DEPT_NAME, type Action, type Message, type State, type Thread } from './data'

// 채널마다 마지막으로 본 메시지 수 (화면을 옮겨도 유지)
const seen = new Map<string, number>()

const channelName = (t: Thread) => (t.kind === 'team' ? '기획개발팀' : t.kind === 'dept' ? t.title : t.on.toLowerCase())
const topic = (t: Thread) =>
  t.kind === 'team' ? '기획개발팀 내부 대화. 에이전트 알림도 여기에 온다.'
    : t.kind === 'dept' ? `${t.title}와 주고받는 채널. 여기 쓴 메시지는 ${t.title} 창구로 간다.`
      : `${t.title} 문서 스레드. 여기서 나온 결정은 문서 결정 이력에 남는다.`

export function Talk({ s, d }: { s: State; d: Dispatch<Action> }) {
  const toast = useToast()
  const [sel, setSel] = useState('CH-team')
  const [text, setText] = useState('')
  const [docId, setDocId] = useState(s.docs[s.docs.length - 1]?.id ?? '')
  const th = s.threads.find((t) => t.id === sel) ?? s.threads[0]
  const end = useRef<HTMLDivElement>(null)

  for (const t of s.threads) if (!seen.has(t.id)) seen.set(t.id, t.messages.length)
  useEffect(() => {
    seen.set(th.id, th.messages.length)
    end.current?.scrollIntoView({ block: 'end' })
  }, [th.id, th.messages.length])

  const spec = th.on ? s.specs.find((x) => x.id === th.on) : undefined
  const decisions = s.decisions.filter((x) => x.from.includes(th.title) || (th.on && x.spec === th.on))
  const send = () => {
    if (!text.trim()) return
    d({ type: 'postMessage', thread: th.id, text })
    if (th.peer) toast.show(`${DEPT_NAME[th.peer]} 창구로 보냄`)
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const group = (label: string, list: Thread[]) => (
    <div className="sl-group">
      <div className="sl-group-h">{label}</div>
      {list.map((t) => {
        const unread = t.id === th.id ? 0 : Math.max(0, t.messages.length - (seen.get(t.id) ?? 0))
        return (
          <button key={t.id} type="button" className={`sl-ch${t.id === th.id ? ' on' : ''}${unread ? ' unread' : ''}`} onClick={() => setSel(t.id)}>
            <span className="sl-hash">{t.kind === 'dept' ? '●' : '#'}</span>
            <span className="sl-ch-name">{channelName(t)}</span>
            {unread > 0 && <span className="sl-badge">{unread}</span>}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="slack">
      <aside className="sl-side" aria-label="채널">
        <div className="sl-ws">기획개발 소통</div>
        {group('채널', s.threads.filter((t) => t.kind === 'team'))}
        {group('부서', s.threads.filter((t) => t.kind === 'dept'))}
        {group('문서 스레드', s.threads.filter((t) => !t.kind || t.kind === 'spec'))}
      </aside>

      <section className="sl-main">
        <header className="sl-head">
          <div><b>{th.kind === 'dept' ? '' : '# '}{channelName(th)}</b> <span className="muted small">{topic(th)}</span></div>
          {spec && <a href="#/work/specs" className="small">{spec.id} 문서 열기</a>}
        </header>
        <div className="sl-msgs">
          <div className="sl-day"><span>오늘</span></div>
          {th.messages.length === 0 && <div className="sl-empty"><b># {channelName(th)}</b> 채널의 첫 대화를 시작하세요.</div>}
          {th.messages.map((m, i) => (
            <Row key={i} m={m} cont={i > 0 && th.messages[i - 1].who === m.who}>
              <div className="sl-tools">
                {!m.decision && <button type="button" onClick={() => { d({ type: 'extractDecision', thread: th.id, index: i }); toast.show('결정으로 기록 → 인사에 ① 전송') }}>결정으로 기록</button>}
                {docId && <button type="button" onClick={() => { d({ type: 'addBlock', doc: docId, kind: 'p', text: `${m.who}: ${m.text}` }); toast.show(`${docId}에 추가`) }}>문서에 추가</button>}
              </div>
            </Row>
          ))}
          {th.on === 'SPEC-7' && spec?.question && (
            <div className="question" style={{ margin: '8px 20px' }}>
              질문 · {spec.question}
              <button type="button" className="linkish" onClick={() => d({ type: 'answerQuestion', spec: 'SPEC-7', text: '재고가 없어진 상품은 남기되 품절로 표시해 주세요.' })}>시연: 고객지원이 답함</button>
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="sl-composer">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} rows={2} placeholder={`${th.kind === 'dept' ? '' : '#'}${channelName(th)}에 메시지 보내기`} aria-label="메시지" />
          <div className="sl-composer-bar">
            <span className="muted small">Enter 보내기 · Shift+Enter 줄바꿈{th.peer ? ` · ${DEPT_NAME[th.peer]} 창구로 전달` : ''}</span>
            <button type="button" className="send" disabled={!text.trim()} onClick={send} aria-label="보내기">↑</button>
          </div>
        </div>
      </section>

      <aside className="sl-info">
        <div className="sl-info-h">채널 정보</div>
        <p className="small" style={{ margin: 0 }}>{topic(th)}</p>
        {th.peer && <Chip>{DEPT_NAME[th.peer]} 창구 연결</Chip>}
        <div className="sl-info-h">문서에 옮길 곳</div>
        <Select value={docId} onChange={(e) => setDocId(e.target.value)} options={s.docs.slice().reverse().map((x) => ({ value: x.id, label: `${x.id} ${x.title}` }))} />
        <div className="sl-info-h">이 채널의 결정 {decisions.length}건</div>
        {decisions.length ? decisions.map((x) => <div key={x.id} className="small"><span className="mono">{x.id}</span> {x.text}</div>) : <span className="muted small">아직 없음</span>}
      </aside>
    </div>
  )
}

function Row({ m, cont, children }: { m: Message; cont: boolean; children: React.ReactNode }) {
  return (
    <div className={`sl-row${cont ? ' cont' : ''}`}>
      <div className={`sl-av${m.dept === 'planning' ? ' mine' : ''}`} aria-hidden>{cont ? '' : m.who.slice(0, 1)}</div>
      <div className="sl-body">
        {!cont && (
          <div className="sl-meta">
            <b>{m.who}</b> <span className="muted small">{DEPT_NAME[m.dept]}{m.t ? ` · ${m.t.slice(6)}` : ''}</span>
          </div>
        )}
        <div className="sl-text">{m.text} {m.decision && <Chip tone="green">결정 {m.decision}</Chip>}</div>
      </div>
      {children}
    </div>
  )
}
