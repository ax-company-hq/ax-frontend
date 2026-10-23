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

export interface RegistrySkill {
  id: string
  grade: string
  priority: string
  orchestrator: boolean
}

export interface RegistryDept {
  name: string
  owner: string
  mode?: 'real' | 'mock'
  skills: RegistrySkill[]
}

export interface Registry {
  depts: RegistryDept[]
  unavailable: Record<string, string>
  conflicts: string[]
}

/** 장애 주입 옵션. 각 옵션은 가짜 부서의 동작을 바꾼다. */
export interface DemoOptions {
  hold_rollback: boolean
  fail_marketing: boolean
  wrong_owner: boolean
  infra_card_empty: boolean
}
