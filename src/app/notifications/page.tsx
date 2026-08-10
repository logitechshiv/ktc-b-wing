"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth-client";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationRoute,
  readNotificationsForEveryone,
  type UserNotification,
} from "@/lib/notifications-api";
import { subscribeDataChanged, notifyDataChanged } from "@/lib/data-sync";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

type StatusFilter = "all" | "unread" | "read";

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

export default function NotificationsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserNotification | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setIsSuperAdmin(false);
          return;
        }
        const data = await res.json();
        const user = (data.user ?? null) as SafeUser | null;
        setIsSuperAdmin(user?.role === "super_admin");
      })
      .catch(() => setIsSuperAdmin(false));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await readNotificationsForEveryone({ limit: 100, status });
      setAuthenticated(data.authenticated);
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeDataChanged(() => {
      void load();
    });
  }, [load]);

  function onOpen(n: UserNotification) {
    const href = resolveNotificationRoute(n);
    const destination =
      !href || href === "/notifications" || href.startsWith("/notifications/")
        ? "/"
        : href;

    if (!n.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((row) =>
          row.id === n.id
            ? { ...row, isRead: true, readAt: new Date().toISOString() }
            : row
        )
      );
      void markNotificationRead(n.id, authenticated)
        .then((result) => setUnreadCount(result.unreadCount))
        .catch(() => {
          /* still navigate */
        });
    }

    window.location.assign(destination);
  }

  async function onMarkAll() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const count = await markAllNotificationsRead(
        authenticated,
        items.map((n) => n.id)
      );
      setUnreadCount(count);
      if (status === "unread") {
        setItems([]);
      } else {
        setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !isSuperAdmin) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteNotification(deleteTarget.id);
      setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      setDeleteTarget(null);
      notifyDataChanged("unknown");
      void load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unable to delete notification");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-navy">Notifications</h1>
          <p className="text-[11px] text-slate-400">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <button
          type="button"
          disabled={markingAll || unreadCount === 0}
          onClick={() => void onMarkAll()}
          className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-[11px] font-semibold text-brand disabled:opacity-40"
        >
          {markingAll ? "Updating…" : "Mark all as read"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all" as const, label: "All" },
            { id: "unread" as const, label: "Unread" },
            { id: "read" as const, label: "Read" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setStatus(opt.id)}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium transition " +
              (status === opt.id
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-500")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600"
        >
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">No notifications</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id} className={!n.isRead ? "bg-brand/[0.03]" : undefined}>
                <div className="flex items-start gap-2 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => void onOpen(n)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "h-2 w-2 shrink-0 rounded-full " +
                          (!n.isRead ? "bg-brand" : "bg-slate-200")
                        }
                        aria-hidden
                      />
                      <span
                        className={
                          "text-sm text-navy " + (!n.isRead ? "font-bold" : "font-semibold")
                        }
                      >
                        {n.title}
                      </span>
                    </div>
                    <p className="mt-1 pl-4 text-xs leading-relaxed text-slate-500">{n.message}</p>
                    <p className="mt-1 pl-4 text-[10px] tabular-nums text-slate-400">
                      {formatWhen(n.createdAt)}
                    </p>
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(n);
                      }}
                      className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete Notification?"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      >
        <p>Are you sure you want to delete this record?</p>
        {deleteTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">{deleteTarget.title}</span>
            <br />
            <span className="text-xs text-slate-500">{deleteTarget.message}</span>
          </p>
        ) : null}
      </ConfirmDeleteModal>
    </div>
  );
}
