// 기획개발(planning) 화면의 목 데이터와 상태 변화.
// 실제로는 기획개발 에이전트의 /api/planning/... 응답이 들어올 자리다 (PLANNING_MOCK=1 과 같은 역할).
// 부서 간 연결 지점 이름은 공통 구성안(agent-common)과 10/22 부서별 수정 요청을 따른다.

export type Dept =
  | 'planning' | 'hr' | 'support' | 'marketing' | 'data' | 'finance'
  | 'infra' | 'orchestrator' | 'safety' | 'shop' | 'memory' | 'human'

export const DEPT_NAME: Record<Dept, string> = {
  planning: '기획개발', hr: '인사', support: '고객지원', marketing: '마케팅', data: '데이터분석',
  finance: '재무/정산', infra: '인프라(DejaFix)', orchestrator: '통합 에이전트', safety: '안전 레이어',
  shop: '판매 사이트', memory: '회사 기억', human: '사람',
}

export type ReqState = '접수' | '기획 중' | '작업 중' | '완료' | '중복 연결'
export interface Request {
  id: string
  ctx: string
  from: Dept
  via: string // 들어온 연결 지점
  title: string
  evidence: string
  state: ReqState
  spec?: string
  duplicateOf?: string
  auto?: AutoCheck // 간단 요청 판정 결과 (create_ticket으로 들어온 것만)
}

export interface Para {
  id: string // R1, C1 …
  kind: 'req' | 'done'
  text: string
  warn?: { card: string; text: string } // 인사운영 ② check_plan 결과
  incident?: string // 장애 표시 (link_incident)
}
export interface Spec {
  id: string
  title: string
  request: string
  status: '초안' | '확정'
  problem: string
  goal: string
  paras: Para[]
  question?: string
  basis: string[]
  humanSentences: number
  auto?: boolean // 간단 요청 규칙으로 사람 확정 없이 처리됨
}

export type TaskState = '진행 중' | 'PR 검수' | '머지 대기' | '완료' | 'C 보류'
export interface Task {
  id: string
  spec: string
  para: string
  title: string
  owner: string
  state: TaskState
}

export interface PR {
  id: string
  task: string
  title: string
  branch: string
  reviews: ('통과' | '불일치')[]
  gate: { result: '통과' | 'C 보류'; lines: number; files: number; paths: string }
  merged: boolean
  auto?: boolean // 간단 요청 규칙으로 자동 머지됨
}

export interface Message { who: string; dept: Dept; text: string; decision?: string; t?: string }
// 소통 채널. spec = 문서에 붙는 스레드, team = 기획개발팀 채널, dept = 다른 부서와 주고받는 채널
export interface Thread { id: string; on: string; title: string; messages: Message[]; kind?: 'spec' | 'team' | 'dept'; peer?: Dept }

// 정리 문서: 요청·기획서·작업·PR·대화·결정을 한 장으로 모으고 사람이 고친다
export interface DocBlock { id: string; kind: 'h2' | 'p' | 'todo' | 'ref'; text: string; done?: boolean }
export interface Doc { id: string; title: string; about?: string; updated: string; blocks: DocBlock[]; by?: 'ai' | 'human' }

export interface Decision { id: string; spec: string; text: string; reason: string; alternatives: string; from: string; sentToHr: boolean }

export interface Incident {
  ctx: string
  title: string
  at: string
  candidates: { pr: string; spec: string; para: string; mergedAt: string }[]
  rollbackCheck?: { target: string; result: '승인' | '거절'; why: string }
  linked: boolean
  followUp?: string
}

export interface Activity {
  seq?: number // 시뮬레이터로 들어온 건의 순번 (새로 받은 것 표시용)
  t: string // 시각 (KST 표시용)
  ctx: string
  from: Dept
  to: Dept
  point: string // 연결 지점
  kind: 'A2A' | '이벤트' | 'execute' | 'API' | '사람'
  grade?: 'A' | 'B' | 'C' | 'read'
  text: string
}

// 기획개발 → 다른 부서로 나간 메시지·데이터 (다른 부서 페이지의 "기획개발에서 받은 것")
export interface OutMsg {
  id: number
  t: string
  ctx: string
  to: Dept
  point: string
  text: string
  read: boolean
}

export interface State {
  seq: number // 들어오고 나간 연동 건마다 1씩 (새로 받은 것 표시용)
  outbox: OutMsg[]
  requests: Request[]
  specs: Spec[]
  tasks: Task[]
  prs: PR[]
  threads: Thread[]
  docs: Doc[]
  decisions: Decision[]
  incidents: Incident[]
  activity: Activity[]
  // 지표 계산용 원자료 (코드로 계산)
  draftsIn: number
  draftsAccepted: number
  warnings: number
  firstPrMinutes: number[]
  autoPolicy: AutoPolicy
}

// ---- 자동 처리 범위 학습: 간단 요청 자동 머지가 정상으로 쌓이면 범위를 넓히자고 제안하고(승인은 사람),
// 자동 머지한 PR이 장애에 연결되면 바로 한 단계 줄인다(줄이는 쪽은 승인 없이). 단계·기준값은 시연값이다.
export interface AutoLevel { level: number; name: string; lines: number; files: number }
export const AUTO_LEVELS: AutoLevel[] = [
  { level: 0, name: '자동 처리 중지', lines: 0, files: 0 },
  { level: 1, name: '문구·표시 소규모', lines: 30, files: 2 },
  { level: 2, name: '문구·표시 중규모', lines: 60, files: 3 },
  { level: 3, name: '화면 표시 전반', lines: 100, files: 5 },
]
export const PROMOTE_AFTER = 3 // 연속 정상 몇 건이면 승급 제안 (시연값)
export interface AutoRun { pr: string; req: string; t: string; lines: number; files: number; result: '정상' | '장애 연결' }
export interface AutoPolicy {
  level: number
  paths: string
  streak: number // 마지막 단계 변경 뒤 연속 정상 건수
  history: AutoRun[]
  proposal?: { to: number; t: string; why: string }
  log: { t: string; text: string; by: '사람' | '자동' }[]
}

