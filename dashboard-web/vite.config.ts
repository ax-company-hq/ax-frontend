import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// 포트는 ax-backend/CLAUDE.md 포트 표 기준. .env는 레포 루트 것을 읽는다
// /orch → 총괄(orchestrator). 총괄에 CORS가 없어 개발 서버가 대신 부른다 (AI 대화방)
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), ''), ...process.env }
  const orchestrator = env.ORCHESTRATOR_PROXY_TARGET || 'http://localhost:8000'
  // /data-a2a → 데이터 AI(8106). 데이터분석 AI 화면의 KPI 직접 조회용 (개발 전용, 운영은 dashboard-api 중계 예정)
  const dataAgent = env.DATA_PROXY_TARGET || 'http://localhost:8106'
  const proxy = {
    // '^/orch/'로 한정한다. '/orch'만 쓰면 '/orchestrator' 같은 화면 주소까지 프록시로 가 버린다
    '^/orch/': { target: orchestrator, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/orch/, '') },
    '/data-a2a': { target: dataAgent, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/data-a2a/, '') },
  }
  return {
    // 관리자 한 포트(게이트웨이)에서는 `DASHBOARD_WEB_BASE=/admin/`으로 빌드한다. 로컬 개발은 루트
    base: process.env.DASHBOARD_WEB_BASE ?? '/',
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    envDir: '..',
    server: { port: 3001, strictPort: true, proxy },
    preview: { port: 3001, strictPort: true, proxy },
  }
})
