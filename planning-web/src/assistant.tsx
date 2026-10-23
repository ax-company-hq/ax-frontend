// 기획개발 AI 어시스턴트 대화 창. DejaFix frontend의 AssistantPanel·AssistantProvider·lib/chat 구조를 따른다.
// 이벤트 순서도 같다: meta → tool_call/tool_result → token… → final (오류는 error).
// 지금은 백엔드가 없어 화면의 목 데이터를 조회해 답하는 목 응답(mockStream)을 쓴다.
// 실제로는 POST /api/planning/chat (SSE)으로 바꾸고, 같은 ChatEvent를 onEvent로 넘기면 된다.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '@dejafix/common-frontend'
import { activeRules, ruleText, type Action, type State } from './data'
import { codeOf, traceOf, traceText } from './trace'

export type ChatEvent =
  | { event: 'meta'; data: { conversation_id: string } }
  | { event: 'tool_call'; data: { id: string; tool: string; args: Record<string, unknown> } }
  | { event: 'tool_result'; data: { id: string; ok: boolean; summary: string; duration_ms: number } }
  | { event: 'token'; data: { text: string } }
  | { event: 'final'; data: { content: string; unknowns: { label: string; reason: string }[] } }
  | { event: 'error'; data: { code: string; message: string } }

interface EvidenceCall { tool: string; command: string; result: string; ms: number }
interface ChatMessage { id: number; role: 'user' | 'ai'; text: string; evidence?: EvidenceCall[]; unknowns?: string[] }

const suggestions = ['REQ-12 작업 내용 문서로 정리해줘', 'PR #28 코드 왜 이렇게 했어?', '지금 자동 처리 범위 어디까지야?', '지금 처리해야 할 요청 뭐 있어?', 'SPEC-7 확정해도 돼?', '머지 기다리는 PR 있어?', '어제 결제 장애랑 관련된 PR은?']

// ---- 목 응답: 질문 키워드로 조회할 데이터를 고르고, 숫자는 코드로 센다 (LLM 없음)
// effect가 있으면 답을 마친 뒤 그 동작을 실행한다 (문서 정리 → 정리 탭에 쌓임)
interface Plan { tool: string; args: Record<string, unknown>; summary: string; answer: string; unknowns?: { label: string; reason: string }[]; effect?: Action }