export const initialState: State = {
  seq: 0,
  outbox: [],
  requests: [
    { id: 'REQ-9', ctx: 'ctx_req_0009', from: 'data', via: 'create_ticket', title: '느린 카드사에서 결제가 실패한다', evidence: '결제 실패 코드 집계 (데이터분석)', state: '완료', spec: 'SPEC-5' },
    { id: 'REQ-12', ctx: 'ctx_req_0012', from: 'support', via: 'create_ticket', title: '결제 실패 뒤 장바구니가 비워진다', evidence: '반복 문의 42건 (고객지원 문의 분류)', state: '기획 중', spec: 'SPEC-7' },
    { id: 'REQ-13', ctx: 'ctx_req_0013', from: 'hr', via: 'ticket_draft_propose (③)', title: '결제 실패 안내 문구 전체 정비', evidence: '같은 인수인계 질문 3주 연속 반복 (인사 결정 카드 card-0142)', state: '접수' },
    { id: 'REQ-14', ctx: 'ctx_req_0014', from: 'data', via: '개선 초안 (원인 추적 루프 ③)', title: '결제 실패율이 같은 구간에서 반복 상승', evidence: 'metric.anomaly 3회, 14:00~14:10 구간 (데이터분석)', state: '접수' },
    { id: 'REQ-101', ctx: 'ctx_inc_0001', from: 'infra', via: 'link_incident (재발 방지)', title: '결제 경로 설정 변경은 카나리 배포 필수', evidence: '사건 ctx_inc_0001, 롤백으로 복구 (DejaFix)', state: '접수' },
    { id: 'REQ-15', ctx: 'ctx_req_0015', from: 'marketing', via: 'create_ticket', title: '장바구니 보존 문구를 공지에도 반영', evidence: 'REQ-12와 같은 대상', state: '중복 연결', duplicateOf: 'REQ-12' },
  ],
  specs: [
    {
      id: 'SPEC-7', title: '결제 실패 후 장바구니 유지', request: 'REQ-12', status: '초안',
      problem: '결제가 실패하면 장바구니가 비워져 고객이 다시 담아야 한다 (관련 문의 42건)',
      goal: '결제 실패 뒤에도 장바구니를 유지해 관련 문의를 줄인다',
      paras: [
        { id: 'R1', kind: 'req', text: '결제 실패 시 장바구니 상태 보존 (품절 상품은 품절 표시)' },
        { id: 'R2', kind: 'req', text: '실패 안내 문구에 재시도 버튼', warn: { card: 'DC-31', text: '"재시도 버튼만 추가"는 9/30 기각된 안. R1과 함께일 때만 진행' } },
        { id: 'C1', kind: 'done', text: '결제 실패를 일으킨 뒤 장바구니가 그대로 남는다' },
        { id: 'C2', kind: 'done', text: '실패 안내의 재시도 버튼을 누르면 결제 화면으로 간다' },
      ],
      question: '재고가 없어진 상품도 장바구니에 남겨 둘까요?',
      basis: ['SPEC-3 장바구니 기획서', '결제 실패 문의 통계 (데이터분석)', 'DC-31 기각 결정 카드 (인사)'],
      humanSentences: 0,
    },
    {
      id: 'SPEC-5', title: '결제 타임아웃 설정 조정', request: 'REQ-9', status: '확정',
      problem: '결제 대기 시간이 짧아 느린 카드사에서 실패가 난다', goal: '결제 성공률 유지',
      paras: [
        { id: 'R3', kind: 'req', text: '결제 타임아웃 설정값 변경', incident: 'ctx_inc_0001' },
        { id: 'C5', kind: 'done', text: '느린 카드사 모의 응답에서도 결제가 완료된다' },
      ],
      basis: ['결제 실패 코드 집계 (데이터분석)'], humanSentences: 2,
    },
  ],
  tasks: [
    { id: 'T-9', spec: 'SPEC-5', para: 'R3', title: '결제 타임아웃 설정 변경', owner: '백엔드', state: '완료' },
  ],
  prs: [
    { id: 'PR #28', task: 'T-9', title: 'R3: 결제 타임아웃 설정 변경', branch: 'gen/t-9-payment-timeout', reviews: ['통과'], gate: { result: '통과', lines: 14, files: 1, paths: 'shop-api/payment/' }, merged: true },
  ],
  threads: [
    { id: 'TH-7', on: 'SPEC-7', title: 'SPEC-7 · 결제 실패 후 장바구니 유지', messages: [
      { who: '기획개발 에이전트', dept: 'planning', text: '빈 항목 질문: 재고가 없어진 상품도 장바구니에 남겨 둘까요?' },
    ] },
    { id: 'TH-5', on: 'SPEC-5', title: 'SPEC-5 · 결제 타임아웃 설정 조정', messages: [
      { who: '장재현 (데이터분석)', dept: 'data', text: '설정 변경 뒤 14:04부터 결제 실패율이 4배로 올랐습니다. 원인 판정은 인프라 쪽에서 해 주세요.' },
    ] },
    { id: 'CH-team', on: '', kind: 'team', title: '기획개발팀', messages: [
      { who: '기획개발 에이전트', dept: 'planning', t: '10-22 09:15', text: 'REQ-12 기획서 SPEC-7 초안을 올렸습니다. 확정 전에 R2 경고(DC-31)를 확인해 주세요.' },
      { who: '노예진', dept: 'planning', t: '10-22 09:18', text: '확인했어요. 품절 상품 처리 질문은 고객지원 답 받고 확정할게요.' },
    ] },
    { id: 'CH-support', on: '', kind: 'dept', peer: 'support', title: '고객지원', messages: [
      { who: '고객지원 에이전트', dept: 'support', t: '10-22 09:40', text: '"결제 실패 뒤 장바구니 비워짐" 문의가 오늘 6건 더 들어왔습니다 (누적 48건).' },
    ] },
    { id: 'CH-marketing', on: '', kind: 'dept', peer: 'marketing', title: '마케팅', messages: [] },
    { id: 'CH-hr', on: '', kind: 'dept', peer: 'hr', title: '인사', messages: [
      { who: '인사 에이전트', dept: 'hr', t: '10-22 09:13', text: '"재시도 버튼만 추가"는 9/30 기각된 안입니다 (DC-31). 장바구니 보존과 함께일 때만 진행을 권합니다.' },
    ] },
    { id: 'CH-data', on: '', kind: 'dept', peer: 'data', title: '데이터분석', messages: [] },
    { id: 'CH-infra', on: '', kind: 'dept', peer: 'infra', title: '인프라(DejaFix)', messages: [] },
  ],
  docs: [
    { id: 'DOC-1', title: '10/22 기획개발 정리', updated: '10-22 09:30', blocks: [
      { id: 'b1', kind: 'h2', text: '오늘 할 일' },
      { id: 'b2', kind: 'todo', text: 'SPEC-7 품절 상품 처리 질문 답 받기 (고객지원)', done: false },
      { id: 'b3', kind: 'todo', text: 'SPEC-7 확정 후 PR 생성', done: false },
      { id: 'b4', kind: 'todo', text: 'REQ-101 카나리 배포 규칙 검토', done: false },
      { id: 'b5', kind: 'h2', text: '메모' },
      { id: 'b6', kind: 'p', text: 'REQ-15(마케팅)는 REQ-12와 같은 요청이라 연결만 해 둠. 공지 문구는 REQ-12 완료 뒤 마케팅에 회신.' },
    ] },
  ],
  decisions: [
    { id: 'D-0', spec: 'SPEC-5', text: '결제 타임아웃은 카나리 배포 후 전체 적용', reason: '장애 재발 방지', alternatives: '바로 전체 적용', from: '사후관리', sentToHr: true },
  ],
  incidents: [
    {
      ctx: 'ctx_inc_0001', title: '결제 API 응답 지연 (p95 2,400ms)', at: '10-21 14:04',
      candidates: [{ pr: 'PR #28', spec: 'SPEC-5', para: 'R3', mergedAt: '10-21 14:02' }],
      rollbackCheck: { target: 'shop-api v2.4.1', result: '승인', why: '장애 2분 전 배포, 그 사이 PR #28 머지' },
      linked: true, followUp: 'REQ-101',
    },
  ],
  activity: [
    { t: '10-21 14:04', ctx: 'ctx_inc_0001', from: 'orchestrator', to: 'planning', point: 'incident.opened', kind: '이벤트', text: '결제 API 장애 사건 개시' },
    { t: '10-21 14:05', ctx: 'ctx_inc_0001', from: 'infra', to: 'planning', point: 'find_related_prs', kind: 'A2A', grade: 'read', text: '장애 직전 머지 PR 후보 1건 회신 (PR #28, SPEC-5 R3)' },
    { t: '10-21 14:06', ctx: 'ctx_inc_0001', from: 'data', to: 'planning', point: 'find_related_prs', kind: 'A2A', grade: 'read', text: '이상 구간 14:00~14:10 직전 배포 질의 → PR #28' },
    { t: '10-21 14:07', ctx: 'ctx_inc_0001', from: 'safety', to: 'planning', point: 'verify_rollback_target', kind: 'A2A', grade: 'read', text: 'rollback_deployment(B) 교차검증 → 승인' },
    { t: '10-21 14:09', ctx: 'ctx_inc_0001', from: 'planning', to: 'planning', point: 'link_incident', kind: 'A2A', grade: 'A', text: 'SPEC-5 R3에 장애 표시, 재발 방지 요청 REQ-101 등록' },
    { t: '10-21 14:10', ctx: 'ctx_inc_0001', from: 'infra', to: 'hr', point: 'record_case', kind: 'A2A', grade: 'A', text: 'kind rollback_executed (인프라 → 인사)' },
    { t: '10-22 09:12', ctx: 'ctx_req_0012', from: 'support', to: 'planning', point: 'create_ticket', kind: 'A2A', grade: 'A', text: '반복 문의 42건으로 변경 요청 REQ-12 등록' },
    { t: '10-22 09:13', ctx: 'ctx_req_0012', from: 'planning', to: 'hr', point: 'check_plan', kind: 'A2A', grade: 'read', text: '② "재시도 버튼만 추가" 기각 이력 질의 → warn (DC-31)' },
    { t: '10-22 09:14', ctx: 'ctx_req_0012', from: 'planning', to: 'planning', point: 'write_spec', kind: 'A2A', grade: 'A', text: 'SPEC-7 초안 작성, 경고를 R2에 첨부, 질문 1개' },
    { t: '10-22 09:20', ctx: 'ctx_req_0013', from: 'hr', to: 'planning', point: 'ticket_draft_propose', kind: 'A2A', grade: 'A', text: '③ 개선 초안 수신 → 요청함 REQ-13' },
    { t: '10-22 09:31', ctx: 'ctx_req_0014', from: 'data', to: 'planning', point: '개선 초안 (루프 ③)', kind: 'A2A', grade: 'A', text: '반복 지표 이상 초안 수신 → 요청함 REQ-14' },
    { t: '10-22 09:40', ctx: 'ctx_req_0015', from: 'marketing', to: 'planning', point: 'create_ticket', kind: 'A2A', grade: 'A', text: 'REQ-12와 같은 요청 → 새로 만들지 않고 연결' },
  ],
  draftsIn: 2,
  draftsAccepted: 0,
  warnings: 1,
  firstPrMinutes: [38],
  autoPolicy: { level: 1, paths: 'shop-web/', streak: 0, history: [], log: [{ t: '10-22 09:00', text: 'L1 문구·표시 소규모(30줄·2파일)로 시작', by: '사람' }] },
}

