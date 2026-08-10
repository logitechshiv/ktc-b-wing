"use client";

import { useCallback, useEffect, useState } from "react";
import type { SafeUser } from "@/lib/auth-client";
import {
  createNotice,
  deleteNotice,
  readNotices,
  updateNotice,
  type NoticeInput,
  type NoticeRecord,
} from "@/lib/notices-api";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import NoticeCard from "@/components/NoticeCard";
import NoticeModal from "@/components/notices/NoticeModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

export default function NoticesPage() {
  const [q, setQ] = useState("");
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<NoticeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<NoticeRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data.user ?? null);
      })
      .catch(() => setUser(null));
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await readNotices({ q });
      setNotices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notices");
      if (!silent) setNotices([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    return subscribeDataChanged((source) => {
      if (source === "notice" || source === "unknown") {
        void load({ silent: true });
      }
    });
  }, [load]);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 2500);
  }

  function openAdd() {
    setModalMode("add");
    setEditing(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(n: NoticeRecord) {
    setModalMode("edit");
    setEditing(n);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSave(data: NoticeInput) {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === "edit" && editing) {
        const updated = await updateNotice(editing.id, data);
        setNotices((list) => list.map((n) => (n.id === updated.id ? updated : n)));
        flashSuccess("Notice updated");
      } else {
        await createNotice(data);
        flashSuccess("Notice added");
        await load({ silent: true });
      }
      setModalOpen(false);
      setEditing(null);
      notifyDataChanged("notice");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Unable to save notice");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget?.id || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const removedId = deleteTarget.id;
      await deleteNotice(removedId);
      setDeleteTarget(null);
      setNotices((list) => list.filter((n) => n.id !== removedId));
      if (openId === removedId) setOpenId(null);
      flashSuccess("Notice deleted");
      notifyDataChanged("notice");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete this record. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-navy">Notices</h1>
          <p className="mt-0.5 text-xs text-slate-500">B-Wing announcements · newest first</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-black px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-900 active:scale-[0.98] sm:px-4 sm:text-[13px]"
          >
            + Add Notice
          </button>
        )}
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notices"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading notices…</p>
        ) : (
          <>
            {notices.map((n) => (
              <div key={n.id} className="space-y-2">
                <NoticeCard
                  notice={n}
                  expanded={openId === n.id}
                  onToggle={() => setOpenId((cur) => (cur === n.id ? null : n.id))}
                />
                {isSuperAdmin && (
                  <div className="flex justify-end gap-2 px-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(n)}
                      className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(n);
                      }}
                      className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {notices.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">
                {q.trim() ? "No notices match your search." : "હાલમાં કોઈ નવી સૂચના નથી."}
              </p>
            )}
          </>
        )}
      </div>

      <NoticeModal
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        saving={saving}
        error={modalError}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setModalError(null);
        }}
        onSubmit={handleSave}
      />

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete Notice?"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
      >
        <p>Are you sure you want to delete this notice?</p>
        {deleteTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">Notice:</span>{" "}
            <span className="font-bold">{deleteTarget.title}</span>
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">This action cannot be undone.</p>
      </ConfirmDeleteModal>
    </div>
  );
}
