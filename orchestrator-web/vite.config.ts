import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// 포트는 ax-backend/CLAUDE.md 포트 표 기준. .env는 레포 루트 것을 읽는다
// /orch → 총괄(orchestrator). 총괄에 CORS가 없어 개발 서버가 대신 부른다 (dashboard-web AI 대화방과 같은 방식)
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), ''), ...process.env }
  const orchestrator = env.ORCHESTRATOR_PROXY_TARGET || 'http://localhost:8000'
  const proxy = {
    '/orch': { target: orchestrator, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/orch/, '') },
  }
  return {
    plugins: [react()],
    envDir: '..',
    server: { port: 3004, strictPort: true, proxy },
    preview: { port: 3004, strictPort: true, proxy },
  }
})
