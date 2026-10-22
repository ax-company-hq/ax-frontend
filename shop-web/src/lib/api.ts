import { ApiError } from "./apiError";
import type { CartPrice, Category, Claim, ClaimInput, Decision, Health, Inquiry, InquiryItem, Me, Order, Product, ProductDetail, Review, Validation } from "./types";

import { SHOP_API_URL } from "./env";

// 판매 사이트 → shop-api. 경로 목록은 README의 API 표 참고.
const BASE = SHOP_API_URL;
const USER_KEY = "catbooks.user";

export { ApiError };

export function storedUserId(): number | null {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v ? Number(v) : null;
  } catch {
    return null; // storage blocked
  }
}
export function storeUserId(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(USER_KEY);
    else localStorage.setItem(USER_KEY, String(id));
  } catch {
    /* session-only */
  }
}

/** 응답 본문 해석: ax-backend 규약 `{data, meta}`이면 data를, 아니면(catbooks 백엔드) 본문 그대로 쓴다. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && !Array.isArray(body) && "data" in body && "meta" in body) return (body as { data: T }).data;
  return body as T;
}

/** 실패 본문 해석: ax-backend `{error: {code, message}}`와 FastAPI `{detail}` 둘 다 받는다. */
function toError(body: unknown, status: number): ApiError {
  const b = (body ?? {}) as { error?: { code?: string; message?: string }; detail?: unknown };
  if (b.error?.message) return new ApiError(b.error.message, status);
  const detail = b.detail;
  if (detail && typeof detail === "object" && "validation" in detail) {
    const d = detail as { message: string; validation: Validation };
    return new ApiError(d.message, status, d.validation);
  }
  return new ApiError(typeof detail === "string" ? detail : `요청 실패 (${status})`, status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const uid = storedUserId();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(uid ? { "X-User-Id": String(uid) } : {}), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* body was not JSON */
    }
    throw toError(body, res.status);
  }
  return res.status === 204 ? (undefined as T) : unwrap<T>(await res.json());
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => request<Health>("/api/health"),
  // customer
  users: () => request<Me[]>("/api/users"),
  me: () => request<Me>("/api/me"),
  categories: () => request<Category[]>("/api/categories"),
  products: (p: { category?: string; q?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
    return request<Product[]>(`/api/products${qs ? `?${qs}` : ""}`);
  },
  product: (id: number) => request<ProductDetail>(`/api/products/${id}`),
  helpful: (id: number) => post<{ helpful: number }>(`/api/reviews/${id}/helpful`),
  writeReview: (b: { order_item_id: number; rating: number; title: string; body: string }) =>
    post<Review & { held: boolean; message: string }>("/api/reviews", b),
  price: (lines: { product_id: number; qty: number }[]) => post<CartPrice>("/api/cart/price", lines),
  placeOrder: (b: { lines: { product_id: number; qty: number }[]; points_used: number; payment_method: string; receiver: string; address: string }) =>
    post<Order>("/api/orders", b),
  orders: () => request<Order[]>("/api/orders"),
  order: (id: number) => request<Order>(`/api/orders/${id}`),
  advance: (id: number, late_days = 0) => post<Order>(`/api/orders/${id}/advance`, { late_days }),
  previewClaim: (b: ClaimInput) => post<Decision>("/api/claims/preview", b),
  submitClaim: (b: ClaimInput) => post<Claim>("/api/claims", b),
  myClaims: () => request<Claim[]>("/api/claims"),
  addEvidence: (id: number, count = 1) => post<Claim>(`/api/claims/${id}/evidence`, { count }),
  withdrawClaim: (id: number) => post<Claim>(`/api/claims/${id}/withdraw`),
  inquiries: () => request<InquiryItem[]>("/api/inquiries"),
  inquiry: (id: number) => request<Inquiry>(`/api/inquiries/${id}`),
  newInquiry: (b: { subject: string; message: string; order_id?: number | null }) => post<Inquiry>("/api/inquiries", b),
  followUp: (id: number, text: string) => post<Inquiry>(`/api/inquiries/${id}/messages`, { text }),

};
