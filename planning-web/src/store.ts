// 두 화면(5173 기획개발, 5174 다른 부서)이 같은 상태를 보도록 연동 버스(목 서버)에 붙는다.
// 버스가 꺼져 있으면 이 화면 혼자 메모리에서 reducer를 돌린다.
import { useCallback, useEffect, useReducer, useState } from 'react'
import { canAdvance, initialState, reducer, type Action, type State } from './data'

const BUS = (import.meta.env.VITE_BUS_URL as string | undefined) ?? 'http://127.0.0.1:8790'

export function useSharedStore(): [State, (a: Action) => void, boolean] {
  const [local, localDispatch] = useReducer(reducer, initialState)
  const [remote, setRemote] = useState<State | null>(null)

  useEffect(() => {
    const es = new EventSource(`${BUS}/events`)
    es.addEventListener('state', (e) => setRemote(JSON.parse((e as MessageEvent).data) as State))
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setRemote(null)
    }
    return () => es.close()
  }, [])

  const connected = remote !== null
  // 버스 없이 혼자 돌 때도 버스와 같은 간격으로 한 단계씩 진행한다
  const [now, setNow] = useState(0) // 관찰 기간처럼 시간이 지나야 넘어가는 단계를 5초마다 다시 본다
  useEffect(() => {
    if (connected) return
    const i = setInterval(() => setNow((x) => x + 1), 5000)
    return () => clearInterval(i)
  }, [connected])
  useEffect(() => {
    if (connected || !canAdvance(local)) return
    const t = setTimeout(() => localDispatch({ type: 'advance' }), 1200)
    return () => clearTimeout(t)
  }, [connected, local, now])
  const dispatch = useCallback(
    (a: Action) => {
      if (!connected) return localDispatch(a)
      fetch(`${BUS}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }).catch(() => localDispatch(a))
    },
    [connected],
  )
  return [remote ?? local, dispatch, connected]
}
