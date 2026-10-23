# orchestrator-web — 통합 에이전트(총괄) 시연 콘솔

장애를 주입하면 총괄 에이전트가 가짜 부서 7곳(또는 내 에이전트)에 일을 나눠 주고 결과를 모으는 과정을 보여 주는 **개발·시연용 콘솔**입니다. 담당: 준하 · 포트: **3004** · 연결: 총괄 백엔드 (`ax-backend/orchestrator`)

## 이 화면의 역할 (관리자 화면과 다름)
| | 위치 | 담당 | 용도 |
| --- | --- | --- | --- |
| **시연 콘솔 (이 앱)** | `orchestrator-web/` | 준하 | 개발·시연: 장애 주입, 가짜 부서 옵션, 부서 카드, 사건 흐름 |
| 운영 화면 (회사 전체) | `dashboard-web/` 관리자 | 병환 | 가상 회사 직원이 보는 사건 목록·승인 대기열·소통. `dashboard-api`를 거쳐 읽음 |

- 이 콘솔은 **개발 서버가 총괄을 직접 부릅니다**(`/orch` 프록시). 개발 서버에서만 동작하고, 운영 화면은 `dashboard-api`의 읽기 전용 사건 경로(ax-backend #257로 머지됨)를 쓰고, 이 콘솔은 로컬 시연·연동 확인용입니다.
- 장애 주입 버튼과 가짜 부서 옵션은 개발용 기능이라 운영 화면(관리자)에는 넣지 않습니다.
- **운영 게이트웨이(`:8080`, PR-D2)에는 이 앱을 붙이지 않습니다.** `/admin/orchestrator/`처럼 관리자 아래에 붙이면 장애 주입 같은 개발 기능이 운영 관리자에서 열릴 수 있어서, 이 앱은 로컬 개발·시연에서만 씁니다.
- **승인·거절 버튼은 총괄이 목 모드일 때만** 보입니다. 총괄 홀드 엔드포인트에는 사람 토큰 확인이 없어서(ax-backend #265) 실제 모드에서는 "안전 관문 보류 큐에서 결정하기" 링크(관리자 재무·안전 화면)로 바뀌고, 사람 결정은 안전 관문 보류 큐 하나로만 갑니다. 링크 주소는 `VITE_DASHBOARD_WEB_URL`(기본 `http://localhost:3001`)을 씁니다.

> 값은 모두 지어낸 목 데이터이고 화면 위에도 `MOCK`이라고 표시됩니다. 총괄은 승인하지 않고, "승인" 버튼은 사람이 누르는 대시보드 동작을 흉내 낸 것입니다.

## 접속하는 방법 (터미널 2개)

화면(프론트엔드)은 총괄 백엔드가 떠 있어야 동작합니다. 그래서 터미널을 2개 씁니다.

두 레포를 나란히 받아 두세요 (`ax-backend`는 `dev` 브랜치).
```
ax-company-hq/
├─ ax-backend/
└─ ax-frontend/
```

### 터미널 1 — 총괄 백엔드 켜기
```bash
cd ax-backend
git switch dev && git pull
uv sync
uv run python -m ax_orchestrator --port 8000 --no-browser
```
`총괄 목업: http://localhost:8000/demo`가 나오면 성공입니다. (이 주소는 백엔드가 직접 보여 주는 간단한 화면이고, 아래 3004 화면이 정식 프론트엔드입니다.)

> **8000번이 이미 사용 중이면** 8001, 8002… 중 빈 포트를 쓰고 싶을 수 있습니다. `--port`를 빼고 실행하면 빈 포트를 자동으로 찾아 터미널에 알려 줍니다. 그때는 아래 터미널 2에서 그 포트를 알려 주세요.

### 터미널 2 — 화면 켜기
```bash
cd ax-frontend
nvm use            # Node 22.23.4 이상 (없으면 생략)
npm install        # 처음 한 번
npm run dev:orchestrator
```
그리고 브라우저에서 **http://localhost:3004** 를 엽니다.

총괄이 8000이 아닌 포트에 떴다면 이렇게 켭니다 (예: 8002).
```bash
# Git Bash · macOS · Linux
ORCHESTRATOR_PROXY_TARGET=http://localhost:8002 npm run dev:orchestrator
```
```powershell
# Windows PowerShell
$env:ORCHESTRATOR_PROXY_TARGET="http://localhost:8002"; npm run dev:orchestrator
```
레포 루트 `.env`에 `ORCHESTRATOR_PROXY_TARGET=...`을 적어 두어도 됩니다 (`.env.example` 참고).

### 화면 쓰는 법
1. **결제 장애 주입 (시나리오 A)** 를 누르면 사건이 열리고 12단계가 순서대로 진행됩니다.
2. 버튼 아래 옵션을 켜고 주입하면 다른 경우를 볼 수 있습니다.
   - 롤백을 C 등급 보류로: 사람 승인이 필요해 멈추고, **승인대기열**에 승인·거절 버튼이 나옵니다.
   - 공지 게시 1회 실패: 재시도로 복구됩니다.
   - 공지 게시 거절(이관 큐로 넘김): 소관 부서를 찾지 못하면 지어내지 않고 단계에 "이관 큐"로 표시하며, 사건은 일부 미완료로 끝납니다.
   - 인프라 카드 비어 있음: 진단 단계가 건너뛰어지고 일부 미완료로 끝납니다.
3. 아래 **부서 에이전트** 영역에 부서(인프라·데이터분석·기획개발·마케팅·고객지원·재무/정산·인사운영)별 카드가 있습니다. 카드를 누르면 그 부서의 세부 내용이 오른쪽에 뜹니다.
   - 호출 수·성공률·평균 응답 시간·재시도 타일과 최근 10분 사용량 그래프(막대: 30초당 호출 수, 빨강은 오류, 노랑 선은 평균 응답 시간)
   - skill별 사용 현황(호출 추이, 성공률, 평균 응답), 이번 사건에서 맡은 일, 최근 호출 기록
   - 부서 이름 옆에 `목`/`실제`가 표시됩니다. 사용량은 **총괄이 그 부서를 부른 호출을 센 실측값**이라 장애를 주입해야 쌓입니다(부서 내부의 CPU·메모리는 총괄이 알 수 없어서 그리지 않습니다).

### 내 에이전트만 실제로 붙여 보기
내 에이전트를 먼저 띄우고, 터미널 1에서 총괄을 띄울 때 내 부서를 지정합니다.
```bash
ORCHESTRATOR_REAL_DEPTS=finance uv run python -m ax_orchestrator --port 8000 --no-browser
```
화면의 부서 카드에 내 부서가 `실제`로 보입니다. 총괄이 내 skill을 어떤 입력으로 언제 부르는지는 `ax-backend/docs/notes/orchestrator/department-guide.md`에 있습니다.

## 문제가 생기면
| 증상 | 이유와 해결 |
|---|---|
| 화면에 "총괄(백엔드)에 연결되지 않았어요"가 뜬다 | 터미널 1의 총괄이 꺼져 있거나 포트가 다릅니다. 위 순서대로 다시 켜세요. |
| "총괄이 아닌 서버가 응답함"이 뜬다 | 그 포트(기본 8000)를 다른 서비스가 쓰고 있습니다. 총괄을 빈 포트로 띄우고 `ORCHESTRATOR_PROXY_TARGET`으로 알려 주세요. |
| `npm run dev:orchestrator`가 "port 3004 in use" | 이미 화면이 켜져 있습니다. 브라우저에서 http://localhost:3004 를 여세요. |
| `uv`가 없다 | https://docs.astral.sh/uv/ 에서 설치하세요. |

## 구조
- `src/App.tsx` 화면 전체, `src/api.ts` 총괄 API 호출, `src/types.ts` 응답 타입
- 개발 서버가 `/orch/*`를 총괄 백엔드로 대신 보냅니다(`vite.config.ts`). 총괄에는 CORS가 없어서 브라우저가 직접 부르지 않습니다. `dashboard-web`의 AI 대화방과 같은 방식입니다.
- 총괄 API: `GET /api/incidents`, `GET /api/departments`(부서별 카드·skill·사용량), `POST /api/demo/incidents`, `POST /api/incidents/{ctx}/holds/{step}`(목 모드만)
- `src/components/Departments.tsx` 부서 카드 목록과 상세, `src/components/Charts.tsx` 사용량 그래프, `src/deptLabels.ts` 부서 한글 이름·설명
