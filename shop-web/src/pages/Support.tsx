import { Link, useSearchParams } from "@/lib/nav";
import { NotReady, PageTitle } from "@/components/shop/bits";

// TODO(ax-backend#385): 1:1 문의 API(api.inquiries)가 생기면 문의 목록·작성·답변 화면을 연결한다.
export default function SupportPage() {
  // 결제 실패 화면 등에서 넘어온 주문 번호. 문의 API가 생길 때까지는 화면에 보여 주기만 한다.
  const orderId = useSearchParams().get("order_id");
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="고객센터" sub="취소·반품·교환은 주문 상세에서 바로 신청할 수 있습니다." />
      {orderId && (
        <p className="mb-3 rounded-lg bg-ink-100 px-3 py-2 text-sm">문의할 주문: <Link href={`/orders/${encodeURIComponent(orderId)}`} className="font-mono font-semibold underline">{orderId}</Link></p>
      )}
      <NotReady feature="1:1 문의" />
      <p className="mt-4 text-sm text-ink-500">주문과 관련한 신청은 <Link href="/orders" className="font-semibold text-brand-600 underline">주문·배송</Link>에서 하세요.</p>
    </div>
  );
}
