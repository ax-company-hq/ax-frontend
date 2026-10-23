import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 포트는 shop-web 3000, dashboard-web 3001 다음 번호. .env는 레포 루트 것을 읽는다
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  // 관리자 한 포트에 합칠 때 `PLANNING_WEB_BASE=/admin/planning/`로 빌드한다 (기본은 루트). 라우팅은 해시라 경로와 무관
  base: process.env.PLANNING_WEB_BASE ?? '/',
  server: { port: 3002, strictPort: true },
  preview: { port: 3002, strictPort: true },
})
