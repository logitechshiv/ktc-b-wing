"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationsForEveryone,
  type UserNotification,
} from "@/lib/notifications-api";
import { subscribeDataChanged } from "@/lib/data-sync";

function formatWhen(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      // Same cache key as /notifications (limit 100) — avoids a duplicate bootstrap fetch
      const data = await readNotificationsForEveryone({
        limit: 100,
        status: "all",
        force,
      });
      setAuthenticated(data.authenticated);
      setUnreadCount(data.unreadCount);
      setItems(data.notifications.slice(0, 12));
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    const unsub = subscribeDataChanged(() => {
      void refresh(true);
    });
    const poll = window.setInterval(() => {
      void refresh(true);
    }, 25000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    if (open) void refresh(false);
  }, [open, refresh]);

  useEffect(() => {
    function onDoc(e: globalThis.MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /** Same destination for Admin + User/guest — never role-gated. */
  function goToNotificationsInbox() {
    setOpen(false);
    router.push("/notifications");
  }

  /**
   * Card click works for every viewer (Super Admin, logged-in User, guest).
   * Navigate first; mark-read runs in background so UI re-renders cannot cancel nav.
   */
  function handleItemClick(n: UserNotification) {
    const shouldMark = !n.isRead;
    const id = n.id;
    const isAuth = authenticated;

    goToNotificationsInbox();

    if (shouldMark) {
      void markNotificationRead(id, isAuth).catch(() => {
        /* navigation already started */
      });
    }
  }

  function handleViewAll() {
    goToNotificationsInbox();
  }

  async function handleMarkAll() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const count = await markAllNotificationsRead(
        authenticated,
        items.map((n) => n.id)
      );
      setUnreadCount(count);
      setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false);
    }
  }

  const badge =
    unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null;
  const unreadItems = items.filter((n) => !n.isRead);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.25} />
        {!loading && badge && (
          <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          className={
            "z-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 " +
            "fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+3.75rem)] max-h-[min(28rem,calc(100dvh-6.5rem))] " +
            "sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] sm:max-w-[min(22rem,calc(100vw-1.5rem))]"
          }
        >
          {loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : unreadCount === 0 ? (
            <p className="break-words px-4 py-8 text-center text-sm leading-relaxed text-slate-400">
              કોઈ નવી એન્ટ્રી નથી
            </p>
          ) : (
            <div className="flex max-h-[min(28rem,calc(100dvh-6.5rem))] flex-col sm:max-h-[min(24rem,70vh)]">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-700">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-navy dark:text-slate-50">Notifications</div>
                  <div className="text-[10px] text-slate-400">{unreadCount} unread</div>
                </div>
                <button
                  type="button"
                  disabled={markingAll}
                  onClick={() => void handleMarkAll()}
                  className="shrink-0 text-[11px] font-semibold text-brand disabled:opacity-40"
                >
                  {markingAll ? "Updating…" : "Mark all as read"}
                </button>
              </div>

              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {unreadItems.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className="flex w-full cursor-pointer gap-2.5 border-b border-slate-50 bg-brand/[0.04] px-3.5 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <span
                        className="pointer-events-none mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                        aria-hidden
                      />
                      <span className="pointer-events-none min-w-0 flex-1 overflow-hidden">
                        <span className="block break-words text-[12px] font-bold text-navy dark:text-slate-100">
                          {n.title}
                        </span>
                        <span className="mt-0.5 block break-words text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {n.message}
                        </span>
                        <span className="mt-1 block text-[10px] tabular-nums text-slate-400">
                          {formatWhen(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="shrink-0 border-t border-slate-100 px-3.5 py-2.5 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleViewAll}
                  className="block w-full cursor-pointer text-center text-[12px] font-semibold text-brand hover:underline"
                >
                  View All
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
