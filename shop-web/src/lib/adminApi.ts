import { ApiError } from "./apiError";
import { ADMIN_API_URL, ADMIN_DEMO_TOKEN } from "./env";
import type { Incident } from "./adminTypes";

// 관리자 화면 → shop-api 관리 API. 총괄은 shop-api가 읽어 와서 전달한다(총괄을 직접 부르지 않는다).
// 토큰은 환경변수(개발용)에서만 오고 브라우저 저장소에는 두지 않는다.
async function adminGet<T>(path: string): Promise<{ data: T; meta: Record<string, unknown> }> {
  if (!ADMIN_DEMO_TOKEN) throw new ApiError("관리자 모드가 꺼져 있습니다", 403);
  const res = await fetch(`${ADMIN_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${ADMIN_DEMO_TOKEN}` },
    cache: "no-store",
  });
  let body: { data?: T; meta?: Record<string, unknown>; error?: { code?: string; message?: string } } = {};
  try {
    body = await res.json();
  } catch {
    /* body was not JSON */
  }
  if (!res.ok || body.data === undefined) {
    throw new ApiError(body.error?.message ?? `요청 실패 (${res.status})`, res.status);
  }
  return { data: body.data, meta: body.meta ?? {} };
}

export const adminApi = {
  incidents: () => adminGet<Incident[]>("/api/shop/admin/orchestrator/incidents"),
  incident: (contextId: string) => adminGet<Incident>(`/api/shop/admin/orchestrator/incidents/${encodeURIComponent(contextId)}`),
};
