import { SHOP_API_URL } from "./env";
import type { Claim, ClaimInput, Order, OrderLineInput, Product } from "./types";

// 판매 사이트 → shop-api(`/api/shop/*`)의 모든 호출은 이 파일 한 곳에 둔다.
// 성공은 `{data, meta}`, 실패는 `{error: {code, message}}`. 로그인·토큰은 없고 구매자는 가명 ID(`buy_0001`…)다.
const BASE = SHOP_API_URL;

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/** shop-api에 아직 없는 기능. 화면은 오류 대신 "준비 중" 안내를 보여 준다. */
export class NotReadyError extends Error {
  constructor(public feature: string) {
    super(`${feature}은(는) 준비 중입니다.`);
  }
}
export const isNotReady = (e: unknown): e is NotReadyError => e instanceof NotReadyError;

// ---------------------------------------------------------------- 구매자(데모)
// TODO(ax-backend#385): 이름·적립금이 있는 데모 사용자(`/api/shop/...`)가 생기면 이 가명 ID 선택을 바꾼다.
export const BUYER_IDS = Array.from({ length: 30 }, (_, i) => `buy_${String(i + 1).padStart(4, "0")}`);
const BUYER_KEY = "ax.buyer";
export function storedBuyer(): string | null {
  try {
    return sessionStorage.getItem(BUYER_KEY);
  } catch {
    return null; // storage blocked
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

// ---------------------------------------------------------------- 호출
interface Body<T> { data?: T; meta?: Record<string, unknown>; error?: { code?: string; message?: string } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  } catch {
    throw new ApiError(`판매 서버(shop-api, ${BASE})에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.`, 0);
  }
  const body = (await res.json().catch(() => null)) as Body<T> | null;
  if (!res.ok || !body || body.data === undefined) {
    throw new ApiError(body?.error?.message ?? `요청 실패 (${res.status})`, res.status, body?.error?.code);
  }
  return body.data;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

const notReady = <T>(feature: string): Promise<T> => Promise.reject(new NotReadyError(feature));

export const api = {
  // --- shop-api에 있는 것 -------------------------------------------------
  products: (p: { category_code?: string } = {}) =>
    request<Product[]>(`/api/shop/products${p.category_code ? `?category_code=${encodeURIComponent(p.category_code)}` : ""}`),
  product: (id: string) => request<Product>(`/api/shop/products/${encodeURIComponent(id)}`),
  orders: (buyerId: string) => request<Order[]>(`/api/shop/orders?buyer_id=${encodeURIComponent(buyerId)}`),
  order: (id: string) => request<Order>(`/api/shop/orders/${encodeURIComponent(id)}`),
  /** 합계·배송비·포인트 배분은 서버가 계산한다(주문 생성 직후 `pending_payment`). */
  placeOrder: (b: { buyer_id: string; items: OrderLineInput[]; points_used?: number }) => post<Order>("/api/shop/orders", b),
  /** 가짜 결제. 실패하면 주문이 `payment_failed`로 돌아오고 다시 결제할 수 있다. */
  pay: (orderId: string, method_code: string) => post<Order>(`/api/shop/orders/${encodeURIComponent(orderId)}/payments`, { method_code }),
  /** 결제 전(pending_payment·payment_failed) 주문만 취소된다. 결제 후 취소·환불은 클레임으로 한다. */
  cancel: (orderId: string) => post<Order>(`/api/shop/orders/${encodeURIComponent(orderId)}/cancel`, { reason_code: "buyer" }),
  /** 고객 신청 → shop-api → 고객지원. 금액은 보내지 않는다(고객지원이 주문 사실로 계산). */
  submitClaim: (b: ClaimInput) => post<Claim>("/api/shop/claims", b),

  // --- shop-api에 아직 없는 것: ax-backend#385 결과로 연결 --------------------
  // TODO(ax-backend#385): 데모 사용자(이름·적립금)
  demoUsers: () => notReady<never>("데모 로그인"),
  // TODO(ax-backend#385): 카테고리 목록(지금은 상품의 category_code로 화면에서 묶는다)
  categories: () => notReady<never>("카테고리 목록"),
  // TODO(ax-backend#385): 장바구니 가격(배송비·합계). 주문 생성 응답의 total_amount가 실제 금액이다
  cartPrice: (_lines: OrderLineInput[]) => notReady<never>("장바구니 가격 계산"),
  // TODO(ax-backend#385): 클레임 환불액 미리보기, 신청 내역 조회·철회·사진 추가
  previewClaim: (_b: ClaimInput) => notReady<never>("환불액 미리보기"),
  claims: (_buyerId: string) => notReady<never>("신청 내역 조회"),
  // TODO(ax-backend#385): 1:1 문의
  inquiries: () => notReady<never>("1:1 문의"),
  // TODO(ax-backend#385): 후기
  reviews: (_productId: string) => notReady<never>("구매 후기"),
};