// ---- 상태 변화 (버튼 → 에이전트 skill → 다른 부서로 나가는 연결 지점)

let clock = 0
function now(): string {
  clock += 1
  const m = 41 + clock
  return `10-22 10:${String(m % 60).padStart(2, '0')}`
}

export type InboundKind =
  | 'support_ticket' | 'marketing_ticket' | 'hr_draft' | 'data_draft'
  | 'data_query' | 'infra_query' | 'orch_incident' | 'safety_verify'
  | 'support_simple' | 'marketing_simple'

export type Action =
  | { type: 'inbound'; kind: InboundKind }
  | { type: 'send'; to: Dept; point: string; text: string }
  | { type: 'markRead'; to: Dept }
  | { type: 'confirmSpec'; spec: string }
  | { type: 'answerQuestion'; spec: string; text: string }
  | { type: 'generatePrs'; spec: string }
  | { type: 'reviewPr'; pr: string }
  | { type: 'mergePr'; pr: string }
  | { type: 'acceptDraft'; request: string }
  | { type: 'writeSpec'; request: string }
  | { type: 'approvePromotion' }
  | { type: 'rejectPromotion' }
  // 소통
  | { type: 'postMessage'; thread: string; text: string }
  | { type: 'deptChat'; from: Dept }
  | { type: 'extractDecision'; thread: string; index: number }
  // 문서
  | { type: 'newDoc'; title: string }
  | { type: 'gatherDoc'; about: string; by?: 'ai' | 'human' }
  | { type: 'renameDoc'; doc: string; title: string }
  | { type: 'addBlock'; doc: string; kind: DocBlock['kind']; text?: string }
  | { type: 'editBlock'; doc: string; block: string; text: string }
  | { type: 'toggleTodo'; doc: string; block: string }
  | { type: 'removeBlock'; doc: string; block: string }

// 기획개발이 다른 부서로 보낸 활동은 모두 그 부서 창구(outbox)에도 쌓는다
export function reducer(s: State, a: Action): State {
  const next = inner(s, a)
  const added = next.activity.slice(s.activity.length).filter((x) => x.from === 'planning' && x.to !== 'planning')
  if (!added.length) return next
  let id = next.outbox.length
  return { ...next, outbox: [...next.outbox, ...added.map((x) => ({ id: ++id, t: x.t, ctx: x.ctx, to: x.to, point: x.point, text: x.text, read: false }))] }
}

const SAMPLE_TICKETS: Record<'support' | 'marketing', string[]> = {
  support: ['배송 조회 화면에서 송장 번호가 안 보인다', '쿠폰 적용 후 결제 금액이 두 번 계산된다', '결제 실패 뒤 장바구니가 비워진다'],
  marketing: ['기획전 배너가 모바일에서 잘린다', '신간 알림 신청 버튼 추가', '장바구니 보존 문구를 공지에도 반영'],
}
const SIMPLE_TICKETS: Record<'support' | 'marketing', string[]> = {
  support: ['상품 상세의 배송 안내 문구 오타 수정', '고객센터 운영 시간 안내 문구 변경', '마이페이지 메뉴 라벨 오타 수정'],
  marketing: ['신간 목록 정렬 라벨을 "최신순"으로 변경', '이벤트 페이지 링크가 지난 기획전으로 연결된다', '기획전 페이지 안내 문구 전체 교체'],
}

// ---- 간단 요청 판정: 전부 통과하면 사람 확정·사람 머지 없이 기획서 → 개발 → 머지까지 한 번에 간다.
// 하나라도 걸리면 평소 흐름(팀장 확정, 사람 머지). 실제로는 안전 레이어 코드 규칙(pr_changed_lines·files·allowed_paths)이 마지막에 다시 막는다.
export interface AutoCheck { ok: boolean; reasons: string[] }
const SENSITIVE = ['결제', '주문', '쿠폰', '환불', '정산', '장바구니', '재고', '개인정보', '로그인', '권한']
const DISPLAY_ONLY = ['문구', '오타', '라벨', '링크', '배너', '안 보인다', '잘린다', '정렬']
export const autoLimit = (p: AutoPolicy) => ({ ...AUTO_LEVELS[p.level], paths: p.paths })

function estimate(title: string): { lines: number; files: number } {
  if (title.includes('전체')) return { lines: 45, files: 3 }
  return /문구|오타|라벨/.test(title) ? { lines: 4, files: 1 } : { lines: 18, files: 2 }
}

export function checkSimple(title: string, policy: AutoPolicy = initialState.autoPolicy): AutoCheck {
  const AUTO_LIMIT = autoLimit(policy)
  if (policy.level === 0) return { ok: false, reasons: ['자동 처리 중지(L0): 자동 머지한 PR이 장애에 연결돼 범위가 줄어든 상태 → 사람 확정 필요'] }
  const hit = SENSITIVE.find((w) => title.includes(w))
  const display = DISPLAY_ONLY.some((w) => title.includes(w))
  const rejected = title.includes('버튼만') // 인사 ② check_plan 기각 이력 (목)
  const est = estimate(title)
  const small = est.lines <= AUTO_LIMIT.lines && est.files <= AUTO_LIMIT.files
  return {
    ok: !hit && display && !rejected && small,
    reasons: [
      hit ? `민감 경로 포함("${hit}") → 사람 확정 필요` : '결제·주문·개인정보 경로 아님',
      display ? '화면 표시만 바꾸는 요청' : '새 기능·동작 변경 → 사람 확정 필요',
      rejected ? '인사 ② 기각 이력 있음 → 사람 확정 필요' : '인사 ② 기각 이력 없음',
      small ? `예상 변경 ${est.lines}줄·${est.files}파일 (L${policy.level} 기준 ${AUTO_LIMIT.lines}줄·${AUTO_LIMIT.files}파일 이하)` : `예상 변경 ${est.lines}줄·${est.files}파일 → L${policy.level} 기준(${AUTO_LIMIT.lines}줄·${AUTO_LIMIT.files}파일) 초과`,
    ],
  }
}

