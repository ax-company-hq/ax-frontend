// 정리 문서: 요청 하나에 흩어진 기획서·작업·PR·대화·결정·장애를 한 장으로 모으고, 사람이 고친다.
// 수정은 칸에서 벗어날 때(blur) 저장한다. 연동 버스에 붙어 있으면 다른 화면에도 바로 보인다.
import { useState, type Dispatch } from 'react'
import { Button, Card, Chip, PageHeader, Select, useToast } from '@dejafix/common-frontend'
import { type Action, type Doc, type DocBlock, type State } from './data'

export function Docs({ s, d }: { s: State; d: Dispatch<Action> }) {
  const toast = useToast()
  const [sel, setSel] = useState(s.docs[s.docs.length - 1]?.id ?? '')
  const [about, setAbout] = useState(s.requests[0]?.id ?? '')
  const doc = s.docs.find((x) => x.id === sel) ?? s.docs[s.docs.length - 1]
  const lastId = `DOC-${s.docs.length + 1}`

  return (
    <>
    <PageHeader title="정리" sub="작업 내용을 문서로 정리한다. AI 어시스턴트에게 'REQ-12 문서로 정리해줘'라고 하면 여기에 쌓이고, 사람이 바로 고친다." />
    <div className="three">
      <aside className="col-left">
        <div className="ph">문서 {s.docs.length}개</div>
        {s.docs.slice().reverse().map((x) => (
          <button key={x.id} type="button" className={`doc-li${x.id === doc?.id ? ' on' : ''}`} onClick={() => setSel(x.id)}>
            <span className="mono">{x.id}</span> {x.title} {x.by === 'ai' && <Chip tone="green">AI 정리</Chip>}
          </button>
        ))}
        <Button size="small" onClick={() => { d({ type: 'newDoc', title: '' }); setSel(lastId) }}>+ 새 문서</Button>
        <div className="ph" style={{ marginTop: 18 }}>관련 내용 모아 정리</div>
        <Select value={about} onChange={(e) => setAbout(e.target.value)} options={s.requests.map((r) => ({ value: r.id, label: `${r.id} ${r.title}` }))} />
        <Button size="small" variant="primary" icon="sparkle" onClick={() => { d({ type: 'gatherDoc', about }); setSel(lastId); toast.show(`${about}에 걸린 것을 모아 ${lastId}로 정리`) }}>모아서 문서 만들기</Button>
        <p className="muted small" style={{ margin: 0 }}>요청에 연결된 기획서 문단·작업·PR·대화·결정·장애를 모으고 남은 일을 할 일로 뽑는다.</p>
      </aside>

      <section className="col-doc">{doc ? <Editor key={doc.id} doc={doc} d={d} /> : <span className="muted">문서가 없습니다.</span>}</section>

      <aside className="col-right">
        {doc && <Related doc={doc} s={s} />}
      </aside>
    </div>
    </>
  )
}

function Editor({ doc, d }: { doc: Doc; d: Dispatch<Action> }) {
  const todos = doc.blocks.filter((b) => b.kind === 'todo')
  return (
    <>
      <input
        key={`title-${doc.title}`}
        className="doc-title-input"
        defaultValue={doc.title}
        placeholder="제목 없는 문서"
        aria-label="문서 제목"
        onBlur={(e) => e.target.value !== doc.title && d({ type: 'renameDoc', doc: doc.id, title: e.target.value })}
      />
      <p className="muted small" style={{ margin: 0 }}>
        <span className="mono">{doc.id}</span> · 마지막 수정 {doc.updated}
        {todos.length > 0 && <> · 할 일 {todos.filter((b) => b.done).length}/{todos.length}</>}
        {doc.about && <> · 요청 <span className="mono">{doc.about}</span></>}
        {doc.by === 'ai' && <> · AI 어시스턴트가 정리</>}
      </p>
      <div className="doc-blocks">
        {doc.blocks.map((b) => <Block key={`${b.id}-${b.text}-${b.done}`} b={b} doc={doc.id} d={d} />)}
      </div>
      <div className="actions">
        <Button size="small" onClick={() => d({ type: 'addBlock', doc: doc.id, kind: 'h2' })}>+ 소제목</Button>
        <Button size="small" onClick={() => d({ type: 'addBlock', doc: doc.id, kind: 'p' })}>+ 문단</Button>
        <Button size="small" onClick={() => d({ type: 'addBlock', doc: doc.id, kind: 'todo' })}>+ 할 일</Button>
      </div>
    </>
  )
}

function Block({ b, doc, d }: { b: DocBlock; doc: string; d: Dispatch<Action> }) {
  const save = (text: string) => text !== b.text && d({ type: 'editBlock', doc, block: b.id, text })
  const remove = <button type="button" className="blk-x" aria-label="블록 삭제" onClick={() => d({ type: 'removeBlock', doc, block: b.id })}>×</button>
  if (b.kind === 'h2') {
    return <div className="blk">{<input className="blk-h2" defaultValue={b.text} placeholder="소제목" onBlur={(e) => save(e.target.value)} />}{remove}</div>
  }
  if (b.kind === 'todo') {
    return (
      <div className="blk blk-todo">
        <input type="checkbox" checked={!!b.done} onChange={() => d({ type: 'toggleTodo', doc, block: b.id })} aria-label="완료" />
        <input className={`blk-line${b.done ? ' done' : ''}`} defaultValue={b.text} placeholder="할 일" onBlur={(e) => save(e.target.value)} />
        {remove}
      </div>
    )
  }
  if (b.kind === 'ref') {
    return <div className="blk blk-ref"><Chip>연결</Chip><span>{b.text}</span>{remove}</div>
  }
  return (
    <div className="blk">
      <textarea className="blk-p" defaultValue={b.text} placeholder="내용을 쓰세요" rows={Math.max(1, Math.ceil(b.text.length / 70))} onBlur={(e) => save(e.target.value)} />
      {remove}
    </div>
  )
}

function Related({ doc, s }: { doc: Doc; s: State }) {
  const r = doc.about ? s.requests.find((x) => x.id === doc.about) : undefined
  const spec = r?.spec ? s.specs.find((x) => x.id === r.spec) : undefined
  return (
    <>
      <div className="ph">이 문서에 연결된 것</div>
      <Card title="요청">{r ? <div className="msg"><span className="mono">{r.id}</span> {r.title} <Chip>{r.state}</Chip></div> : <span className="muted">직접 쓴 문서 (요청 연결 없음)</span>}</Card>
      <Card title="기획 문서">{spec ? <div className="msg"><a href="#/work/specs" className="mono">{spec.id}</a> {spec.title} <Chip>{spec.status}</Chip></div> : <span className="muted">없음</span>}</Card>
      <Card title="내보내기" sub="노션·슬랙은 가져오기/내보내기만 한다">
        <span className="muted small">notion_export_page · slack_post_message (실제 연결은 MCP 도구가 생긴 뒤)</span>
      </Card>
    </>
  )
}
