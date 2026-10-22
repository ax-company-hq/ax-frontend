import { Navigate, Route, Routes, useLocation } from 'react-router'

import { ThemeProvider } from '@/components/ThemeProvider'
import { AdminShell } from '@/components/admin/AdminShell'
import Claims from '@/pages/Claims'
import Console from '@/pages/Console'
import Dashboard from '@/pages/Dashboard'
import Finance from '@/pages/Finance'
import FinanceGuide from '@/pages/FinanceGuide'
import Kb from '@/pages/Kb'
import Queue from '@/pages/Queue'
import Reviews from '@/pages/Reviews'

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
