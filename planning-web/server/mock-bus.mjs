// 연동 버스(목 서버). 기획개발 화면(5173)과 다른 부서 화면(5174)이 같은 상태를 보게 한다.
// 실제로는 Redis Streams 이벤트 버스 + 각 에이전트 A2A가 할 일을, 시연용으로 한 프로세스에서 흉내 낸다.
//   GET  /state   현재 상태(JSON)
//   POST /action  { type, ... } → src/data.ts의 reducer로 처리 후 모든 구독자에게 알림
//   GET  /events  SSE. 상태가 바뀔 때마다 `event: state`
//   POST /reset   처음 상태로
// 실행: node server/mock-bus.mjs  (Node 22.18+ / 24는 .ts 타입을 지우고 바로 읽는다)
import http from 'node:http'
import { canAdvance, initialState, reducer } from '../src/data.ts'

const PORT = Number(process.env.BUS_PORT ?? 8790)
let state = initialState
const clients = new Set()
// 에이전트가 한 단계씩 처리하는 걸 화면에서 볼 수 있게, 다음 단계를 STEP_MS 간격으로 진행한다
const STEP_MS = Number(process.env.BUS_STEP_MS ?? 1200)
let ticking = null
// PLANNING_API_URL(예: http://127.0.0.1:8101)을 주면 다른 부서가 보낸 데이터를 planning 백엔드(목 모드)에도 그대로 넘긴다.
// 화면은 여전히 이 버스를 보고, 백엔드는 같은 입력을 자기 규칙(#223 무클릭 진행)으로 처리한다. 실패해도 버스는 계속 돈다
const PLANNING_API = process.env.PLANNING_API_URL
const FORWARD = new Set(['inbound', 'answerQuestion'])
function forward(action) {
  if (!PLANNING_API || !FORWARD.has(action.type)) return
  const { agent: _agent, ...body } = action // 백엔드 입력에 없는 화면 전용 필드는 뺀다
  fetch(`${PLANNING_API}/api/planning/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => { if (!r.ok) console.warn(`planning 백엔드 ${action.type} ${r.status}`) })
    .catch((e) => console.warn(`planning 백엔드 연결 실패: ${e.message}`))
}
function tick() {
  if (ticking) return
  ticking = setTimeout(() => {
    ticking = null
    if (!canAdvance(state)) return
    state = reducer(state, { type: 'advance' })
    broadcast()
    tick()
  }, STEP_MS)
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function broadcast() {
  const frame = `event: state\ndata: ${JSON.stringify(state)}\n\n`
  for (const res of clients) res.write(frame)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
  if (req.method === 'GET' && req.url === '/state') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(state))
  }
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`)
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }
  if (req.method === 'POST' && req.url === '/action') {
    try {
      const action = await readJson(req)
      state = reducer(state, action)
      broadcast()
      tick()
      forward(action)
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ data: { seq: state.seq }, meta: {} }))
    } catch (e) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: { code: 'BAD_ACTION', message: String(e) } }))
    }
  }
  if (req.method === 'POST' && req.url === '/reset') {
    state = initialState
    broadcast()
    if (PLANNING_API) fetch(`${PLANNING_API}/api/planning/reset`, { method: 'POST' }).catch(() => {})
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ data: { reset: true }, meta: {} }))
  }
  res.writeHead(404, cors).end()
})

setInterval(tick, 5000) // 관찰 기간처럼 시간이 지나야 넘어가는 단계
server.listen(PORT, '127.0.0.1', () => console.log(`mock bus listening on http://127.0.0.1:${PORT}`))