// 요청에 기획서 초안을 붙인다 (write_spec). 채택할 때, 또는 기획 중인데 기획서가 없을 때
function draftSpecFor(s: State, r: Request, adopted: boolean): State {
  const n = Math.max(0, ...s.specs.map((x) => Number(x.id.replace('SPEC-', '')) || 0)) + 1
  const specId = `SPEC-${n}`
  const spec: Spec = {
    id: specId, title: r.title, request: r.id, status: '초안',
    problem: `${DEPT_NAME[r.from]}에서 받은 개선 초안: ${r.evidence}`, goal: `${r.title}`,
    paras: [
      { id: 'R1', kind: 'req', text: r.title },
      { id: 'C1', kind: 'done', text: '바뀐 뒤 같은 문의·이상 신호가 다시 생기지 않는다' },
    ],
    question: '바꿀 범위(화면 문구만 / 동작까지)를 어디까지로 할까요?',
    basis: [`${r.id} (${DEPT_NAME[r.from]})`, r.evidence], humanSentences: 0,
  }
  const t = now()
  return {
    ...s,
    draftsAccepted: s.draftsAccepted + (adopted ? 1 : 0),
    specs: [...s.specs, spec],
    requests: s.requests.map((x) => (x.id === r.id ? { ...x, state: '기획 중', spec: specId } : x)),
    threads: [...s.threads, { id: `TH-${n}`, on: specId, title: `${specId} · ${r.title}`, kind: 'spec', messages: [{ who: '기획개발 에이전트', dept: 'planning', t, text: `빈 항목 질문: ${spec.question}` }] }],
    activity: [
      ...s.activity,
      ...(adopted ? [{ t, ctx: r.ctx, from: 'planning' as const, to: 'planning' as const, point: 'review_ticket_draft', kind: 'A2A' as const, grade: 'A' as const, text: `${r.id} 채택` }] : []),
      { t, ctx: r.ctx, from: 'planning', to: 'planning', point: 'write_spec', kind: 'A2A', grade: 'A', text: `${specId} 초안 작성, 질문 1개` },
    ],
  }
}

// 간단 요청 한 번에 처리: write_spec → 자동 확정 → split_tasks → generate_pr(B) → review_pr → merge_pr(B) → 요청 부서 회신
function autoComplete(s: State, req: Request): State {
  const specId = `SPEC-${Math.max(0, ...s.specs.map((x) => Number(x.id.replace('SPEC-', '')) || 0)) + 1}`
  const taskId = `T-${s.tasks.length + 10}`
  const prId = `PR #${s.prs.length + 30}`
  const est = estimate(req.title)
  const AUTO_LIMIT = autoLimit(s.autoPolicy)
  const spec: Spec = {
    id: specId, title: req.title, request: req.id, status: '확정', auto: true,
    problem: `${DEPT_NAME[req.from]}에서 받은 요청: ${req.title}`, goal: '화면 표시를 요청대로 고친다 (동작 변경 없음)',
    paras: [
      { id: 'R1', kind: 'req', text: req.title },
      { id: 'C1', kind: 'done', text: '바뀐 화면에서 요청한 표시가 그대로 보인다' },
    ],
    basis: [`${req.id} (${DEPT_NAME[req.from]})`, '간단 요청 규칙 통과'], humanSentences: 0,
  }
  const pr: PR = { id: prId, task: taskId, title: `R1: ${req.title}`, branch: `gen/${taskId.toLowerCase()}`, reviews: ['통과'], gate: { result: '통과', lines: est.lines, files: est.files, paths: AUTO_LIMIT.paths }, merged: true, auto: true }
  const step = (x: Omit<Activity, 't' | 'ctx'>): Activity => ({ ...x, t: now(), ctx: req.ctx })
  // 자동 처리 이력을 쌓고, 연속 정상이 기준에 닿으면 승급을 제안한다 (실행은 사람 승인 뒤)
  const pol = s.autoPolicy
  const streak = pol.streak + 1
  const t = now()
  const propose = !pol.proposal && streak >= PROMOTE_AFTER && pol.level < AUTO_LEVELS.length - 1
  const nextLv = AUTO_LEVELS[Math.min(pol.level + 1, AUTO_LEVELS.length - 1)]
  const why = `L${pol.level}에서 연속 ${streak}건 정상 머지, 자동 머지 PR의 장애 연결 0건`
  const autoPolicy: AutoPolicy = {
    ...pol, streak,
    history: [...pol.history, { pr: prId, req: req.id, t, lines: est.lines, files: est.files, result: '정상' }],
    proposal: propose ? { to: pol.level + 1, t, why } : pol.proposal,
    log: propose ? [...pol.log, { t, text: `L${pol.level} → L${pol.level + 1} 승급 제안 (${why})`, by: '자동' }] : pol.log,
  }
  const proposeAct: Activity[] = propose
    ? [step({ from: 'planning', to: 'safety', point: 'auto_policy.propose', kind: 'execute', grade: 'C', text: `자동 처리 범위 L${pol.level} → L${pol.level + 1}(${nextLv.lines}줄·${nextLv.files}파일) 승급 제안 · ${why} → 팀장 승인 대기` })]
    : []
  return {
    ...s,
    autoPolicy,
    specs: [...s.specs, spec],
    tasks: [...s.tasks, { id: taskId, spec: specId, para: 'R1', title: req.title, owner: '에이전트', state: '완료' }],
    prs: [...s.prs, pr],
    requests: s.requests.map((r) => (r.id === req.id ? { ...r, spec: specId, state: '완료' } : r)),
    firstPrMinutes: [...s.firstPrMinutes, 3],
    activity: [
      ...s.activity,
      step({ from: 'planning', to: 'hr', point: 'check_plan', kind: 'A2A', grade: 'read', text: '② 기각 이력 질의 → 없음' }),
      step({ from: 'planning', to: 'planning', point: 'write_spec', kind: 'A2A', grade: 'A', text: `${specId} 작성 (요구사항 1, 완료 기준 1, 질문 0) → 간단 요청 규칙으로 자동 확정` }),
      step({ from: 'planning', to: 'planning', point: 'split_tasks', kind: 'A2A', grade: 'A', text: `R1 → 작업 ${taskId}` }),
      step({ from: 'planning', to: 'safety', point: 'execute(generate_pr)', kind: 'execute', grade: 'B', text: `${prId} 변경 ${est.lines}줄·${est.files}파일·${AUTO_LIMIT.paths} → 코드 규칙 통과` }),
      step({ from: 'planning', to: 'shop', point: 'github_create_pull', kind: 'API', text: `${prId} 생성 (${pr.branch}, 라벨 generated-pr·auto-simple)` }),
      step({ from: 'planning', to: 'planning', point: 'review_pr', kind: 'A2A', grade: 'A', text: `${prId} 검수 통과 (완료 기준 C1), CI 통과` }),
      step({ from: 'planning', to: 'safety', point: 'execute(merge_pr)', kind: 'execute', grade: 'B', text: `${prId} 간단 요청 규칙·검수·CI 통과 → 자동 머지 허용` }),
      step({ from: 'planning', to: 'shop', point: 'github_merge_pull', kind: 'API', text: `${prId} 자동 머지 → dev 배포` }),
      step({ from: 'planning', to: 'hr', point: 'record_case', kind: 'A2A', grade: 'A', text: `① spec_confirmed·pr_merged·request_closed · ${req.id} (자동 처리)` }),
      step({ from: 'planning', to: req.from, point: 'get_request_status', kind: 'A2A', grade: 'read', text: `${req.id} "${req.title}" 완료 · ${prId} 머지 (사람 승인 없이 자동 처리)` }),
      ...proposeAct,
    ],
  }
}

