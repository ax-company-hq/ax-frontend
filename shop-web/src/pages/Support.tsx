import { Link } from "@/lib/nav";
import { NotReady, PageTitle } from "@/components/shop/bits";

// TODO(ax-backend#385): 1:1 문의 API(api.inquiries)가 생기면 문의 목록·작성·답변 화면을 연결한다.
export default function SupportPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="고객센터" sub="취소·반품·교환은 주문 상세에서 바로 신청할 수 있습니다." />
      <NotReady feature="1:1 문의" />
      <p className="mt-4 text-sm text-ink-500">주문과 관련한 신청은 <Link href="/orders" className="font-semibold text-brand-600 underline">주문·배송</Link>에서 하세요.</p>
    </div>
  );
}
