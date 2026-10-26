import type { Incident, StepStatus } from "./adminTypes";

// 부서 이름(영문 id) → 화면에 쓰는 한글 이름. 부서 id는 총괄 Agent Card 레지스트리의 이름이다.
const DEPT_KO: Record<string, string> = {
  infra: "인프라",
  data: "데이터분석",
  planning: "기획개발",
  marketing: "마케팅",
  support: "고객지원",
  finance: "재무·정산",
  hr: "인사운영",
};
export const deptKo = (name: string | null) => (name ? (DEPT_KO[name] ?? name) : "미정");

export const STEP_STATUS_KO: Record<StepStatus, string> = {
  pending: "대기",
  running: "진행 중",
  completed: "완료",
  failed: "실패",
  held: "사람 승인 대기",
  skipped: "건너뜀",
  rejected_by_human: "보류 후 거절",
  transfer_queued: "이관 큐로 넘김",
};

// 색은 shop-web 팔레트(brand·amber·emerald·red·violet·ink)만 쓴다
export const STEP_STATUS_TONE: Record<StepStatus, string> = {
  pending: "bg-ink-100 text-ink-700",
  running: "bg-brand-50 text-brand-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  held: "bg-amber-50 text-amber-700",
  skipped: "bg-ink-100 text-ink-500",
  rejected_by_human: "bg-red-50 text-red-700",
  transfer_queued: "bg-violet-50 text-violet-700",
};

export const INCIDENT_STATUS_KO: Record<Incident["status"], string> = {
  open: "진행 중",
  resolved: "해결",
  degraded: "일부 미완료",
};
export const INCIDENT_STATUS_TONE: Record<Incident["status"], string> = {
  open: "bg-brand-50 text-brand-700",
  resolved: "bg-emerald-50 text-emerald-700",
  degraded: "bg-amber-50 text-amber-700",
};

// 총괄이 사건에 보관하는 값의 이름(`shared`) → 화면 이름
export const SHARED_KO: Record<string, string> = {
  notice_id: "점검 공지 번호",
  recovered_notice_id: "정상화 공지 번호",
};
