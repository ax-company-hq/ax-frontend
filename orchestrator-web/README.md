# orchestrator-web — 통합 에이전트(총괄) 화면

장애를 주입하면 총괄 에이전트가 가짜 부서 7곳(또는 내 에이전트)에 일을 나눠 주고 결과를 모으는 과정을 보여 주는 화면입니다. 담당: 준하 · 포트: **3004** · 연결: 총괄 백엔드 (`ax-backend/orchestrator`)

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
   - 공지 게시를 다른 부서에 이관: 소관이 아니라고 거절돼 다른 부서로 넘어갑니다.
   - 인프라 카드 비어 있음: 진단 단계가 건너뛰어지고 일부 미완료로 끝납니다.
3. 오른쪽 **부서 에이전트(Agent Card)** 에는 부서별 skill이 보이고, 부서 이름 옆에 `목`/`실제`가 표시됩니다.

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
- 총괄 API: `GET /api/incidents`, `GET /api/registry`, `POST /api/demo/incidents`, `POST /api/incidents/{ctx}/holds/{step}`
