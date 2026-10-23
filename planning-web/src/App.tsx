// 캣북스(catbooks) 업무 시스템 안의 기획개발팀 화면. 사이드바 = 프로젝트·요청·작업·정리·소통·규정·자료·지표, 각 메뉴의 하위 목록은 상단 가로탭.
// 라우팅은 해시(#/<메뉴>/<가로탭>)로 한다.
import { useEffect, useRef, useState } from 'react'
import { AppShell, Button, Chip, Notice, ToastOutlet, UserMenu, useToast, type LinkRenderer, type NavItem } from '@dejafix/common-frontend'
import { useSharedStore } from './store'
import { DeptSimulator } from './depts'
import { Dep, Point } from './parts'
import { AssistantBody, AssistantComposer, useAssistantChat } from './assistant'
import { Activity, Aftercare, Audit, Autonomy, Links, Metrics, Ops, REQUEST_VIEWS, Requests, Reviews, Specs, Work, type RequestView } from './pages'
import { Docs } from './docs'
import { Talk } from './talk'
import { COMPANY, findSiteIcon } from './company'
import { Projects } from './projects'
import { convoHref } from './links'
import { Knowledge } from './knowledge'

type IconName = NonNullable<NavItem['icon']>
interface Section { label: string; icon: IconName; tabs: { id: string; label: string }[] }
const SECTIONS = {
  projects: { label: '프로젝트', icon: 'menu', tabs: [] },
  requests: { label: '요청', icon: 'bell', tabs: [
    { id: 'incoming', label: '들어온 요청' },
    { id: 'progress', label: '진행 중인 요청' },
    { id: 'done', label: '해결된 요청' },
    { id: 'followup', label: '후속 요청' },
  ] },
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
  const read = () => location.hash.replace(/^#\/?/, '') || 'requests/incoming'
  const [r, setR] = useState(read)
  useEffect(() => {
    const on = () => setR(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

// 쇼핑몰은 다른 담당(재헌, ax-frontend shop-web)의 판매 사이트로 가는 바로가기라 새 탭으로 열고, 앞에 바로가기 아이콘을 둔다
const renderLink: LinkRenderer = ({ item, className, children }) => {
  if (item.href !== COMPANY.shopUrl) return <a href={item.href} className={className}>{children}</a>
  return (
    <a href={item.href} className={className} target="_blank" rel="noreferrer" title={`${COMPANY.name} 판매 사이트를 새 탭으로 열기`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
      {children}
    </a>
  )
}

// 사이드바 로고 = 고객사 판매 사이트 파비콘 (이 화면의 브라우저 탭 아이콘은 그대로 둔다)
function useSiteIcon(): string {
  const [src, setSrc] = useState('/logo-mark.svg')
  useEffect(() => {
    let alive = true
    findSiteIcon().then((icon) => { if (alive) setSrc(icon) })
    return () => { alive = false }
  }, [])
  return src
}

export function App() {
  const route = useRoute()
  const [state, dispatch, connected] = useSharedStore()
  const [panel, setPanel] = useState(false)
  const chat = useAssistantChat(state, dispatch)
  const toast = useToast()
  const logo = useSiteIcon()
  const [section, sub, ...rest] = route.split('/')
  const planning = isSection(section)
  const tabs: { id: string; label: string }[] = planning ? SECTIONS[section].tabs : []
  const tab = tabs.find((t) => t.id === sub)?.id ?? tabs[0]?.id
  // 가로탭이 있는 메뉴는 #/<메뉴>/<탭>/<항목>/<하위>, 없는 메뉴는 #/<메뉴>/<항목>/<하위>
  const [item, item2] = (tabs.length ? rest : [sub, ...rest]).map((x) => (x ? decodeURIComponent(x) : undefined))
  // 없는 화면 주소(예: 예전 '참여한 사건')는 들어온 요청으로 돌린다
  useEffect(() => {
    if (!planning && section !== 'depts') location.replace('#/requests/incoming')
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
  const incoming = state.requests.filter(REQUEST_VIEWS.incoming.match).length
  const unreadOut = state.outbox.filter((m) => !m.read).length
  const recentIn = inbound.filter((x) => x.point !== 'message').slice(-3).reverse()

  const badge: Partial<Record<SectionId, number>> = { requests: newWork || incoming, talk: newTalk }
  const nav: NavItem[] = [
    ...(Object.keys(SECTIONS) as SectionId[]).map((id) => ({
      href: `#/${id}${SECTIONS[id].tabs[0] ? `/${SECTIONS[id].tabs[0].id}` : ''}`,
      label: SECTIONS[id].label,
      icon: SECTIONS[id].icon,
      active: section === id,
      badge: badge[id] || undefined,
    })),
    { href: '#/depts', label: '다른 부서 (시뮬레이터)', icon: 'compare', active: section === 'depts', badge: unreadOut || undefined },
    { href: COMPANY.shopUrl, label: `${COMPANY.name} 바로가기` },
  ]

  return (
    <AppShell
      brand={{ name: `${COMPANY.name} 업무`, logoSrc: logo }}
      nav={nav}
      renderLink={renderLink}
      storageKey="planning-web.sidebar"
      topbar={
        <>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>기획개발팀</b> <span style={{ color: 'var(--text-3)' }}>{COMPANY.name} · {COMPANY.tagline}</span>
          </span>
          <Chip tone={connected ? 'green' : 'amber'} title={connected ? '시연용 목 데이터(PLANNING_MOCK=1). 연동 버스(127.0.0.1:8790)에 연결되어 기획개발(3002)과 다른 부서(3003) 화면이 같은 데이터를 봅니다.' : '시연용 목 데이터(PLANNING_MOCK=1). 연동 버스에 연결되지 않아 이 화면 혼자 동작합니다.'}>
            {connected ? '시연 데이터 · 연동 중' : '시연 데이터 · 단독'}
          </Chip>
          <ToastOutlet />
          <UserMenu name="노예진" role="기획개발팀 팀장" items={[{ label: '로그아웃', onSelect: () => toast.show('시연 화면이라 로그아웃은 하지 않습니다') }]} />
          <Button variant="dark" icon="sparkle" onClick={() => setPanel((v) => !v)}>
            AI 어시스턴트
          </Button>
        </>
      }
      panel={{
        open: panel,
        title: 'AI 어시스턴트',
        sub: '조회 + 문서 정리 · 확정·머지는 조건·교차검증으로 자동, 되돌릴 수 없는 일만 사람 (시연용 목 응답)',
        onClose: () => setPanel(false),
        children: <AssistantBody chat={chat} />,
        footer: <AssistantComposer chat={chat} onClose={() => setPanel(false)} />,
      }}
    >
      {section === 'depts' ? (
        <DeptSimulator s={state} d={dispatch} />
      ) : planning ? (
        <main className="page page-wide">
          {tabs.length > 0 && (
            <div className="subtabs" role="tablist" aria-label={`${SECTIONS[section].label} 메뉴`}>
              {tabs.map((t) => {
                const n = section === 'requests' ? state.requests.filter(REQUEST_VIEWS[t.id as RequestView].match).length : section === 'work' && t.id === 'reviews' ? state.reviews.filter((x) => !x.result).length : 0
                return (
                  <a key={t.id} href={`#/${section}/${t.id}`} className={t.id === tab ? 'on' : ''} role="tab" aria-selected={t.id === tab}>
                    {t.label}
                    {n > 0 && <span className={t.id === 'incoming' ? 'subtab-badge' : 'subtab-count'}>{n}</span>}
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
          {section === 'requests' && <Requests key={tab} s={state} d={dispatch} view={tab as RequestView} item={item} />}
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
    </AppShell>
  )
}