function inbound(s: State, kind: InboundKind): State {
  const seq = s.seq + 1
  const t = now()
  const ctxReq = `ctx_req_${String(20 + seq).padStart(4, '0')}`
  const act = (x: Omit<Activity, 't' | 'seq'>): Activity => ({ ...x, t, seq })
  const merged = s.prs.filter((p) => p.merged)
  const lastMerged = merged[merged.length - 1]
  const base = { ...s, seq }

  if (kind === 'support_ticket' || kind === 'marketing_ticket' || kind === 'support_simple' || kind === 'marketing_simple') {
    const from: Dept = kind.startsWith('support') ? 'support' : 'marketing'
    const pool = kind.endsWith('simple') ? SIMPLE_TICKETS[from] : SAMPLE_TICKETS[from]
    // 간단 요청은 아직 안 보낸 것부터 (연속 정상 이력을 쌓는 시연용), 일반 요청은 돌아가며 (중복 연결 시연용)
    const used = new Set(s.requests.map((r) => r.title))
    const title = kind.endsWith('simple') ? (pool.find((x) => !used.has(x)) ?? `${pool[seq % pool.length]} (${seq}차)`) : pool[seq % pool.length]
    const same = s.requests.find((r) => r.title === title)
    const dupId = same ? (same.duplicateOf ?? same.id) : undefined
    const id = `REQ-${20 + seq}`
    const auto = dupId ? undefined : checkSimple(title, s.autoPolicy)
    const req: Request = { id, ctx: ctxReq, from, via: 'create_ticket', title, evidence: `${DEPT_NAME[from]} 시뮬레이터에서 보냄`, state: dupId ? '중복 연결' : '접수', duplicateOf: dupId, auto }
    const created = act({ ctx: ctxReq, from, to: 'planning', point: 'create_ticket', kind: 'A2A', grade: 'A', text: dupId ? `"${title}" → 같은 요청 ${dupId}에 연결 (linked_duplicate)` : `변경 요청 ${id} 등록: ${title}` })
    const received: State = { ...base, requests: [...s.requests, req], activity: [...s.activity, created] }
    if (!auto) {
      return { ...received, activity: [...received.activity, act({ ctx: ctxReq, from: 'planning', to: from, point: 'get_request_status', kind: 'A2A', grade: 'read', text: `${id}는 ${dupId}에 연결됨` })] }
    }
    const judged: State = {
      ...received,
      activity: [...received.activity, { t, ctx: ctxReq, from: 'planning', to: 'planning', point: 'classify_request', kind: 'A2A', grade: 'read', text: auto.ok ? '간단 요청 판정 → 사람 승인 없이 끝까지 처리' : `사람 확정 필요 · ${auto.reasons.filter((r) => r.includes('필요') || r.includes('초과')).join(', ')}` }],
    }
    if (auto.ok) return autoComplete(judged, req)
    return { ...judged, activity: [...judged.activity, { t, ctx: ctxReq, from: 'planning', to: from, point: 'get_request_status', kind: 'A2A', grade: 'read', text: `${id} 접수됨 (팀장 확정 대기)` }] }
  }
  if (kind === 'hr_draft' || kind === 'data_draft') {
    const from: Dept = kind === 'hr_draft' ? 'hr' : 'data'
    const id = `REQ-${20 + seq}`
    const title = from === 'hr' ? '반복되는 인수인계 질문을 운영 매뉴얼에 반영' : '같은 시간대 결제 실패율 반복 상승 원인 개선'
    return {
      ...base,
      draftsIn: s.draftsIn + 1,
      requests: [...s.requests, { id, ctx: ctxReq, from, via: from === 'hr' ? 'ticket_draft_propose (③)' : '개선 초안 (원인 추적 루프 ③)', title, evidence: `${DEPT_NAME[from]} 시뮬레이터에서 보냄`, state: '접수' }],
      activity: [...s.activity, act({ ctx: ctxReq, from, to: 'planning', point: from === 'hr' ? 'ticket_draft_propose' : '개선 초안 (루프 ③)', kind: 'A2A', grade: 'A', text: `개선 초안 수신 → 요청함 ${id}` })],
    }
  }
  if (kind === 'data_query' || kind === 'infra_query') {
    const from: Dept = kind === 'data_query' ? 'data' : 'infra'
    const ctx = s.incidents[0]?.ctx ?? 'ctx_inc_0001'
    const found = lastMerged ? `${lastMerged.id} (${lastMerged.title})` : '후보 없음'
    return {
      ...base,
      activity: [
        ...s.activity,
        act({ ctx, from, to: 'planning', point: 'find_related_prs', kind: 'A2A', grade: 'read', text: from === 'data' ? '이상 구간 직전 배포가 있었나 질의' : '장애 시각 직전 머지 PR 질의' }),
        act({ ctx, from: 'planning', to: from, point: 'find_related_prs', kind: 'A2A', grade: 'read', text: `관련 PR 후보 회신: ${found} · 원인 판정은 하지 않음` }),
      ],
    }
  }
  if (kind === 'orch_incident') {
    const n = s.incidents.length + 1
    const ctx = `ctx_inc_${String(n).padStart(4, '0')}`
    const pr = lastMerged ?? s.prs[0]
    const task = s.tasks.find((x) => x.id === pr.task)
    const followId = `REQ-${100 + n}`
    // 자동 머지한 PR이 장애에 연결되면 자동 처리 범위를 바로 한 단계 줄인다 (줄이는 쪽은 승인 없이)
    const pol = s.autoPolicy
    const demote = Boolean(pr.auto) && pol.level > 0
    const autoPolicy: AutoPolicy = pr.auto
      ? {
          ...pol,
          level: demote ? pol.level - 1 : pol.level,
          streak: 0,
          proposal: undefined,
          history: pol.history.map((h) => (h.pr === pr.id ? { ...h, result: '장애 연결' } : h)),
          log: demote ? [...pol.log, { t, text: `${pr.id}(자동 머지)가 사건 ${ctx}에 연결 → L${pol.level} → L${pol.level - 1} 자동 축소`, by: '자동' }] : pol.log,
        }
      : pol
    const demoteAct: Activity[] = demote
      ? [act({ ctx, from: 'planning', to: 'safety', point: 'auto_policy.updated', kind: '이벤트', text: `자동 머지 ${pr.id}가 장애에 연결 → 자동 처리 범위 L${pol.level} → L${pol.level - 1} 축소 (줄이는 쪽은 승인 없이)` })]
      : []
    return {
      ...base,
      autoPolicy,
      incidents: [{ ctx, title: `결제 API 응답 지연 (시뮬레이터 ${n}회차)`, at: t, candidates: [{ pr: pr.id, spec: task?.spec ?? '-', para: task?.para ?? '-', mergedAt: t }], linked: true, followUp: followId }, ...s.incidents],
      specs: s.specs.map((sp) => (sp.id === task?.spec ? { ...sp, paras: sp.paras.map((p) => (p.id === task?.para ? { ...p, incident: ctx } : p)) } : sp)),
      requests: [...s.requests, { id: followId, ctx, from: 'infra', via: 'link_incident (재발 방지)', title: `${pr.id} 관련 재발 방지 검토`, evidence: `사건 ${ctx}`, state: '접수' }],
      activity: [
        ...s.activity,
        act({ ctx, from: 'orchestrator', to: 'planning', point: 'incident.opened', kind: '이벤트', text: `사건 ${ctx} 개시 (infra.anomaly_detected 감지)` }),
        act({ ctx, from: 'orchestrator', to: 'planning', point: 'link_incident', kind: 'A2A', grade: 'A', text: `사건을 ${pr.id}에 연결 요청` }),
        act({ ctx, from: 'planning', to: 'orchestrator', point: 'link_incident', kind: 'A2A', grade: 'A', text: `${task?.spec ?? '-'} ${task?.para ?? '-'}에 장애 표시, 재발 방지 요청 ${followId} 등록` }),
        ...demoteAct,
      ],
    }
  }
  // safety_verify: infra rollback_deployment(B)의 교차검증
  const ok = Boolean(lastMerged)
  const ctx = s.incidents[0]?.ctx ?? 'ctx_inc_0001'
  return {
    ...base,
    activity: [
      ...s.activity,
      act({ ctx, from: 'safety', to: 'planning', point: 'verify_rollback_target', kind: 'A2A', grade: 'read', text: 'infra rollback_deployment(B) 교차검증 요청' }),
      act({ ctx, from: 'planning', to: 'safety', point: 'verify_rollback_target', kind: 'A2A', grade: 'read', text: ok ? `승인 · 장애 직전 머지 ${lastMerged!.id} 확인 (deploy_before_incident)` : '거절 · 기간 안 배포 없음 (no_deploy_in_window) → completed + rejected_by_review' }),
    ],
  }
}

