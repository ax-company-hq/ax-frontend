import { Link } from "@/lib/nav";
import { useEffect, type ReactNode } from "react";
import { hueOf, won } from "@/lib/format";
import { categoryLabel } from "@/lib/labels";
import type { Product } from "@/lib/types";
import { Cover } from "./Cover";

export function Price({ amount, big = false }: { amount: number; big?: boolean }) {
  return <span className={`font-bold tabular-nums ${big ? "text-2xl" : "text-base"}`}>{won(amount)}</span>;
}

export function ProductCard({ p }: { p: Product }) {
  const soldOut = p.stock <= 0;
  return (
    <Link href={`/products/${p.product_id}`} className="group flex w-full flex-col gap-2">
      <div className="relative rounded-md bg-surface-2 p-4 transition group-hover:bg-ink-100">
        <Cover title={p.name} hue={hueOf(p.product_id)} category={p.category_code} className="mx-auto max-w-[170px]" />
        {soldOut && <span className="absolute left-2 top-2 chip bg-ink-900 text-surface">일시품절</span>}
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 break-keep text-sm font-semibold leading-snug group-hover:underline">{p.name}</h3>
        <p className="mt-0.5 truncate text-xs text-ink-500">{categoryLabel(p.category_code)}</p>
        <div className="mt-1.5"><Price amount={p.price} /></div>
      </div>
    </Link>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl ${wide ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-quiet px-2 py-1" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
      </div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-ink-300 px-4 py-12 text-center text-sm text-ink-500">{children}</div>;
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</p>;
}

export function RequireLogin({ children, user, ready }: { children: ReactNode; user: unknown; ready: boolean }) {
  if (!ready) return <div className="py-20 text-center text-sm text-ink-500">불러오는 중…</div>;
  if (!user) {
    return (
      <Empty>
        구매자를 먼저 선택해 주세요. <Link href="/login" className="font-semibold text-brand-600 underline">구매자 선택</Link>
      </Empty>
    );
  }
  return <>{children}</>;
}

/** shop-api에 아직 없는 기능을 오류 대신 안내로 막는다. TODO(ax-backend#385)로 연결할 자리. */
export function NotReady({ feature, children }: { feature: string; children?: ReactNode }) {
  return (
    <div role="note" className="rounded-xl border border-dashed border-ink-300 bg-surface-2 px-4 py-6 text-center text-sm text-ink-500">
      <p className="font-semibold text-ink-700">{feature} — 준비 중입니다</p>
      <p className="mt-1 text-xs">판매 서버(shop-api)에 아직 없는 기능이라 열리면 이 자리에 연결됩니다.</p>
      {children}
    </div>
  );
}