function plan(q: string, s: State): Plan {
  const has = (...k: string[]) => k.some((w) => q.includes(w))
  if (has('문서로', '정리해', '문서 만들', '문서화')) {
    const reqId = q.match(/REQ-\d+/i)?.[0].toUpperCase()
    const specId = q.match(/SPEC-\d+/i)?.[0].toUpperCase()
    const r = s.requests.find((x) => x.id === reqId) ?? s.requests.find((x) => specId && x.spec === specId) ?? s.requests.find((x) => x.state === '기획 중' || x.state === '작업 중')
    if (!r) {
      return { tool: 'planning_gather_doc', args: { q }, summary: '정리할 요청 없음', answer: '어떤 요청을 정리할지 찾지 못했습니다. "REQ-12 문서로 정리해줘"처럼 요청 번호를 알려 주세요.', unknowns: [{ label: '정리 대상', reason: '질문에 요청·기획서 번호가 없음' }] }
    }
    const id = `DOC-${s.docs.length + 1}`
    return {
      tool: 'planning_gather_doc', args: { request_id: r.id },
      summary: `${r.id}에 걸린 기획서·작업·PR·대화·결정 수집`,
      answer: `${r.id} "${r.title}"의 작업 내용을 ${id}로 정리해 정리 탭에 올렸습니다. 요청, 기획서 문단, 작업·PR, 대화·결정, 장애 연결을 모았고 남은 일은 할 일로 뽑았습니다. 정리 탭에서 바로 고칠 수 있습니다.`,
      effect: { type: 'gatherDoc', about: r.id, by: 'ai' },
    }
  }
  if (has('왜 이렇게', '왜 이런', '왜 바꿨', '역추적', '출처')) {
    const prId = q.match(/PR\s*#?\s*(\d+)/i)?.[1]
    const pr = s.prs.find((p) => p.id === `PR #${prId}`) ?? s.prs.find((p) => q.includes(codeOf(s, p)[0].path)) ?? s.prs[s.prs.length - 1]
    if (!pr) return { tool: 'planning_trace_origin', args: { q }, summary: 'PR 없음', answer: '추적할 PR이 없습니다.', unknowns: [{ label: '추적 대상', reason: 'PR이 하나도 없음' }] }
    const steps = traceOf(s, pr.id)
    return {
      tool: 'planning_trace_origin', args: { pr: pr.id },
      summary: `${pr.id}에서 ${steps.length}단계 거슬러 올라감 (코드 → PR → 작업 → 문단 → 결정 → 요청 → 근거)`,
      answer: `${traceText(steps)} 작업·PR 탭 아래 "코드 역추적"에서 단계별로 볼 수 있습니다.`,
    }
  }
  if (has('자동 처리 범위', '자동 범위', '승급', '자동 머지 범위')) {
    const pol = s.autoPolicy
    const live = activeRules(pol)
    const waiting = s.reviews.filter((x) => !x.result)
    return {
      tool: 'planning_get_auto_policy', args: {},
      summary: `기준 ${live.length}개 사용 중, 교차검증 대기 ${waiting.length}건`,
      answer: `지금 쓰는 자동 처리 기준은 ${live.length ? live.map((r) => `${r.id}(${ruleText(r)}, ${r.status})`).join(', ') : '없음'}입니다. 이 안의 PR은 검수 통과 뒤 바로 자동 머지하고, 밖이면 AI 교차검증을 거칩니다. 지금 교차검증 대기는 ${waiting.length}건입니다. 교차검증 뒤 머지한 건은 관찰 기간 동안 장애·revert가 없을 때만 학습 근거가 되고, 같은 경로에서 근거가 모이면 기준을 제안해 안전 장치 안이면 재무 AI가, 밖이면 사람(태윤)이 승인합니다. 기준으로 머지한 PR이 장애에 연결되면 그 기준은 바로 꺼집니다.`,
    }
  }
  if (has('장애', '사건', '롤백', 'incident')) {
    const inc = s.incidents[0]
    return {
      tool: 'planning_list_incident_links', args: { ctx: inc.ctx },
      summary: `사건 ${s.incidents.length}건, 관련 PR 후보 ${inc.candidates.length}건`,
      answer: `${inc.ctx} ${inc.title}과 관련된 PR 후보는 ${inc.candidates.map((c) => `${c.pr} (${c.spec} ${c.para}, ${c.mergedAt} 머지)`).join(', ')}입니다. 롤백 교차검증은 ${inc.rollbackCheck?.result ?? '기록 없음'}이었고, 재발 방지 요청 ${inc.followUp ?? '없음'}이 요청함에 있습니다. 원인 판정은 인프라(DejaFix)가 하므로 저는 후보까지만 말씀드립니다.`,
      unknowns: [{ label: '확정 원인', reason: '원인 판정은 인프라 diagnose_incident 결과에 있음' }],
    }
  }
  if (has('PR', '머지', 'pr')) {
    const waiting = s.prs.filter((p) => !p.merged && p.reviews[p.reviews.length - 1] === '통과')
    const fixing = s.prs.filter((p) => !p.merged && p.reviews[p.reviews.length - 1] === '불일치')
    return {
      tool: 'planning_list_pull_requests', args: { merged: false },
      summary: `열린 PR ${s.prs.filter((p) => !p.merged).length}건`,
      answer: waiting.length || fixing.length
        ? `머지 대기 PR은 ${waiting.length}건${waiting.length ? `(${waiting.map((p) => p.id).join(', ')})` : ''}이고, 완료 기준 불일치로 수정 중인 PR은 ${fixing.length}건${fixing.length ? `(${fixing.map((p) => p.id).join(', ')})` : ''}입니다. 기준 안이면 자동 머지되고, 밖이면 AI 교차검증 대기열에 있습니다.`
        : '지금 열린 PR이 없습니다. SPEC-7이 확정되면 작업이 나뉘고 PR이 만들어집니다.',
    }
  }
  if (has('SPEC', '기획서', '확정', 'spec')) {
    const sp = s.specs.find((x) => x.id === 'SPEC-7')!
    const warn = sp.paras.filter((p) => p.warn)
    return {
      tool: 'planning_get_spec', args: { spec_id: sp.id },
      summary: `${sp.id} ${sp.status}, 요구사항 ${sp.paras.filter((p) => p.kind === 'req').length}개, 경고 ${warn.length}개`,
      answer: sp.status === '확정'
        ? `${sp.id}는 이미 확정됐습니다.`
        : `${sp.id}는 아직 초안입니다. 확정 전에 볼 것: ${sp.question ? `빈 항목 질문 1개("${sp.question}")가 남아 있고, ` : ''}${warn.map((p) => `${p.id}에 인사운영 ② 경고(${p.warn!.card}: ${p.warn!.text})`).join(', ')}가 붙어 있습니다. 답이 오면 경고 때문에 AI 교차검증을 거쳐 확정됩니다.`,
    }
  }
  if (has('요청', '처리', '할 일', '할일')) {
    const open = s.requests.filter((r) => r.state === '접수')
    return {
      tool: 'planning_list_requests', args: { state: '접수' },
      summary: `접수 상태 요청 ${open.length}건`,
      answer: open.length
        ? `아직 기획을 시작하지 않은 요청이 ${open.length}건 있습니다: ${open.map((r) => `${r.id} ${r.title} (${r.via})`).join(' / ')}. 인사·데이터에서 온 개선 초안은 요청함에서 채택할 수 있습니다.`
        : '접수 상태로 남은 요청이 없습니다.',
    }
  }
  if (has('기각', '경고')) {
    return {
      tool: 'planning_list_warnings', args: {}, summary: `기각 안 경고 ${s.warnings}건`,
      answer: `인사운영 ② check_plan으로 받은 기각 안 경고는 ${s.warnings}건입니다. SPEC-7 R2 "재시도 버튼만 추가"가 9/30 기각된 안(DC-31)이라 R1과 함께일 때만 진행하도록 문단에 붙어 있습니다. 판정 문장은 인사운영이 만든 것을 그대로 보여 드립니다.`,
    }
  }
  return {
    tool: 'planning_search', args: { q }, summary: '일치하는 데이터 없음',
    answer: '기획개발 데이터에서 이 질문에 답할 근거를 찾지 못했습니다. 요청·기획서·PR·장애 연결에 대해 물어봐 주세요.',
    unknowns: [{ label: '질문 대상', reason: '조회할 수 있는 데이터와 맞지 않음' }],
  }
}

function mockStream(question: string, s: State, onEvent: (e: ChatEvent) => void, act: (a: Action) => void): Promise<void> {
  const p = plan(question, s)
  if (p.effect) act(p.effect)
  const steps: ChatEvent[] = [
    { event: 'meta', data: { conversation_id: 'conv_mock' } },
    { event: 'tool_call', data: { id: 't1', tool: p.tool, args: p.args } },
    { event: 'tool_result', data: { id: 't1', ok: true, summary: p.summary, duration_ms: 42 } },
    ...p.answer.split(/(?<=[.,]) /).map((t) => ({ event: 'token' as const, data: { text: `${t} ` } })),
    { event: 'final', data: { content: p.answer, unknowns: p.unknowns ?? [] } },
  ]
  return new Promise((resolve) => {
    let i = 0
    const tick = () => {
      if (i >= steps.length) return resolve()
      onEvent(steps[i++])
      setTimeout(tick, i < 3 ? 260 : 90)
    }
    tick()
  })
}

// ---- 상태 (DejaFix AssistantProvider와 같은 처리)
export function useAssistantChat(s: State, dispatch: (a: Action) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)
  const seq = useRef(0)
  const stateRef = useRef(s)
  stateRef.current = s
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  const ask = useCallback((question: string) => {
    const text = question.trim()
    if (!text) return
    setMessages((m) => [...m, { id: ++seq.current, role: 'user', text }])
    setPending(true)
    const aiId = ++seq.current
    const calls = new Map<string, EvidenceCall>()
    const patch = (change: Partial<ChatMessage>) =>
      setMessages((m) => (m.some((x) => x.id === aiId) ? m.map((x) => (x.id === aiId ? { ...x, ...change } : x)) : [...m, { id: aiId, role: 'ai', text: '', ...change }]))
    let streamed = ''
    const onEvent = (e: ChatEvent) => {
      switch (e.event) {
        case 'tool_call':
          calls.set(e.data.id, { tool: e.data.tool, command: JSON.stringify(e.data.args), result: '조회 중…', ms: 0 })
          patch({ evidence: [...calls.values()] })
          break
        case 'tool_result': {
          const c = calls.get(e.data.id)!
          calls.set(e.data.id, { ...c, result: e.data.ok ? e.data.summary : `실패 · ${e.data.summary}`, ms: e.data.duration_ms })
          patch({ evidence: [...calls.values()] })
          break
        }
        case 'token':
          streamed += e.data.text
          patch({ text: streamed })
          break
        case 'final':
          patch({ text: e.data.content, unknowns: e.data.unknowns.map((u) => `${u.label} · ${u.reason}`), evidence: calls.size ? [...calls.values()] : undefined })
          break
        case 'error':
          patch({ text: `응답을 가져오지 못했습니다 (${e.data.code}). 잠시 후 다시 시도해 주세요.` })
          break
      }
    }
    mockStream(text, stateRef.current, onEvent, (a) => dispatchRef.current(a)).finally(() => setPending(false))
  }, [])

  const reset = useCallback(() => setMessages([]), [])
  return { messages, pending, ask, reset }
}

