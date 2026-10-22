// 두 화면(3002 기획개발, 3003 다른 부서)이 같은 상태를 보도록 연동 버스(목 서버)에 붙는다.
// 버스가 꺼져 있으면 이 화면 혼자 메모리에서 reducer를 돌린다.
import { useCallback, useEffect, useReducer, useState } from 'react'
import { initialState, reducer, type Action, type State } from './data'

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
  const dispatch = useCallback(
    (a: Action) => {
      if (!connected) return localDispatch(a)
      fetch(`${BUS}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }).catch(() => localDispatch(a))
    },
    [connected],
  )
  return [remote ?? local, dispatch, connected]
}
