"use client";
import Link from "next/link";
import Chevron from "./Chevron";
import RoleSwitcher from "./RoleSwitcher";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-30 text-white">
      <div className="bg-gradient-to-r from-[#063A6B] via-navy to-brand shadow-[0_8px_24px_rgba(10,76,134,0.28)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 transition group-hover:bg-white/20">
              <Chevron className="h-6 w-5 text-white" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-extrabold tracking-tight sm:text-[16px]">
                B-Wing <span className="font-semibold text-white/55">-</span> Management System
              </div>
              <div className="mt-1 truncate text-[10px] font-medium tracking-[0.06em] text-white/70 sm:mt-1.5 sm:tracking-[0.1em]">
                Kiran Classic Tower - 3
              </div>
            </div>
          </Link>
          <RoleSwitcher />
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>
    </header>
  );
}
