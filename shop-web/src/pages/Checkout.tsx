import { Link } from "@/lib/nav";
import { useRouter } from "@/lib/nav";
import { useRef, useState } from "react";
import { Empty, ErrorNote, NotReady, PageTitle, RequireLogin } from "@/components/shop/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { won } from "@/lib/format";

export default function CheckoutPage() {
  const { user, ready } = useAuth();
  const cart = useCart();
  const router = useRouter();
  const [method, setMethod] = useState("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false); // 연속 클릭으로 주문이 두 번 만들어지지 않게 하는 플래그
  const subtotal = cart.lines.reduce((n, l) => n + l.price * l.qty, 0);

  // 주문 생성(pending_payment) → 가짜 결제. 합계·배송비는 서버 응답이 정한다.
  async function submit() {
    if (!user || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      const order = await api.placeOrder({ buyer_id: user.id, items: cart.lines.map((l) => ({ product_id: l.id, qty: l.qty })) });
      cart.clear();
      // 결제가 실패해도 주문은 만들어졌다: 주문 상세에서 상태를 보고 다시 결제한다.
      await api.pay(order.order_id, method).catch(() => undefined);
      router.push(`/orders/${order.order_id}?placed=1`);
    } catch (e) {
      setError((e as Error).message);
      inflight.current = false;
      setBusy(false);
    }
  }

  return (
    <RequireLogin user={user} ready={ready}>
      <PageTitle title="주문·결제" />
      {!cart.lines.length ? <Empty>주문할 상품이 없습니다. <Link href="/products" className="font-semibold text-brand-600 underline">상품 보러 가기</Link></Empty> : (
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="rounded-xl border border-ink-100 bg-surface p-5">
              <h2 className="mb-3 text-sm font-bold">구매자</h2>
              <p className="font-mono text-sm">{user?.id}</p>
              {/* TODO(ax-backend#385): 받는 분·주소 입력은 shop-api 주문에 해당 필드가 생기면 추가한다 */}
            </section>
            <section className="rounded-xl border border-ink-100 bg-surface p-5">
              <h2 className="mb-3 text-sm font-bold">주문 상품</h2>
              <ul className="divide-y divide-ink-100 text-sm">
                {cart.lines.map((l) => <li key={l.id} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{l.title} × {l.qty}</span><span className="tabular-nums">{won(l.price * l.qty)}</span></li>)}
              </ul>
            </section>
            <section className="rounded-xl border border-ink-100 bg-surface p-5">
              <h2 className="mb-3 text-sm font-bold">결제 수단 (데모)</h2>
              <div className="flex flex-wrap gap-2">
                {[["card", "카드"], ["transfer", "계좌이체"], ["easy_pay", "간편결제"]].map(([k, l]) => (
                  <button key={k} onClick={() => setMethod(k)} aria-pressed={method === k}
                    className={`chip py-2 text-sm ${method === k ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700"}`}>{l}</button>
                ))}
              </div>
              {/* TODO(ax-backend#385): 적립금 보유액 조회가 생기면 points_used 입력을 붙인다 */}
              <p className="mt-4 text-xs text-ink-500">적립금 사용은 준비 중입니다.</p>
            </section>
          </div>
          <aside className="h-fit rounded-xl border border-ink-100 bg-surface p-5 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-ink-500">상품 금액</dt><dd className="tabular-nums">{won(subtotal)}</dd></div>
            </dl>
            <div className="mt-3"><NotReady feature="배송비·최종 결제 금액 미리보기" /></div>
            <ErrorNote error={error} />
            <button className="btn-primary mt-4 w-full py-3" disabled={busy} onClick={submit}>{busy ? "결제 중…" : "주문하고 결제하기"}</button>
            <p className="mt-2 text-[11px] text-ink-500">데모라 실제 결제는 일어나지 않습니다. 최종 금액과 영수증은 주문 상세에서 확인할 수 있어요.</p>
          </aside>
        </div>
      )}
    </RequireLogin>
  );
}