// ---- 소통·문서

const DEPT_CHAT: Partial<Record<Dept, string[]>> = {
  support: ['배송 조회 송장 번호 문의가 하루 10건 넘게 들어옵니다. 우선순위 올려 주실 수 있나요?', 'REQ-12 처리 상태 고객에게 안내해도 될까요?'],
  marketing: ['다음 주 기획전 배너 문구 확정본 공유드려요. 장바구니 보존 공지는 REQ-12 완료 뒤에 낼게요.', '신간 알림 버튼 기획 일정이 궁금합니다.'],
  hr: ['이번 주 인수인계 질문 중 "결제 실패 안내"가 3번 반복됐습니다. 운영 매뉴얼 반영 초안 보낼게요.', '결정 카드 DC-44에 SPEC-7 결정 이유를 붙였습니다.'],
  data: ['결제 실패율이 14:00~14:10에 또 올랐습니다. 직전 배포가 있었는지 확인 부탁드려요.', '장바구니 이탈률 지표 정의 공유드립니다 (코드로 계산).'],
  infra: ['shop-api v2.4.1 롤백 후 p95가 정상 범위로 돌아왔습니다.', '카나리 배포 설정 초안 준비됐습니다. REQ-101에 붙여 주세요.'],
}

function nextBlockId(doc: Doc): string {
  const max = doc.blocks.reduce((m, b) => Math.max(m, Number(b.id.slice(1)) || 0), 0)
  return `b${max + 1}`
}

function patchDoc(s: State, id: string, f: (d: Doc) => Doc): State {
  return { ...s, docs: s.docs.map((d) => (d.id === id ? { ...f(d), updated: now() } : d)) }
}

// 요청 하나에 걸린 것(기획서 문단·작업·PR·대화·결정·장애)을 모아 정리 문서 블록으로 만든다
export function gatherBlocks(s: State, about: string): DocBlock[] {
  const r = s.requests.find((x) => x.id === about)
  const out: Omit<DocBlock, 'id'>[] = []
  if (!r) return []
  out.push({ kind: 'h2', text: '요청' })
  out.push({ kind: 'ref', text: `${r.id} · ${DEPT_NAME[r.from]} · ${r.title} · 상태 ${r.state}` })
  out.push({ kind: 'p', text: `근거: ${r.evidence}${r.duplicateOf ? ` · ${r.duplicateOf}에 연결된 요청` : ''}` })
  const spec = s.specs.find((x) => x.id === (r.spec ?? s.requests.find((y) => y.id === r.duplicateOf)?.spec))
  const tasks = spec ? s.tasks.filter((t) => t.spec === spec.id) : []
  const prs = s.prs.filter((p) => tasks.some((t) => t.id === p.task))
  const thread = spec ? s.threads.find((t) => t.on === spec.id) : undefined
  const decisions = spec ? s.decisions.filter((x) => x.spec === spec.id) : []
  const incidents = spec ? s.incidents.filter((i) => i.candidates.some((c) => c.spec === spec.id)) : []
  if (spec) {
    out.push({ kind: 'h2', text: `기획 문서 ${spec.id} · ${spec.title} (${spec.status})` })
    out.push({ kind: 'p', text: `문제: ${spec.problem} / 목표: ${spec.goal}` })
    for (const p of spec.paras) out.push({ kind: 'ref', text: `${p.id} ${p.kind === 'req' ? '요구사항' : '완료 기준'} · ${p.text}${p.warn ? ` · 경고 ${p.warn.card}` : ''}${p.incident ? ` · 장애 ${p.incident}` : ''}` })
  }
  if (tasks.length) {
    out.push({ kind: 'h2', text: '작업·PR' })
    for (const t of tasks) out.push({ kind: 'ref', text: `${t.id} ${t.title} · ${t.state}` })
    for (const p of prs) out.push({ kind: 'ref', text: `${p.id} ${p.title} · 검수 ${p.reviews[p.reviews.length - 1]} · ${p.merged ? '머지됨' : '열림'}${p.auto ? ' (자동)' : ''}` })
  }
  if (thread?.messages.length || decisions.length) {
    out.push({ kind: 'h2', text: '대화·결정' })
    for (const m of thread?.messages ?? []) out.push({ kind: 'p', text: `${m.who}: ${m.text}` })
    for (const x of decisions) out.push({ kind: 'ref', text: `${x.id} 결정 · ${x.text} · 이유 ${x.reason} · 대안 ${x.alternatives}` })
  }
  if (incidents.length) {
    out.push({ kind: 'h2', text: '장애 연결' })
    for (const i of incidents) out.push({ kind: 'ref', text: `${i.ctx} ${i.title} · 관련 PR ${i.candidates.map((c) => c.pr).join(', ')}${i.followUp ? ` · 재발 방지 ${i.followUp}` : ''}` })
  }
  out.push({ kind: 'h2', text: '남은 일' })
  if (spec?.question) out.push({ kind: 'todo', text: `질문 답 받기: ${spec.question}`, done: false })
  if (spec?.status === '초안') out.push({ kind: 'todo', text: `${spec.id} 기획서 확정`, done: false })
  for (const p of prs.filter((x) => !x.merged)) out.push({ kind: 'todo', text: `${p.id} 검수·머지`, done: false })
  out.push({ kind: 'todo', text: `${DEPT_NAME[r.from]}에 결과 회신`, done: r.state === '완료' })
  return out.map((b, i) => ({ ...b, id: `b${i + 1}` }))
}

