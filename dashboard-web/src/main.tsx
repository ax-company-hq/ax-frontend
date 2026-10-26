import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles.css'
import { App } from './App'
import { DemoGate } from './components/admin/DemoGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <DemoGate>
        <App />
      </DemoGate>
    </BrowserRouter>
  </StrictMode>,
)
