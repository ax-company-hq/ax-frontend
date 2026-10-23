import type { DemoOptions, Incident, Registry } from './types'

// 개발 서버(vite)가 /orch를 총괄로 넘겨 준다 (vite.config.ts). 총괄에는 CORS가 없다.
const BASE = '/orch'

export class OrchestratorUnreachable extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, init)
  } catch {
    throw new OrchestratorUnreachable('총괄에 연결할 수 없음')
  }
  const body = (await response.json().catch(() => null)) as { data?: T } | null
  if (!response.ok || !body || body.data === undefined) {
    // 프록시 대상이 안 떠 있으면 개발 서버가 JSON 없이 5xx를 돌려준다
    if (response.status >= 500 && !body) throw new OrchestratorUnreachable('총괄에 연결할 수 없음')
    // 다른 서비스가 그 포트를 쓰고 있는 경우 (예: 오류 JSON에 data가 없음)
    throw new OrchestratorUnreachable(`총괄이 아닌 서버가 응답함 (HTTP ${response.status})`)
  }
  return body.data
}

export const listIncidents = () => request<Incident[]>('/api/incidents')
export const getRegistry = () => request<Registry>('/api/registry')

export const injectIncident = (options: DemoOptions) =>
  request<{ context_id: string }>('/api/demo/incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })

/** 사람 승인·거절 (대시보드 승인 대기열 동작을 흉내 낸 것. 총괄이 승인하는 게 아니다) */
export const decideHold = (contextId: string, stepId: string, approved: boolean) =>
  request<{ ok: boolean }>(`/api/incidents/${contextId}/holds/${stepId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  })
