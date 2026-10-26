import { Link, usePathname } from "@/lib/nav";
import type { ReactNode } from "react";

const MENU = [{ href: "/admin/orchestrator", label: "총괄 에이전트" }];

export function AdminLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <aside aria-label="관리자 메뉴">
        <p className="panel-title mb-2">관리자</p>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${path.startsWith(m.href) ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-100"}`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 hidden text-[11px] leading-relaxed text-ink-500 md:block">개발용 관리자 모드입니다. 진짜 로그인과 역할은 사람 인증 뒤에 붙습니다.</p>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
