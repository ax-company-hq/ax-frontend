import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 포트는 shop-web 3000, dashboard-web 3001 다음 번호. .env는 레포 루트 것을 읽는다
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: { port: 3002, strictPort: true },
  preview: { port: 3002, strictPort: true },
})