function talkAndDocs(s: State, a: Action): State | null {
  switch (a.type) {
    case 'postMessage': {
      const th = s.threads.find((t) => t.id === a.thread)
      if (!th || !a.text.trim()) return s
      const t = now()
      const ctx = th.on ? (s.requests.find((r) => r.spec === th.on)?.ctx ?? `thread:${th.id}`) : `thread:${th.id}`
      return {
        ...s,
        seq: th.peer ? s.seq + 1 : s.seq,
        threads: s.threads.map((x) => (x.id === th.id ? { ...x, messages: [...x.messages, { who: '노예진', dept: 'planning', text: a.text.trim(), t }] } : x)),
        activity: th.peer
          ? [...s.activity, { t, ctx, from: 'planning', to: th.peer, point: 'message', kind: 'A2A', text: a.text.trim() }]
          : s.activity,
      }
    }
    case 'deptChat': {
      const pool = DEPT_CHAT[a.from]
      const th = s.threads.find((t) => t.peer === a.from)
      if (!pool || !th) return s
      const seq = s.seq + 1
      const t = now()
      const text = pool[th.messages.filter((m) => m.dept === a.from).length % pool.length]
      return {
        ...s,
        seq,
        threads: s.threads.map((x) => (x.id === th.id ? { ...x, messages: [...x.messages, { who: `${DEPT_NAME[a.from]} 에이전트`, dept: a.from, text, t }] } : x)),
        activity: [...s.activity, { seq, t, ctx: `thread:${th.id}`, from: a.from, to: 'planning', point: 'message', kind: 'A2A', text }],
      }
    }
    case 'extractDecision': {
      const th = s.threads.find((t) => t.id === a.thread)
      const m = th?.messages[a.index]
      if (!th || !m || m.decision) return s
      const id = `D-${s.decisions.length}`
      return {
        ...s,
        threads: s.threads.map((x) => (x.id === th.id ? { ...x, messages: x.messages.map((y, i) => (i === a.index ? { ...y, decision: id } : y)) } : x)),
        decisions: [...s.decisions, { id, spec: th.on || '-', text: m.text, reason: `${m.who} 의견 (${th.title})`, alternatives: '-', from: `소통 ${th.title}`, sentToHr: true }],
        activity: [
          ...s.activity,
          { t: now(), ctx: `thread:${th.id}`, from: 'planning', to: 'planning', point: 'extract_decision', kind: 'A2A', grade: 'A', text: `${th.title} 메시지에서 결정 ${id} 추출` },
          { t: now(), ctx: `thread:${th.id}`, from: 'planning', to: 'hr', point: 'record_case', kind: 'A2A', grade: 'A', text: `① kind decision_extracted · ${id}` },
        ],
      }
    }
    case 'newDoc': {
      const id = `DOC-${s.docs.length + 1}`
      return { ...s, docs: [...s.docs, { id, title: a.title || '제목 없는 문서', updated: now(), blocks: [{ id: 'b1', kind: 'p', text: '' }] }] }
    }
    case 'gatherDoc': {
      const r = s.requests.find((x) => x.id === a.about)
      if (!r) return s
      const id = `DOC-${s.docs.length + 1}`
      const blocks = gatherBlocks(s, a.about)
      return {
        ...s,
        docs: [...s.docs, { id, title: `${r.id} 관련 정리 · ${r.title}`, about: r.id, updated: now(), blocks, by: a.by ?? 'human' }],
        activity: [...s.activity, { t: now(), ctx: r.ctx, from: a.by === 'ai' ? 'planning' : 'human', to: 'planning', point: 'gather_doc', kind: a.by === 'ai' ? 'A2A' : '사람', grade: 'read', text: `${a.by === 'ai' ? 'AI 어시스턴트 요청으로 ' : ''}${r.id}에 걸린 문서·작업·PR·대화·결정을 ${id}로 정리 (블록 ${blocks.length}개)` }],
      }
    }
    case 'renameDoc':
      return patchDoc(s, a.doc, (d) => ({ ...d, title: a.title }))
    case 'addBlock':
      return patchDoc(s, a.doc, (d) => ({ ...d, blocks: [...d.blocks, { id: nextBlockId(d), kind: a.kind, text: a.text ?? '', done: a.kind === 'todo' ? false : undefined }] }))
    case 'editBlock':
      return patchDoc(s, a.doc, (d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === a.block ? { ...b, text: a.text } : b)) }))
    case 'toggleTodo':
      return patchDoc(s, a.doc, (d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === a.block ? { ...b, done: !b.done } : b)) }))
    case 'removeBlock':
      return patchDoc(s, a.doc, (d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== a.block) }))
  }
  return null
}

function inner(s: State, a: Action): State {
  const talked = talkAndDocs(s, a)
  if (talked) return talked
  switch (a.type) {
    case 'inbound':
      return inbound(s, a.kind)
    case 'send':
      return { ...s, seq: s.seq + 1, activity: [...s.activity, { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: a.to, point: a.point, kind: 'A2A', text: a.text }] }
    case 'markRead':
      return { ...s, outbox: s.outbox.map((m) => (m.to === a.to ? { ...m, read: true } : m)) }
    case 'answerQuestion': {
      const spec = s.specs.find((x) => x.id === a.spec)
      if (!spec || !spec.question) return s
      const id = `D-${s.decisions.length}`
      const th = s.threads.map((t) =>
        t.on === a.spec ? { ...t, messages: [...t.messages, { who: '박지아 (고객지원)', dept: 'support' as Dept, text: a.text, decision: id }] } : t,
      )
      return {
        ...s,
        threads: th,
        specs: s.specs.map((x) => x.id === a.spec ? { ...x, question: undefined, paras: x.paras.map((p) => p.id === 'R1' ? { ...p, text: '결제 실패 시 장바구니 상태 보존 (품절 상품은 남기고 품절 표시)' } : p) } : x),
        decisions: [...s.decisions, { id, spec: a.spec, text: '품절 상품은 장바구니에 남기고 품절 표시', reason: '고객지원 의견: 다시 담는 불편이 더 큼', alternatives: '품절 상품 자동 삭제', from: '스레드 TH-7', sentToHr: true }],
        activity: [
          ...s.activity,
          { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'planning', point: 'extract_decision', kind: 'A2A', grade: 'A', text: `스레드에서 결정 ${id} 추출, R1 반영, 질문 닫음` },
          { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'hr', point: 'record_case', kind: 'A2A', grade: 'A', text: `① kind decision_extracted · ${id} (결정·이유·대안)` },
        ],
      }
    }
    case 'confirmSpec': {
      const spec = s.specs.find((x) => x.id === a.spec)
      if (!spec || spec.status === '확정') return s
      const reqs = spec.paras.filter((p) => p.kind === 'req')
      const base = s.tasks.length + 10
      const tasks: Task[] = reqs.map((p, i) => ({ id: `T-${base + i}`, spec: spec.id, para: p.id, title: p.text.split(' (')[0], owner: i === 0 ? '백엔드' : '프론트', state: '진행 중' }))
      return {
        ...s,
        specs: s.specs.map((x) => (x.id === a.spec ? { ...x, status: '확정' } : x)),
        tasks: [...s.tasks, ...tasks],
        requests: s.requests.map((r) => (r.spec === a.spec ? { ...r, state: '작업 중' } : r)),
        activity: [
          ...s.activity,
          { t: now(), ctx: 'ctx_req_0012', from: 'human', to: 'planning', point: '기획서 확정', kind: '사람', text: `팀장 노예진이 ${spec.id} 확정 (사람 클릭 1)` },
          { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'planning', point: 'split_tasks', kind: 'A2A', grade: 'A', text: `요구사항 ${reqs.length}개 → 작업 ${tasks.map((t) => t.id).join(', ')}` },
          { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'hr', point: 'record_case', kind: 'A2A', grade: 'A', text: `① kind spec_confirmed · ${spec.id}` },
          { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'support', point: 'get_request_status', kind: 'A2A', grade: 'read', text: 'REQ-12 상태 "작업 중"을 요청 부서가 조회' },
        ],
      }
    }
    case 'generatePrs': {
      const todo = s.tasks.filter((t) => t.spec === a.spec && t.state === '진행 중')
      if (!todo.length) return s
      const n = s.prs.length + 30
      const prs: PR[] = todo.map((t, i) => ({
        id: `PR #${n + i}`, task: t.id, title: `${t.para}: ${t.title}`, branch: `gen/${t.id.toLowerCase()}`,
        reviews: [i === 1 ? '불일치' : '통과'], gate: { result: '통과', lines: i === 0 ? 86 : 41, files: i === 0 ? 3 : 2, paths: i === 0 ? 'shop-api/cart/' : 'shop-web/checkout/' }, merged: false,
      }))
      return {
        ...s,
        tasks: s.tasks.map((t) => (todo.includes(t) ? { ...t, state: prs.find((p) => p.task === t.id)!.reviews[0] === '통과' ? '머지 대기' : 'PR 검수' } : t)),
        prs: [...s.prs, ...prs],
        firstPrMinutes: [...s.firstPrMinutes, 52],
        activity: [
          ...s.activity,
          ...prs.flatMap((p) => [
            { t: now(), ctx: 'ctx_req_0012', from: 'planning' as Dept, to: 'safety' as Dept, point: 'execute(generate_pr)', kind: 'execute' as const, grade: 'B' as const, text: `${p.id} 변경 ${p.gate.lines}줄·${p.gate.files}파일·${p.gate.paths} → 코드 규칙 통과` },
            { t: now(), ctx: 'ctx_req_0012', from: 'planning' as Dept, to: 'shop' as Dept, point: 'github_create_pull', kind: 'API' as const, text: `${p.id} 생성 (${p.branch}, 라벨 generated-pr, 자동 머지 제외)` },
            { t: now(), ctx: 'ctx_req_0012', from: 'planning' as Dept, to: 'planning' as Dept, point: 'review_pr', kind: 'A2A' as const, grade: 'A' as const, text: `${p.id} 검수 ${p.reviews[0]}${p.reviews[0] === '불일치' ? ' (완료 기준 C2)' : ''}` },
          ]),
        ],
      }
    }
    case 'reviewPr': {
      return {
        ...s,
        prs: s.prs.map((p) => (p.id === a.pr ? { ...p, reviews: [...p.reviews, '통과'] } : p)),
        tasks: s.tasks.map((t) => (s.prs.find((p) => p.id === a.pr)?.task === t.id ? { ...t, state: '머지 대기' } : t)),
        activity: [...s.activity, { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'planning', point: 'review_pr', kind: 'A2A', grade: 'A', text: `${a.pr} 수정 커밋 후 재검수 통과` }],
      }
    }
    case 'mergePr': {
      const pr = s.prs.find((p) => p.id === a.pr)
      if (!pr || pr.merged) return s
      const tasks = s.tasks.map((t) => (t.id === pr.task ? { ...t, state: '완료' as TaskState } : t))
      const spec = tasks.find((t) => t.id === pr.task)?.spec
      const allDone = tasks.filter((t) => t.spec === spec).every((t) => t.state === '완료')
      const act: Activity[] = [
        { t: now(), ctx: 'ctx_req_0012', from: 'human', to: 'planning', point: 'PR 머지', kind: '사람', text: `팀장 노예진이 ${pr.id} 머지 (사람 클릭)` },
        { t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'hr', point: 'record_case', kind: 'A2A', grade: 'A', text: `① kind pr_merged · ${pr.id}` },
      ]
      if (allDone) {
        act.push({ t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'hr', point: 'record_case', kind: 'A2A', grade: 'A', text: '① kind request_closed · REQ-12' })
        act.push({ t: now(), ctx: 'ctx_req_0012', from: 'planning', to: 'support', point: 'get_request_status', kind: 'A2A', grade: 'read', text: 'REQ-12 "완료"를 요청 부서에 회신' })
      }
      return {
        ...s,
        prs: s.prs.map((p) => (p.id === a.pr ? { ...p, merged: true } : p)),
        tasks,
        requests: allDone ? s.requests.map((r) => (r.spec === spec ? { ...r, state: '완료' } : r)) : s.requests,
        activity: [...s.activity, ...act],
      }
    }
    case 'acceptDraft': {
      const r = s.requests.find((x) => x.id === a.request)
      if (!r || r.state !== '접수') return s
      return draftSpecFor(s, r, true)
    }
    case 'writeSpec': {
      const r = s.requests.find((x) => x.id === a.request)
      if (!r || s.specs.some((x) => x.id === r.spec || x.request === r.id)) return s
      return draftSpecFor(s, r, false)
    }
    case 'approvePromotion': {
      const pol = s.autoPolicy
      if (!pol.proposal) return s
      const to = pol.proposal.to
      const lv = AUTO_LEVELS[to]
      const t = now()
      return {
        ...s,
        autoPolicy: { ...pol, level: to, streak: 0, proposal: undefined, log: [...pol.log, { t, text: `L${pol.level} → L${to} 승급 승인 (${lv.lines}줄·${lv.files}파일)`, by: '사람' }] },
        activity: [
          ...s.activity,
          { t, ctx: 'auto_policy', from: 'human', to: 'planning', point: '자동 범위 승급 승인', kind: '사람', text: `팀장 노예진이 L${pol.level} → L${to} 승인 (사람 클릭)` },
          { t, ctx: 'auto_policy', from: 'planning', to: 'safety', point: 'auto_policy.updated', kind: '이벤트', text: `간단 요청 기준 ${lv.lines}줄·${lv.files}파일·${pol.paths}로 갱신 요청 (기준표 pr_changed_lines·files)` },
        ],
      }
    }
    case 'rejectPromotion': {
      const pol = s.autoPolicy
      if (!pol.proposal) return s
      const t = now()
      return { ...s, autoPolicy: { ...pol, streak: 0, proposal: undefined, log: [...pol.log, { t, text: `L${pol.proposal.to} 승급 보류 (연속 건수 다시 셈)`, by: '사람' }] } }
    }
    default:
      return s
  }
}

