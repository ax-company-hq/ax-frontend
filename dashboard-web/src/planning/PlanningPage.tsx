// 기획개발팀 화면. 업무 시스템(dashboard-web)의 /planning 탭 안에서 돈다.
// 메뉴 = 프로젝트·요청·작업·정리·소통·규정·자료·지표, 각 메뉴의 하위 목록은 그 아래 가로탭. 화면 안 이동은 해시(#/<메뉴>/<가로탭>)로 한다.
// 공통 화면 컴포넌트(@dejafix/common-frontend)의 스타일은 .planning-scope 안에만 적용된다 (postcss.config.js).
import '@dejafix/common-frontend/styles.css'
import './planning.css'
import { useEffect, useRef, useState } from 'react'
import { Button, Chip, ToastOutlet, ToastProvider, type NavItem } from '@dejafix/common-frontend'
import { useSharedStore } from './store'
import { DeptSimulator } from './depts'
import { Dep, Point } from './parts'
import { AssistantBody, AssistantComposer, useAssistantChat } from './assistant'
import { Activity, Aftercare, Audit, Autonomy, Links, Metrics, Ops, Reviews, Specs, Work } from './pages'
import { Requests, incomingCount } from './requests'
import { Docs } from './docs'
import { Talk } from './talk'
import { Projects } from './projects'
import { convoHref } from './links'
import { Knowledge } from './knowledge'

type IconName = NonNullable<NavItem['icon']>
interface Section { label: string; icon: IconName; tabs: { id: string; label: string }[] }
const SECTIONS = {
  projects: { label: '프로젝트', icon: 'menu', tabs: [] },
  requests: { label: '요청', icon: 'bell', tabs: [] }, // 들어온·진행 중·해결·후속은 화면 안 필터 (#/requests/<필터>)
  work: { label: '작업', icon: 'plan', tabs: [
    { id: 'specs', label: '기획·기획서' },
    { id: 'prs', label: '작업·PR' },
    { id: 'reviews', label: 'AI 교차검증' },
    { id: 'ops', label: '운영·배포' },
    { id: 'aftercare', label: '사후관리' },
  ] },
  docs: { label: '정리', icon: 'report', tabs: [] },
  talk: { label: '소통', icon: 'send', tabs: [] },
  knowledge: { label: '규정·자료', icon: 'admin', tabs: [] },
  metrics: { label: '지표', icon: 'dashboard', tabs: [
    { id: 'overview', label: '지표' },
    { id: 'autonomy', label: '자동 처리 범위' },
    { id: 'audit', label: 'AI 승인 감사' },
    { id: 'activity', label: '에이전트 활동' },
    { id: 'links', label: '부서 연동' },
  ] },
} satisfies Record<string, Section>
type SectionId = keyof typeof SECTIONS
const isSection = (x: string): x is SectionId => x in SECTIONS

