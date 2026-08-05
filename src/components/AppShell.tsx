"use client";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
