import { SHOP_API_URL } from "./env";

// ax-backend shop-api 전용 호출(`/api/shop/*`). 기존 catbooks 호출(api.ts)과 섞이지 않게 따로 둔다.
// 이 경로에는 로그인·토큰이 없다: 구매자는 가명 ID(`buy_0001`…)이고 서버가 주문 구매자와 대조한다.

export const BUYER_IDS = Array.from({ length: 30 }, (_, i) => `buy_${String(i + 1).padStart(4, "0")}`);

const BUYER_KEY = "ax.buyer";
export function storedBuyer(): string | null {
  try {
    return sessionStorage.getItem(BUYER_KEY);
  } catch {
    return null;
  }
}
export function storeBuyer(id: string | null) {
  try {
    if (id) sessionStorage.setItem(BUYER_KEY, id);
    else sessionStorage.removeItem(BUYER_KEY);
  } catch {
    /* session-only */
  }
}

export class AxError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export interface AxOrderItem {
  order_item_id: string; product_id: string; seller_id: string; title: string; qty: number; unit_price: number; points_share: number; paid_amount: number;
}
export interface AxOrder {
  order_id: string; buyer_id: string; status: string; total_amount: number; refunded_amount: number; shipping_fee: number; points_used: number;
  delivered_at: string | null; created_at: string; items: AxOrderItem[];
}

export type AxClaimType = "cancel" | "return" | "exchange";
export type AxClaimReason = "change_of_mind" | "defect" | "wrong_item" | "damaged" | "missing_item" | "late_delivery" | "other";
export type AxClaimStatus = "needs_info" | "needs_review" | "awaiting_return" | "return_received" | "approved" | "completed" | "rejected";

export interface AxClaimInput {
  buyer_id: string; customer_name: string; order_id: string; type: AxClaimType; reason: AxClaimReason;
  items?: { order_item_id: string; qty: number }[]; unsealed?: boolean; evidence_count?: number; description?: string;
}

export interface AxClaim {
  id: number; context_id: string; order_id: string; order_no: string; buyer_id: string; type: AxClaimType; reason: AxClaimReason; status: AxClaimStatus;
  created_at: string; outcome: string; resolution: string; requires_return: boolean; evidence_count: number; unsealed: boolean;
  reasons: { code: string; level: "block" | "review" | "warn" | "info"; message: string; rule: string | null }[];
  lines: { order_item_id: string; title: string; qty: number; requested_qty: number; unit_price: number; refund_cash: number; points_back: number }[];
  shipping_refund: number; expected_refund: number; points_back: number; refund_paid: number; processed_at: string | null;
}

interface Body<T> { data?: T; meta?: { context_id?: string }; error?: { code?: string; message?: string } }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SHOP_API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  } catch {
    throw new AxError("shop-api에 연결할 수 없습니다.", 0);
  }
  const body = (await res.json().catch(() => null)) as Body<T> | null;
  if (!res.ok || !body || body.data === undefined) {
    throw new AxError(body?.error?.message ?? `요청 실패 (${res.status})`, res.status, body?.error?.code);
  }
  return body.data;
}

export const axShop = {
  orders: (buyerId: string) => call<AxOrder[]>(`/api/shop/orders?buyer_id=${encodeURIComponent(buyerId)}`),
  /** 고객 신청 → shop-api → 고객지원. 금액은 보내지 않는다(고객지원이 주문 사실로 계산). */
  submitClaim: (b: AxClaimInput) => call<AxClaim>("/api/shop/claims", { method: "POST", body: JSON.stringify(b) }),
};