// ---- 기획개발의 연결 지점 대장 (연동 화면). 공통 구성안 4·8·9장 + 수정 요청 기준
export interface Port {
  point: string
  dir: 'in' | 'out'
  peer: Dept
  kind: Activity['kind']
  grade: 'A' | 'B' | 'C' | 'read' | '-'
  priority: 'required' | 'recommended' | 'optional'
  what: string
}
export const PORTS: Port[] = [
  { point: 'find_related_prs', dir: 'in', peer: 'infra', kind: 'A2A', grade: 'read', priority: 'required', what: '장애 시각 직전 머지 PR·문단 후보 회신 (원인 판정 안 함)' },
  { point: 'find_related_prs', dir: 'in', peer: 'data', kind: 'A2A', grade: 'read', priority: 'required', what: '이상 구간 직전 배포가 있었나' },
  { point: 'link_incident', dir: 'in', peer: 'orchestrator', kind: 'A2A', grade: 'A', priority: 'required', what: '사건을 PR·문단에 연결, 재발 방지 요청 등록' },
  { point: 'verify_rollback_target', dir: 'in', peer: 'safety', kind: 'A2A', grade: 'read', priority: 'required', what: 'infra rollback_deployment(B) 교차검증 승인·거절' },
  { point: 'incident.opened / resolved', dir: 'in', peer: 'orchestrator', kind: '이벤트', grade: '-', priority: 'required', what: '사건 개시·종료 알림' },
  { point: 'create_ticket', dir: 'in', peer: 'support', kind: 'A2A', grade: 'A', priority: 'recommended', what: '변경 요청 등록, 같은 요청은 연결 (모든 부서가 호출 가능)' },
  { point: 'get_request_status', dir: 'in', peer: 'support', kind: 'A2A', grade: 'read', priority: 'recommended', what: '요청 부서가 처리 상태 조회' },
  { point: 'ticket_draft_propose → review_ticket_draft', dir: 'in', peer: 'hr', kind: 'A2A', grade: 'A', priority: 'optional', what: '③ 인사운영 개선 초안 수신, 채택 결정' },
  { point: '개선 초안 (원인 추적 루프 ③)', dir: 'in', peer: 'data', kind: 'A2A', grade: 'A', priority: 'optional', what: '반복 지표 이상 → 개선 요청 초안' },
  { point: 'list_in_progress', dir: 'in', peer: 'hr', kind: 'A2A', grade: 'read', priority: 'optional', what: '④ 담당자의 진행 중 문서·작업·PR 조회 (인수인계)' },
  { point: 'record_case', dir: 'out', peer: 'hr', kind: 'A2A', grade: 'A', priority: 'recommended', what: '① spec_confirmed · pr_merged · decision_extracted · request_closed' },
  { point: 'check_plan', dir: 'out', peer: 'hr', kind: 'A2A', grade: 'read', priority: 'recommended', what: '② 기획서 생성·보완 때 기각 안 질의' },
  { point: 'execute(generate_pr)', dir: 'out', peer: 'safety', kind: 'execute', grade: 'B', priority: 'recommended', what: '코드 규칙 검증 pr_changed_lines·files·allowed_paths, 초과면 C 보류' },
  { point: 'github_create_pull', dir: 'out', peer: 'shop', kind: 'API', grade: '-', priority: 'recommended', what: 'gen/ 브랜치 PR, 라벨 generated-pr. 사람 머지가 기본, 간단 요청 규칙 통과분만 자동 머지' },
  { point: 'execute(merge_pr)', dir: 'out', peer: 'safety', kind: 'execute', grade: 'B', priority: 'optional', what: '간단 요청 자동 머지 (검수·CI·간단 요청 규칙 통과 시)' },
  { point: 'memory_search_card', dir: 'out', peer: 'memory', kind: 'API', grade: 'read', priority: 'recommended', what: '기획서 근거 검색 (과거 기획서·결정·문의)' },
]