// ---- 패널 본문 (AppShell panel의 children·footer로 들어간다)
export function AssistantBody({ chat }: { chat: ReturnType<typeof useAssistantChat> }) {
  const { messages, pending, ask } = chat
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])
  return (
    <div className="chat">
      <div className="bubble ai">기획개발 데이터(요청·기획서·작업·PR·장애 연결)를 조회해서 답합니다. "REQ-12 문서로 정리해줘"처럼 말하면 정리 탭에 문서를 만들어 둡니다. 확인되지 않은 값은 추정하지 않고 '확인할 수 없음'으로 알려 드립니다.</div>
      {messages.length === 0 && (
        <div className="chips">
          {suggestions.map((s) => (
            <button key={s} type="button" className="q-chip" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}
      {messages.map((m) => (
        <div key={m.id} className={`msg-col ${m.role}`}>
          <div className={`bubble ${m.role}`}>{m.text}</div>
          {m.unknowns && m.unknowns.length > 0 && (
            <div className="chips" style={{ marginTop: 6 }}>
              {m.unknowns.map((u) => <span key={u} className="chip amber">확인할 수 없음 · {u}</span>)}
            </div>
          )}
          {m.evidence && (
            <div className="evidence">
              {m.evidence.map((c, i) => (
                <div key={i} className="evidence-row">
                  <span className="mono">{c.tool}</span> <span className="muted small mono">{c.command}</span>
                  <div className="small">{c.result}{c.ms ? ` · ${c.ms}ms` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {pending && (
        <div className="bubble ai"><span className="typing"><i /><i /><i /></span></div>
      )}
      <div ref={endRef} />
    </div>
  )
}

export function AssistantComposer({ chat, onClose }: { chat: ReturnType<typeof useAssistantChat>; onClose: () => void }) {
  const [text, setText] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || chat.pending) return
    chat.ask(text)
    setText('')
  }
  return (
    <form onSubmit={submit}>
      <div className="composer">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="질문을 입력하세요" aria-label="질문 입력" />
        <button className="send" type="submit" disabled={!text.trim() || chat.pending} aria-label="보내기"><Icon name="send" size={16} /></button>
      </div>
      <div className="assistant-note">
        Enter 보내기 · Esc 닫기 · <button type="button" className="linkish" onClick={chat.reset}>새 대화</button>
      </div>
    </form>
  )
}
