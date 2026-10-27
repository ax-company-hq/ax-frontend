// ax-backend shop-api(`/api/shop/*`) 응답 모양. 성공은 `{data, meta}`, 실패는 `{error: {code, message}}`.
// ID는 문자열이다: 상품 `prd_0001`, 주문 `ord_0001`, 주문 품목 `oit_0001`, 구매자 `buy_0001`.
// TODO: shop-api가 OpenAPI 타입을 열면 `npm run gen:types`의 `@ax/types/shop-api`로 바꾼다.

export interface Product {
  product_id: string; seller_id: string; name: string; category_code: string; price: number; stock: number; active: boolean;
}

export interface OrderItem {
  order_item_id: string; product_id: string; seller_id: string; title: string; qty: number; unit_price: number; points_share: number; paid_amount: number;
}
export interface Payment {
  payment_id: string; amount: number; method_code: string; status: string; failure_code: string | null; created_at: string;
}
export type OrderStatus = "pending_payment" | "payment_failed" | "paid" | "cancelled";
export interface Order {
  order_id: string; buyer_id: string; status: OrderStatus | string; total_amount: number; refunded_amount: number; shipping_fee: number; points_used: number;
  promised_delivery_at: string | null; shipped_at: string | null; delivered_at: string | null; created_at: string;
  items: OrderItem[]; payments: Payment[];
}

export interface OrderLineInput { product_id: string; qty: number }

// ---------------------------------------------------------------- claims
export type ClaimType = "cancel" | "return" | "exchange";
export type ClaimReason = "change_of_mind" | "defect" | "wrong_item" | "damaged" | "missing_item" | "late_delivery" | "other";
export type ClaimStatus = "needs_info" | "needs_review" | "awaiting_return" | "return_received" | "approved" | "completed" | "rejected";

export interface ClaimInput {
  buyer_id: string; customer_name: string; order_id: string; type: ClaimType; reason: ClaimReason;
  items?: { order_item_id: string; qty: number }[]; unsealed?: boolean; evidence_count?: number; description?: string;
}

export interface Claim {
  id: number; context_id: string; order_id: string; order_no: string; buyer_id: string; type: ClaimType; reason: ClaimReason; status: ClaimStatus;
  created_at: string; outcome: string; resolution: string; requires_return: boolean; evidence_count: number; unsealed: boolean;
  reasons: { code: string; level: "block" | "review" | "warn" | "info"; message: string; rule: string | null }[];
  lines: { order_item_id: string; title: string; qty: number; requested_qty: number; unit_price: number; refund_cash: number; points_back: number }[];
  shipping_refund: number; expected_refund: number; points_back: number; refund_paid: number; processed_at: string | null;
}
