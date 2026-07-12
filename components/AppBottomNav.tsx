"use client";

import Link from "next/link";
import { Bell, House, List } from "lucide-react";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/app/announcements", label: "전체공고", icon: List },
  { href: "/app", label: "홈", icon: House },
  { href: "/app/alerts", label: "내 알림", icon: Bell },
] as const;

export default function AppBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[calc(3.5rem+env(safe-area-inset-bottom))] max-w-md items-stretch border-t border-line bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="앱 하단 메뉴"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              active ? "text-primary" : "text-slate-500"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