function useRoute(): string {
  const read = () => location.hash.replace(/^#\/?/, '') || 'requests'
  const [r, setR] = useState(read)
  useEffect(() => {
    const on = () => setR(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

// 업무 시스템의 밝은·어두운 테마(<html class="dark">)를 공통 컴포넌트 테마(data-theme)로 옮긴다
function useDark(): boolean {
  const read = () => document.documentElement.classList.contains('dark')
  const [dark, setDark] = useState(read)
  useEffect(() => {
    const ob = new MutationObserver(() => setDark(read()))
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => ob.disconnect()
  }, [])
  return dark
}

export default function PlanningPage() {
  const dark = useDark()
  return (
    <div className="planning-scope" data-theme={dark ? 'dark' : 'light'}>
      <ToastProvider>
        <Planning />
      </ToastProvider>
    </div>
  )
}

function Planning() {
  const route = useRoute()
  const [state, dispatch, connected] = useSharedStore()
  const [panel, setPanel] = useState(false)
  const chat = useAssistantChat(state, dispatch)
  const [section, sub, ...rest] = route.split('/')
  const planning = isSection(section)
  const tabs: { id: string; label: string }[] = planning ? SECTIONS[section].tabs : []
  const tab = tabs.find((t) => t.id === sub)?.id ?? tabs[0]?.id
  // 가로탭이 있는 메뉴는 #/<메뉴>/<탭>/<항목>/<하위>, 없는 메뉴는 #/<메뉴>/<항목>/<하위>
  const [item, item2] = (tabs.length ? rest : [sub, ...rest]).map((x) => (x ? decodeURIComponent(x) : undefined))
  // 없는 화면 주소(예: 예전 '참여한 사건')는 들어온 요청으로 돌린다
  useEffect(() => {
    if (!planning && section !== 'depts') location.replace('#/requests')
  }, [planning, section])

  // 다른 부서에서 들어온 것: 기획개발 화면(요청·작업)을 볼 때까지 "새로"로 센다
  const inbound = state.activity.filter((x) => x.seq && x.to === 'planning')
  const [seenSeq, setSeenSeq] = useState(0)
  const [talkSeen, setTalkSeen] = useState(0)
  const highlightFrom = useRef(0)
  useEffect(() => {
    if (section === 'requests' || section === 'work') {
      highlightFrom.current = seenSeq
      setSeenSeq(state.seq)
    }
    if (section === 'talk') setTalkSeen(state.seq)
  }, [section, state.seq]) // eslint-disable-line react-hooks/exhaustive-deps
  const newWork = inbound.filter((x) => x.point !== 'message' && (x.seq ?? 0) > seenSeq).length
  const newTalk = inbound.filter((x) => x.point === 'message' && (x.seq ?? 0) > talkSeen).length
  const incoming = incomingCount(state)
  const unreadOut = state.outbox.filter((m) => !m.read).length
  const recentIn = inbound.filter((x) => x.point !== 'message').slice(-3).reverse()

  const badge: Partial<Record<SectionId, number>> = { requests: newWork || incoming, talk: newTalk }
  const menu = [
    ...(Object.keys(SECTIONS) as SectionId[]).map((id) => ({
      href: `#/${id}${SECTIONS[id].tabs[0] ? `/${SECTIONS[id].tabs[0].id}` : ''}`,
      label: SECTIONS[id].label,
      on: section === id,
      badge: badge[id] || 0,
    })),
    { href: '#/depts', label: '다른 부서 (시뮬레이터)', on: section === 'depts', badge: unreadOut },
  ]

  return (
    <div className={`main ${panel ? 'panel-open' : ''}`}>
      <div className="pl-bar">
        <nav className="pl-menu" aria-label="기획개발 메뉴">
          {menu.map((m) => (
            <a key={m.href} href={m.href} className={m.on ? 'on' : ''} aria-current={m.on ? 'page' : undefined}>
              {m.label}
              {m.badge > 0 && <span className="nav-badge">{m.badge}</span>}
            </a>
          ))}
        </nav>
        <div className="pl-tools">
          <Chip tone={connected ? 'green' : 'amber'} title={connected ? '시연용 목 데이터(PLANNING_MOCK=1). 연동 버스(127.0.0.1:8790)에 연결되어 기획개발 화면과 다른 부서 시뮬레이터가 같은 데이터를 봅니다.' : '시연용 목 데이터(PLANNING_MOCK=1). 연동 버스에 연결되지 않아 이 화면 혼자 동작합니다.'}>
            {connected ? '시연 데이터 · 연동 중' : '시연 데이터 · 단독'}
          </Chip>
          <ToastOutlet />
          <Button variant="dark" icon="sparkle" onClick={() => setPanel((v) => !v)}>
            AI 어시스턴트
          </Button>
        </div>
      </div>

      {section === 'depts' ? (
        <DeptSimulator s={state} d={dispatch} />
      ) : planning ? (
        <main className="page page-wide">
          {tabs.length > 0 && (
            <div className="subtabs" role="tablist" aria-label={`${SECTIONS[section].label} 메뉴`}>
              {tabs.map((t) => {
                const n = section === 'work' && t.id === 'reviews' ? state.reviews.filter((x) => !x.result).length : 0
                return (
                  <a key={t.id} href={`#/${section}/${t.id}`} className={t.id === tab ? 'on' : ''} role="tab" aria-selected={t.id === tab}>
                    {t.label}
                    {n > 0 && <span className="subtab-count">{n}</span>}
                  </a>
                )
              })}
            </div>
          )}
          {(section === 'requests' || section === 'work') && recentIn.length > 0 && (
            <div className="live-strip" aria-live="polite">
              <span className="live-strip-h">새로 받은 연동</span>
              {recentIn.map((x, i) => (
                <a key={i} href={convoHref(x.ctx)} className={`live-item${(x.seq ?? 0) > highlightFrom.current ? ' fresh' : ''}`}>
                  <Dep d={x.from} /> <Point>{x.point}</Point> <span className="muted small">{x.text}</span>
                </a>
              ))}
            </div>
          )}
          {section === 'requests' && <Requests s={state} d={dispatch} filter={sub} item={rest[0] ? decodeURIComponent(rest[0]) : undefined} />}
          {section === 'work' && tab === 'specs' && <Specs s={state} d={dispatch} item={item} item2={item2} />}
          {section === 'work' && tab === 'prs' && <Work s={state} d={dispatch} item={item} />}
          {section === 'work' && tab === 'reviews' && <Reviews s={state} d={dispatch} item={item} />}
          {section === 'work' && tab === 'ops' && <Ops s={state} item={item} />}
          {section === 'work' && tab === 'aftercare' && <Aftercare s={state} item={item} />}
          {section === 'docs' && <Docs s={state} d={dispatch} item={item} />}
          {section === 'talk' && <Talk s={state} d={dispatch} item={item} />}
          {section === 'knowledge' && <Knowledge />}
          {section === 'projects' && <Projects s={state} d={dispatch} sel={item} />}
          {section === 'metrics' && tab === 'overview' && <Metrics s={state} />}
          {section === 'metrics' && tab === 'autonomy' && <Autonomy s={state} d={dispatch} item={item} />}
          {section === 'metrics' && tab === 'audit' && <Audit s={state} d={dispatch} />}
          {section === 'metrics' && tab === 'activity' && <Activity s={state} item={item} />}
          {section === 'metrics' && tab === 'links' && <Links s={state} d={dispatch} />}
        </main>
      ) : null}

      <aside className={`assistant ${panel ? 'open' : ''}`} aria-label="AI 어시스턴트" aria-hidden={!panel}>
        <div className="assistant-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="assistant-title">AI 어시스턴트</div>
            <div className="assistant-sub">조회 + 문서 정리 · 확정·머지는 조건·교차검증으로 자동, 되돌릴 수 없는 일만 사람 (시연용 목 응답)</div>
          </div>
          <button type="button" className="btn small" onClick={() => setPanel(false)} aria-label="닫기">닫기</button>
        </div>
        <div className="assistant-body"><AssistantBody chat={chat} /></div>
        <div className="assistant-foot"><AssistantComposer chat={chat} onClose={() => setPanel(false)} /></div>
      </aside>
    </div>
  )
}
