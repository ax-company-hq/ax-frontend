import type { DemoOptions, Department, Incident } from './types'

// 개발 서버(vite)가 /orch를 총괄로 넘겨 준다 (vite.config.ts). 총괄에는 CORS가 없다.
const BASE = '/orch'

export class OrchestratorUnreachable extends Error {}

async function requestEnvelope<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta: { mock?: boolean } }> {
  let response: Response
  try {
    response = await fetch(BASE + path, init)
  } catch {
    throw new OrchestratorUnreachable('총괄에 연결할 수 없음')
  }
  const body = (await response.json().catch(() => null)) as {
    data?: T
    meta?: { mock?: boolean }
  } | null
  if (!response.ok || !body || body.data === undefined) {
    // 프록시 대상이 안 떠 있으면 개발 서버가 JSON 없이 5xx를 돌려준다
    if (response.status >= 500 && !body) throw new OrchestratorUnreachable('총괄에 연결할 수 없음')
    // 다른 서비스가 그 포트를 쓰고 있는 경우 (예: 오류 JSON에 data가 없음)
    throw new OrchestratorUnreachable(`총괄이 아닌 서버가 응답함 (HTTP ${response.status})`)
  }
  return { data: body.data, meta: body.meta ?? {} }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await requestEnvelope<T>(path, init)).data
}

/** 사건 목록과, 총괄이 목 모드인지(`meta.mock`). 승인·거절 버튼은 목 모드에서만 보여 준다 */
export async function listIncidents(): Promise<{ incidents: Incident[]; mock: boolean }> {
  const { data, meta } = await requestEnvelope<Incident[]>('/api/incidents')
  return { incidents: data, mock: meta.mock === true }
}
/** 부서별 카드·skill·사용량(총괄이 부른 호출을 센 실측). 부서 카드와 상세 화면이 쓴다 */
export const getDepartments = () => request<Department[]>('/api/departments')

export const injectIncident = (options: DemoOptions) =>
  request<{ context_id: string }>('/api/demo/incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })

/** 목 모드에서만: 사람 승인·거절 흉내 (총괄이 승인하는 게 아니다. 총괄 홀드 엔드포인트는 사람 토큰 확인이 없다, #265) */
export const decideHold = (contextId: string, stepId: string, approved: boolean) =>
  request<{ ok: boolean }>(`/api/incidents/${contextId}/holds/${stepId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  })
