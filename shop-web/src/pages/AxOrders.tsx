import { useEffect, useState } from "react";
import { Link } from "@/lib/nav";
import { AxClaimDialog, axClaimTypes } from "@/components/shop/AxClaimDialog";
import { AxClaimStatusBadge, AxClaimSummary } from "@/components/shop/AxClaimSummary";
import { Empty, ErrorNote, PageTitle } from "@/components/shop/bits";
import { BUYER_IDS, axShop, storeBuyer, storedBuyer, type AxClaim, type AxOrder } from "@/lib/axShop";
import { dateStr, shortDateTime, won } from "@/lib/format";
import { CLAIM_REASON_KO, CLAIM_TYPE_KO } from "@/lib/labels";

const STATUS_KO: Record<string, string> = {
  pending_payment: "결제 대기", payment_failed: "결제 실패", paid: "결제 완료", cancelled: "취소됨",
};

/** ax-backend shop-api 주문과 클레임 신청(고객 → 고객지원 → 재무). 철회·사진 추가·미리보기·내역 조회는 shop-api에 아직 없다. */
export default function AxOrdersPage() {
  const [buyer, setBuyer] = useState<string>(() => storedBuyer() ?? "");
  const [orders, setOrders] = useState<AxOrder[] | null>(null);
  const [claims, setClaims] = useState<Record<string, AxClaim[]>>({});
  const [target, setTarget] = useState<AxOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!buyer) return;
    let live = true;
    axShop.orders(buyer)
      .then((o) => { if (live) { setOrders(o); setError(null); } })
      .catch((e: Error) => { if (live) { setOrders(null); setError(e.message); } });
    return () => { live = false; };
  }, [buyer]);

  function pick(id: string) {
    setBuyer(id);
    storeBuyer(id || null);
    setClaims({});
    setOrders(null);
    setError(null);
  }

  function done(c: AxClaim) {
    setClaims((m) => ({ ...m, [c.order_id]: [c, ...(m[c.order_id] ?? [])] }));
    axShop.orders(buyer).then(setOrders).catch(() => undefined);
  }

  const shown = buyer ? orders : null;
  return (
    <div>
      <PageTitle title="ax 주문·신청" sub="ax-backend 쇼핑몰(shop-api)의 주문입니다. 신청은 고객지원 → 안전 → 재무로 이어집니다." right={<Link href="/orders" className="btn-ghost text-sm">기존 주문·배송</Link>} />
      <label className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-xs font-semibold text-ink-500">구매자 (데모)</span>
        <select className="field w-44" value={buyer} onChange={(e) => pick(e.target.value)} aria-label="구매자 선택">
          <option value="">선택하세요</option>
          {BUYER_IDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <ErrorNote error={error} />
      {!buyer && <Empty>구매자를 고르면 주문이 보입니다.</Empty>}
      {shown && shown.length === 0 && <Empty>이 구매자의 주문이 없습니다.</Empty>}
      <ul className="space-y-4">
        {(shown ?? []).map((o) => (
          <li key={o.order_id} className="rounded-xl border border-ink-100 bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{o.order_id}</span>
              <span className="chip bg-ink-100 text-ink-700">{STATUS_KO[o.status] ?? o.status}</span>
              <span className="text-xs text-ink-500">{dateStr(o.created_at)} 주문{o.delivered_at && ` · ${dateStr(o.delivered_at)} 도착`}</span>
              {axClaimTypes(o).length > 0 && <button className="btn-ghost ml-auto py-1 text-xs" onClick={() => setTarget(o)}>{o.delivered_at ? "반품·교환 신청" : "취소 신청"}</button>}
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {o.items.map((i) => (
                <li key={i.order_item_id} className="flex justify-between gap-2"><span className="min-w-0 truncate">{i.title} × {i.qty}</span><span className="tabular-nums text-ink-500">{won(i.paid_amount)}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-right text-xs text-ink-500">
              배송비 {won(o.shipping_fee)} · 적립금 −{won(o.points_used)} · 결제 <b className="text-ink-900">{won(o.total_amount)}</b>
              {o.refunded_amount > 0 && <span className="ml-1 text-red-700">· 환불 {won(o.refunded_amount)}</span>}
            </p>
            {(claims[o.order_id] ?? []).map((c) => (
              <div key={c.id} className="mt-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <AxClaimStatusBadge status={c.status} />
                  <span className="text-sm font-semibold">{CLAIM_TYPE_KO[c.type]} · {CLAIM_REASON_KO[c.reason]}</span>
                  <span className="text-xs text-ink-500">#{c.id} · {shortDateTime(c.created_at)}</span>
                </div>
                <AxClaimSummary c={c} />
              </div>
            ))}
          </li>
        ))}
      </ul>
      {Object.values(claims).some((l) => l.length > 0) && <p className="mt-4 text-[11px] text-ink-500">방금 낸 신청만 표시됩니다. 새로고침하면 사라집니다(shop-api에 신청 내역 조회가 아직 없음).</p>}
      {target && <AxClaimDialog order={target} onClose={() => setTarget(null)} onDone={done} />}
    </div>
  );
}
