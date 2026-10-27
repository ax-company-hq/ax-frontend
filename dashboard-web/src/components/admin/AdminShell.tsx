import { Link } from "@/lib/nav";
import { usePathname } from "@/lib/nav";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { SHOP_WEB_URL } from "@/lib/env";
import type { Health } from "@/lib/types";
import { IconAgents, IconBell, IconBolt, IconChart, IconDashboard, IconMegaphone, IconOffice, IconPlan, IconSearch, IconShield, IconUsers } from "../icons";
import { ThemeToggle } from "../ThemeToggle";
import { IconUser } from "../icons";

const NAV = [
  { href: "/", label: "대시보드", Icon: IconDashboard },
  { href: "/orchestrator", label: "총괄", Icon: IconBolt },
  { href: "/finance", label: "재무 AI", Icon: IconShield },
  { href: "/data", label: "데이터분석 AI", Icon: IconChart },
  { href: "/hr", label: "인사 AI", Icon: IconUsers },
  { href: "/marketing", label: "마케팅 AI", Icon: IconMegaphone },
  { href: "/planning", label: "기획개발 AI", Icon: IconPlan },
  { href: "/agents/chat", label: "AI 대화방", Icon: IconAgents },
  { href: "/agents/office", label: "AI 오피스", Icon: IconOffice },
  { href: "/support", label: "고객지원 AI", Icon: IconUser },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function LogoMark() {
  return (
    <img src="/logo.png" width={34} height={34} alt="" aria-hidden="true" />
  );
}

/** Agent console frame: left icon rail + underline tabs, filling the whole window. */
export function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)); }, []);
  const mock = health?.llm_provider === "mock";

  return (
    <div className="flex h-screen overflow-hidden bg-app text-ink-900">
      <div className="flex min-w-0 flex-1 overflow-hidden bg-app">
        <nav className="flex w-[76px] shrink-0 flex-col items-center gap-2 border-r border-ink-100 py-6" aria-label="주 메뉴">
          <Link href="/" className="mb-6" aria-label="캣북스 상담원 홈"><LogoMark /></Link>
          {NAV.map(({ href, label, Icon }) => {
            const on = isActive(path, href);
            return (
              <Link key={href} href={href} title={label} aria-label={label} aria-current={on ? "page" : undefined}
                className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition ${on ? "text-brand-600" : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"}`}>
                {on && <span className="absolute -left-[16px] h-6 w-1 rounded-r bg-accent" />}
                <Icon size={20} />
              </Link>
            );
          })}
          <div className="mt-auto flex flex-col items-center gap-3"><ThemeToggle vertical /></div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[72px] shrink-0 items-center gap-6 overflow-x-auto px-8">
            <span className="mr-2 shrink-0 text-[15px] font-semibold tracking-tight">캣북스 CS</span>
            {NAV.map(({ href, label }) => {
              const on = isActive(path, href);
              return (
                <Link key={href} href={href} aria-current={on ? "page" : undefined}
                  className={`relative shrink-0 py-2 text-sm transition ${on ? "font-semibold text-ink-900" : "text-ink-500 hover:text-ink-900"}`}>
                  {label}
                  {on && <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded bg-ink-900" />}
                </Link>
              );
            })}
            <div className="ml-auto flex shrink-0 items-center gap-4 text-ink-700">
              {health && (
                <span title={mock ? "API 키 없이 오프라인 규칙으로 답변 초안을 만듭니다. 환불 판정은 항상 규칙 엔진이 합니다." : `LLM: ${health.llm_provider}`}
                  className={`chip hidden xl:inline-flex ${mock ? "bg-amber-50 text-amber-700" : "bg-brand-50 text-brand-700"}`}>답변 초안 {mock ? "mock" : health.llm_provider}</span>
              )}
              <Link href="/console" title="문의 찾기" aria-label="문의 찾기"><IconSearch size={20} /></Link>
              <IconBell size={20} />
              {/* 앱 사이 링크는 일반 <a>: Link는 http(s)가 아니면 라우터 경로로 처리해 basename(/admin) 아래에서 깨진다 */}
              <a href={SHOP_WEB_URL} className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium hover:bg-ink-100">쇼핑몰 보기 ↗</a>
            </div>
          </header>
          <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
