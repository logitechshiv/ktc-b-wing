"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { readCurrentUser, type SafeUser } from "@/lib/auth-client";
import { formatPhone } from "@/lib/format";
import {
  createImportantNumber,
  deleteImportantNumber,
  readImportantNumbers,
  updateImportantNumber,
  type ImportantNumberInput,
  type ImportantNumberRecord,
} from "@/lib/important-numbers-api";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import { CacheKeys, peekCache } from "@/lib/data-cache";
import ImportantNumberModal from "@/components/important-numbers/ImportantNumberModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

function PhoneIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.85 21 3 13.15 3 3a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.02l-2.2 2.19z" />
    </svg>
  );
}

function CopyIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:${digits}` : undefined;
}

function PhoneNumberBadge({
  phone,
  href,
  onCopied,
}: {
  phone: string;
  href?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const label = formatPhone(phone);
  const digits = phone.replace(/\D/g, "");

  async function handleCopy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!digits) return;
    try {
      await navigator.clipboard.writeText(digits);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = digits;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-600/80 bg-[#1e293b] py-1.5 pl-3 pr-1.5 text-[13px] font-bold text-white shadow-sm dark:border-slate-500 dark:bg-slate-800">
      {href ? (
        <a
          href={href}
          className="inline-flex min-w-0 items-center gap-2 transition hover:opacity-90"
          aria-label={`Call ${label}`}
        >
          <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-rose-500" />
          <span className="truncate tabular-nums tracking-wide">{label}</span>
        </a>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-2">
          <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-rose-500" />
          <span className="truncate tabular-nums tracking-wide">{label}</span>
        </span>
      )}
      <button
        type="button"
        onClick={(e) => void handleCopy(e)}
        title={copied ? "Copied" : "Copy number"}
        aria-label={copied ? "Copied" : `Copy ${label}`}
        className={
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition " +
          (copied
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white")
        }
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

export default function ImportantNumbersPage() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const [items, setItems] = useState<ImportantNumberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<ImportantNumberRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ImportantNumberRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void readCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }) => {
      const silent = !!opts?.silent;
      const force = !!opts?.force;
      const all = isSuperAdmin;

      if (!force) {
        const cached = peekCache<ImportantNumberRecord[]>(CacheKeys.importantNumbers(all));
        if (cached) {
          setItems(cached);
          setError(null);
          setLoading(false);
          return;
        }
      }

      if (!silent) setLoading(true);
      setError(null);
      try {
        const list = await readImportantNumbers({ all, force });
        setItems(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load important numbers");
        if (!silent) setItems([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isSuperAdmin]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeDataChanged((source) => {
      if (source === "important_number" || source === "unknown") {
        void load({ silent: true, force: true });
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

  function openEdit(row: ImportantNumberRecord) {
    setModalMode("edit");
    setEditing(row);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSave(data: ImportantNumberInput) {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === "edit") {
        if (!editing?.id) {
          throw new Error("Missing id — cannot update. Re-open Edit and try again.");
        }
        await updateImportantNumber(editing.id, data);
        flashSuccess("Important number updated");
      } else {
        await createImportantNumber(data);
        flashSuccess("Important number added");
      }
      setModalOpen(false);
      setModalMode("add");
      setEditing(null);
      notifyDataChanged("important_number");
      await load({ silent: true, force: true });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Unable to save");
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
      await deleteImportantNumber(removedId);
      setDeleteTarget(null);
      setItems((list) => list.filter((n) => n.id !== removedId));
      flashSuccess("Important number deleted");
      notifyDataChanged("important_number");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete this record. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  const publicList = useMemo(
    () =>
      items
        .filter((n) => n.isActive)
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (ta !== tb) return ta - tb;
          return a.id.localeCompare(b.id);
        }),
    [items]
  );

  const managementList = useMemo(
    () =>
      [...items].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
      }),
    [items]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-navy">જરૂરી નંબરો</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            સોસાયટીના જરૂરી સંપર્ક નંબર
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-black px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-900 active:scale-[0.98] sm:px-4 sm:text-[13px]"
          >
            + નંબર ઉમેરો
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {success}
        </p>
      )}

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-[22px] bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80">
            લોડ થઈ રહ્યું છે…
          </div>
        ) : publicList.length === 0 ? (
          <div className="rounded-[22px] bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80">
            કોઈ જરૂરી નંબરો ઉપલબ્ધ નથી
          </div>
        ) : (
          <ul className="space-y-3">
            {publicList.map((row) => {
              const href = telHref(row.phone);
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold leading-snug text-navy">
                      {row.name}
                    </div>
                    {row.description ? (
                      <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                  {row.phone ? (
                    <PhoneNumberBadge
                      phone={row.phone}
                      href={href}
                      onCopied={() => flashSuccess("નંબર કોપી થઈ ગયો")}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isSuperAdmin ? (
        <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-bold text-navy">જરૂરી નંબરો</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                સંપર્ક ઉમેરો, સુધારો અથવા કાઢો · ફક્ત એડમિન
              </p>
            </div>
          </div>

          {managementList.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              હજુ કોઈ રેકોર્ડ નથી. ઉપરથી ઉમેરો.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-2 py-2 font-semibold">Name</th>
                    <th className="px-2 py-2 font-semibold">Phone</th>
                    <th className="px-2 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {managementList.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-2 py-3">
                        <div className="font-semibold text-navy">{row.name}</div>
                        {row.description ? (
                          <div className="mt-0.5 max-w-[280px] text-[11px] text-slate-400 line-clamp-2">
                            {row.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 tabular-nums text-slate-700">
                        {formatPhone(row.phone)}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(row);
                            }}
                            className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <ImportantNumberModal
        open={modalOpen && isSuperAdmin}
        mode={modalMode}
        initial={editing}
        saving={saving}
        error={modalError}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
          setModalError(null);
        }}
        onSubmit={handleSave}
      />

      <ConfirmDeleteModal
        open={!!deleteTarget && isSuperAdmin}
        title="Delete Important Number?"
        itemName={deleteTarget?.name}
        message="Are you sure you want to delete this important number"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
