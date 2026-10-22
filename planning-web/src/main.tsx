import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@dejafix/common-frontend/styles.css'
import './app.css'
import { ToastProvider } from '@dejafix/common-frontend'
import { App } from './App'
import { COMPANY } from './company'

document.title = `${COMPANY.name} 업무 시스템 · 기획개발팀`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
