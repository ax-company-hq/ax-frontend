import { Navigate, Route, Routes } from "react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdmin } from "@/lib/admin";
import AdminOrchestrator from "./AdminOrchestrator";

/** `/admin/*`. 관리자 모드가 꺼져 있으면 홈으로 돌려보낸다(구매자 화면에는 아무것도 보이지 않는다). */
export default function AdminRoutes() {
  const { enabled } = useAdmin();
  if (!enabled) return <Navigate to="/" replace />;
  return (
    <AdminLayout>
      <Routes>
        <Route path="orchestrator" element={<AdminOrchestrator />} />
        <Route path="*" element={<Navigate to="/admin/orchestrator" replace />} />
      </Routes>
    </AdminLayout>
  );
}
