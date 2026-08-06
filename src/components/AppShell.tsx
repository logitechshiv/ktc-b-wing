"use client";
import { usePathname } from "next/navigation";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

/** Login screens only — public dashboard keeps TopBar + BottomNav */
function isBareRoute(pathname: string) {
  if (!pathname) return false;
  return pathname === "/login" || pathname.startsWith("/login/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const bare = isBareRoute(pathname);

  if (bare) {
    return <div className="min-h-screen bg-surface dark:bg-slate-950">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950">
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
