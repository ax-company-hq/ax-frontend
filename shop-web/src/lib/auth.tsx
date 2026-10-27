import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { storeBuyer, storedBuyer } from "./api";

/** 구매자 한 명(가명 ID). TODO(ax-backend#385): 이름·적립금이 있는 데모 사용자가 생기면 필드를 늘린다. */
export interface Buyer { id: string }

interface AuthValue {
  user: Buyer | null;
  ready: boolean;
  login: (id: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** 데모 구매자 선택. shop-api에는 로그인이 없어 ID는 sessionStorage에만 두고 주문 요청 본문에 실어 보낸다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Buyer | null>(() => {
    const id = storedBuyer();
    return id ? { id } : null;
  });

  const login = useCallback((id: string) => {
    storeBuyer(id);
    setUser({ id });
  }, []);
  const logout = useCallback(() => {
    storeBuyer(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready: true, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
