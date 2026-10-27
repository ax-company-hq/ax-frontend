import { Navigate, Route, Routes, useLocation } from 'react-router'

import { ThemeProvider } from '@/components/ThemeProvider'
import { AdminShell } from '@/components/admin/AdminShell'
import AgentChat from '@/pages/AgentChat'
import AgentOffice from '@/pages/AgentOffice'
import Claims from '@/pages/Claims'
import Console from '@/pages/Console'
import Dashboard from '@/pages/Dashboard'
import Data from '@/pages/Data'
import Finance from '@/pages/Finance'
import FinanceGuide from '@/pages/FinanceGuide'
import Hr from '@/pages/Hr'
import Orchestrator from '@/pages/Orchestrator'
import Kb from '@/pages/Kb'
import Marketing from '@/pages/Marketing'
import PlanningPage from '@/planning/PlanningPage'
import Queue from '@/pages/Queue'
import Reviews from '@/pages/Reviews'
import Support from '@/pages/Support'

export function App() {
  return (
    <ThemeProvider>
      <AdminShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/console" element={<Console />} />
          <Route path="/claims" element={<Claims />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/kb" element={<Kb />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/finance/guide" element={<FinanceGuide />} />
          <Route path="/hr" element={<Hr />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/orchestrator" element={<Orchestrator />} />
          <Route path="/data" element={<Data />} />
          <Route path="/hr" element={<Hr />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/agents/chat" element={<AgentChat />} />
          <Route path="/agents/office" element={<AgentOffice />} />
          <Route path="/support" element={<Support />} />
          {/* catbooks 시절 /admin/* 주소 호환 */}
          <Route path="/admin/*" element={<LegacyAdminRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminShell>
    </ThemeProvider>
  )
}

/** /admin/console?id=3 → /console?id=3 */
function LegacyAdminRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate to={(pathname.replace(/^\/admin/, '') || '/') + search} replace />
}
