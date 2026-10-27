import { useRouter } from "@/lib/nav";
import { NotReady, PageTitle } from "@/components/shop/bits";
import { BUYER_IDS } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, logout, user } = useAuth();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="구매자 선택" sub="판매 서버(shop-api)에는 로그인이 없고 구매자 가명 ID만 있습니다. 한 명을 골라 주문과 환불 신청을 해 볼 수 있습니다." />
      {/* TODO(ax-backend#385): 이름·적립금이 있는 데모 로그인이 생기면 api.demoUsers로 이 목록을 바꾼다 */}
      <div className="mb-4"><NotReady feature="이름·적립금이 있는 데모 로그인" /></div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {BUYER_IDS.map((id) => (
          <li key={id}>
            <button onClick={() => { login(id); router.push("/orders"); }} aria-pressed={user?.id === id}
              className={`w-full rounded-xl border bg-surface p-3 text-left font-mono text-sm transition hover:border-brand-500 ${user?.id === id ? "border-brand-600" : "border-ink-100"}`}>
              {id}
            </button>
          </li>
        ))}
      </ul>
      {user && <button className="btn-ghost mt-4 text-sm" onClick={logout}>선택 해제</button>}
    </div>
  );
}
