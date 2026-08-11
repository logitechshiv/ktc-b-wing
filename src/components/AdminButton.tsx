"use client";

import { useEffect, useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import type { SafeUser } from "@/lib/auth-client";
import { readCurrentUser } from "@/lib/auth-client";
import { CacheKeys, invalidateCache } from "@/lib/data-cache";

/** Header CTA — Admin login for guests, Logout for Super Admin */
export default function AdminButton() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void readCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const isSuperAdmin = user?.role === "super_admin";

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      invalidateCache(CacheKeys.authMe());
      window.location.assign("/");
    } catch {
      setLoggingOut(false);
    }
  }

  function openLogin() {
    window.location.assign("/login");
  }

  if (loading) {
    return (
      <span className="inline-flex h-9 min-w-[4.5rem] items-center justify-center rounded-xl bg-white/10 px-4 text-[12px] text-white/70">
        …
      </span>
    );
  }

  if (isSuperAdmin) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-[110px] truncate text-[11px] font-medium text-white/80 sm:inline">
          {user?.name?.split(" ")[0] || "Admin"}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-black px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-900 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-70 sm:px-4 sm:text-[13px]"
          aria-label="Logout"
        >
          {loggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openLogin}
      className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-black px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-900 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:px-5 sm:text-[13px]"
      aria-label="Open Super Admin Login"
    >
      Admin
    </button>
  );
}
