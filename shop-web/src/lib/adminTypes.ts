// 총괄(orchestrator) 사건 응답 모양. shop-api가 그대로 전달한다.
// ax-backend `orchestrator/src/ax_orchestrator/models.py`의 `Incident.view()` 기준.
// 중계 응답은 OpenAPI에 모양이 없어 손으로 적는다(총괄 쪽이 바뀌면 이 파일을 같이 고친다).

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "held"
  | "skipped"
  | "rejected_by_human"
  | "transfer_queued";

export interface Step {
  step_id: string;
  skill: string;
  label: string;
  dept: string | null;
  status: StepStatus;
  attempts: number;
  note: string;
  grade: string | null;
  started_at: string | null;
  finished_at: string | null;
  transferred_to: string | null;
  reason_code: string | null;
}

export interface PendingHold {
  step_id: string;
  skill: string;
  label: string;
}

export interface Incident {
  context_id: string;
  kind: string;
  title: string;
  component: string;
  status: "open" | "resolved" | "degraded";
  opened_at: string;
  closed_at: string | null;
  steps: Step[];
  events: { at: string; message: string }[];
  summary: string[];
  metrics: { mttr_seconds?: number; steps_total?: number; steps_completed?: number; held?: number; transfers?: number; retries?: number };
  /** 총괄이 보관한 값(예: 점검 공지 번호 `notice_id`). 부서가 주지 않으면 없다. */
  shared?: Record<string, unknown>;
  pending_holds: PendingHold[];
}
