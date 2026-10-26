// 부서 이름(영문 id) → 화면에 쓰는 한글 이름과 한 줄 설명. 부서 id는 총괄 Agent Card 레지스트리의 이름이다.
export const DEPT_LABELS: Record<string, { title: string; desc: string }> = {
  infra: { title: '인프라 (DejaFix)', desc: '장애 진단 · 롤백 · 복구 검증' },
  data: { title: '데이터분석', desc: '이상 탐지 · 영향 분석' },
  planning: { title: '기획개발', desc: '관련 PR 찾기 · 사건 연결' },
  marketing: { title: '마케팅', desc: '점검·정상화 공지 초안과 게시' },
  support: { title: '고객지원', desc: '문의 응대 · 보상 판정' },
  finance: { title: '재무/정산', desc: '손실 리포트 · 금액 검증' },
  hr: { title: '인사운영', desc: '사건 기록 · 인수인계' },
}

export const deptTitle = (name: string) => DEPT_LABELS[name]?.title ?? name
export const deptDesc = (name: string) => DEPT_LABELS[name]?.desc ?? ''
