import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ADMIN_ENABLED } from "./env";

// 개발용 관리자 모드. 환경변수 `VITE_SHOP_ADMIN_TOKEN`이 있을 때만 켜진다(기본 꺼짐).
// 진짜 관리자 로그인과 역할(소유자·공동소유자·분야 관리자·에이전트)은 사람 인증 뒤에 이 컨텍스트를 대신한다.
interface AdminValue {
  enabled: boolean;
}

const AdminContext = createContext<AdminValue>({ enabled: false });

export function AdminProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ enabled: ADMIN_ENABLED }), []);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminValue {
  return useContext(AdminContext);
}
