// 총괄(orchestrator) API 응답 모양. ax-backend `orchestrator/src/ax_orchestrator/models.py`·`main.py` 기준.

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'held'
  | 'skipped'
  | 'rejected_by_human'
  | 'transfer_queued'

export interface Step {
  step_id: string
  skill: string
  label: string
  dept: string | null
  status: StepStatus
  attempts: number
  note: string
  grade: string | null
  started_at: string | null
  finished_at: string | null
  transferred_to: string | null
  reason_code: string | null
}

export interface PendingHold {
  step_id: string
  skill: string
  label: string
}

export interface Metrics {
  mttr_seconds?: number
  steps_total?: number
  steps_completed?: number
  held?: number
  transfers?: number
  retries?: number
  auto_rate?: number
}

export interface Incident {
  context_id: string
  kind: string
  title: string
  component: string
  status: 'open' | 'resolved' | 'degraded'
  opened_at: string
  closed_at: string | null
  steps: Step[]
  events: { at: string; message: string }[]
  summary: string[]
  metrics: Metrics
  pending_holds: PendingHold[]
}

/** 장애 주입 옵션. 각 옵션은 가짜 부서의 동작을 바꾼다. */
export interface DemoOptions {
  hold_rollback: boolean
  fail_marketing: boolean
  wrong_owner: boolean
  infra_card_empty: boolean
}

/** 부서 호출 사용량 한 구간(30초). 총괄이 부른 호출을 센 값이다. */
export interface SeriesPoint {
  t: string
  calls: number
  errors: number
  avg_ms: number | null
}

export interface UsageSummary {
  calls: number
  errors: number
  waiting: number
  success_rate: number | null
  avg_ms: number | null
  p95_ms: number | null
  retries: number
  last_called_at: string | null
}

export interface SkillUsage {
  id: string
  grade: string
  priority: string
  orchestrator: boolean
  calls: number
  errors: number
  success_rate: number | null
  avg_ms: number | null
  retries: number
  series: SeriesPoint[]
}

export interface RecentCall {
  at: string
  skill: string
  status: string
  outcome: string | null
  duration_ms: number
  context_id: string
}

export interface Department {
  name: string
  owner: string | null
  mode: 'real' | 'mock'
  available: boolean
  unavailable_reason: string | null
  skills: SkillUsage[]
  usage: UsageSummary
  series: SeriesPoint[]
  recent: RecentCall[]
}
