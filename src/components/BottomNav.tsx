"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const tabs: { href: string; label: string; icon: (active: boolean) => ReactNode }[] = [
  {
    href: "/",
    label: "Home",
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2.25 : 1.75}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/flats",
    label: "Flats",
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2.25 : 1.75}>
        <path d="M4 21V7l8-4 8 4v14" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/collections",
    label: "Collect",
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2.25 : 1.75}>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2.25 : 1.75}>
        <path d="M12 21V9m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/vehicles",
    label: "Vehicles",
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2.25 : 1.75}>
        <path
          d="M3 13.5 5.5 8.2A2 2 0 0 1 7.3 7h9.4a2 2 0 0 1 1.8 1.2L21 13.5M5 17.5h.01M19 17.5h.01"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M3 13.5h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/more",
    label: "More",
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2.25 : 1.75}>
        <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const path = usePathname() ?? "";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(15,40,80,0.08)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-[0_-8px_30px_rgba(0,0,0,0.45)]">
        <div className="mx-auto grid max-w-3xl grid-cols-6 px-1">
          {tabs.map((t) => {
            const active =
              t.href === "/"
                ? path === "/" || path === "/dashboard"
                : path === t.href || path.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] transition sm:text-[11px] " +
                  (active
                    ? "text-brand"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300")
                }
              >
                {active && (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand" aria-hidden />
                )}
                <span
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-xl transition " +
                    (active ? "bg-brand/10 text-brand" : "text-slate-400 dark:text-slate-500")
                  }
                >
                  {t.icon(active)}
                </span>
                <span className={"leading-none " + (active ? "font-semibold" : "font-medium")}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
