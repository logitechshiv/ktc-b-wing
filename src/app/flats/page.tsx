"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPhone } from "@/lib/format";
import { readCurrentUser, type SafeUser } from "@/lib/auth-client";
import {
  createFlat,
  deleteFlat,
  readFlats,
  updateFlat,
  type FlatInput,
  type FlatRecord,
  type FlatStatus,
  type FloorGroup,
} from "@/lib/flats-api";
import { CacheKeys, peekCache, setCache } from "@/lib/data-cache";
import { notifyDataChanged } from "@/lib/data-sync";
import PlotDetailsModal from "@/components/flats/PlotDetailsModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

function flatsCacheKey(q: string, status: FlatStatus | "all") {
  return CacheKeys.flats(q.trim(), status);
}

const BADGE_COLORS = [
  "bg-sky-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-fuchsia-500",
  "bg-indigo-500",
];

function badgeColor(flatNumber: string, floorNumber: number) {
  const unit = Number(flatNumber) % 100 || 1;
  return BADGE_COLORS[(floorNumber * 4 + unit - 1) % BADGE_COLORS.length];
}

function statusLabel(status: FlatStatus) {
  if (status === "sold") return "Sold";
  if (status === "rent") return "Rent";
  return "Unsold";
}

export default function FlatsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<FlatStatus | "all">("all");
  const initialCached = peekCache<FloorGroup[]>(flatsCacheKey("", "all"));
  const [floors, setFloors] = useState<FloorGroup[]>(initialCached ?? []);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<FlatRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FlatRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void readCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    const silent = !!opts?.silent;
    const force = !!opts?.force;
    if (!force) {
      const cached = peekCache<FloorGroup[]>(flatsCacheKey(q, status));
      if (cached) {
        setFloors(cached);
        setError(null);
        setLoading(false);
        return;
      }
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await readFlats({ q, status, force });
      setFloors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load flats");
      if (!silent) setFloors([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    // Warm cache: show instantly. Cold cache: debounce search typing only.
    if (peekCache(flatsCacheKey(q, status))) {
      void load();
      return;
    }
    const t = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(t);
  }, [load, q, status]);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 2500);
  }

  /** Update one flat in place — no list remount / no scroll jump. */
  function patchFlatInPlace(updated: FlatRecord) {
    setFloors((prev) => {
      const next = prev.map((floor) => {
        if (floor.floorNumber !== updated.floorNumber) return floor;
        const flats = floor.flats.map((f) => (f.id === updated.id ? { ...f, ...updated } : f));
        let sold = 0;
        let rent = 0;
        let available = 0;
        for (const f of flats) {
          if (f.status === "sold") sold += 1;
          else if (f.status === "rent") rent += 1;
          else available += 1;
        }
        return {
          ...floor,
          flats,
          sold,
          rent,
          available,
          total: flats.length,
        };
      });
      setCache(flatsCacheKey(q, status), next);
      return next;
    });
  }

  /** Keep scroll where it was; ensure the edited flat stays visible. */
  function restoreScrollAfterEdit(flatId: string, scrollY: number) {
    const apply = () => {
      window.scrollTo({ top: scrollY });
      const el = document.getElementById(`flat-card-${flatId}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 72;
      const fullyVisible = rect.top >= margin && rect.bottom <= window.innerHeight - 16;
      if (!fullyVisible) {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
    window.setTimeout(apply, 0);
    window.setTimeout(apply, 40);
  }

  async function copyPhone(key: string, phone: string) {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      /* ignore */
    }
  }

  function openAdd() {
    setModalMode("add");
    setEditing(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(flat: FlatRecord) {
    setModalMode("edit");
    setEditing(flat);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSave(data: FlatInput) {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === "edit") {
        if (!editing?.id) {
          throw new Error("Missing flat id — cannot update");
        }
        const editedId = editing.id;
        const scrollY = window.scrollY;
        const updated = await updateFlat(editedId, {
          ...data,
          // Identity locked to the open card — never change floor/flat on edit
          floorNumber: editing.floorNumber,
          flatNumber: editing.flatNumber,
        });
        setModalOpen(false);
        setEditing(null);
        patchFlatInPlace(updated);
        flashSuccess("Plot details updated");
        restoreScrollAfterEdit(editedId, scrollY);
        notifyDataChanged("flat");
        // notify clears flats cache — re-warm with the patched list for instant remount
        setFloors((prev) => {
          setCache(flatsCacheKey(q, status), prev);
          return prev;
        });
      } else {
        const flatNo = String(data.flatNumber ?? "").trim();
        const duplicate = floors.some((floor) =>
          floor.flats.some((f) => f.flatNumber === flatNo)
        );
        if (duplicate) {
          throw new Error("Flat No. already exists.");
        }
        await createFlat(data);
        flashSuccess("Plot details saved");
        setModalOpen(false);
        setEditing(null);
        notifyDataChanged("flat");
        await load({ force: true });
      }
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
      await deleteFlat(deleteTarget.id);
      setDeleteTarget(null);
      flashSuccess("Flat details removed — card kept as Unsold");
      notifyDataChanged("flat");
      await load({ force: true });
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
          <h1 className="text-lg font-bold text-navy">Flats</h1>
          <p className="mt-0.5 text-xs text-slate-500">13 floors · 4 flats each · B-Wing registry</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-black px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-900 active:scale-[0.98] sm:px-4 sm:text-[13px]"
          >
            + Add Plot Details
          </button>
        )}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search flat, owner, renter or phone"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

      <div className="flex gap-2 overflow-x-auto pb-0.5 text-xs">
        {(["all", "available", "sold", "rent"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={
              "shrink-0 rounded-full border px-3 py-1 font-medium capitalize transition " +
              (status === s ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-500")
            }
          >
            {s === "all" ? "All" : statusLabel(s)}
          </button>
        ))}
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
          {error}
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-slate-400">Loading flats…</p>}

      {!loading &&
        floors.map((floor) => (
          <section
            key={floor.floorNumber}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 21V8l8-5 8 5v13" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold text-navy">Floor {floor.floorNumber}</div>
                <div className="text-xs text-slate-400">
                  {floor.total} Flats · {floor.sold} Sold · {floor.rent} On Rent · {floor.available} Unsold
                </div>
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {floor.flats.map((f) => {
                const available = f.status === "available";
                const onRent = f.status === "rent";
                const sold = f.status === "sold" || onRent;
                const hasOwner = !!(f.ownerName || f.ownerMobile);
                const hasRenter = !!(f.renterName || f.renterMobile);
                const showRenter = onRent || hasRenter;

                return (
                  <li id={`flat-card-${f.id}`} key={f.id} className="px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={
                          "mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-bold text-white " +
                          badgeColor(f.flatNumber, f.floorNumber)
                        }
                      >
                        {f.flatNumber}
                      </span>

                      <div className="min-w-0 flex-1">
                        {!hasOwner && available ? (
                          <div className="font-medium text-slate-400">કોઈ માલિક નથી</div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Owner
                              </span>
                              {onRent && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-500/50 dark:bg-violet-900/60 dark:text-violet-200">
                                  <span aria-hidden>🔑</span> On Rent
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[15px] font-bold leading-snug text-navy break-words">
                              {f.ownerName || "—"}
                            </div>
                            {f.ownerMobile ? (
                              <button
                                type="button"
                                onClick={() => copyPhone(f.id + "-owner-top", f.ownerMobile)}
                                title="Copy owner number"
                                className="mt-1 group inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left hover:bg-brand/5"
                              >
                                <span className="text-sm font-medium tabular-nums text-brand">
                                  {formatPhone(f.ownerMobile)}
                                </span>
                                <span className="text-slate-400" aria-hidden>
                                  {copiedKey === f.id + "-owner-top" ? "✓" : "⧉"}
                                </span>
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    {showRenter && (
                      <div className="mt-2.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 dark:border-violet-700/60 dark:bg-violet-950/55">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                            Renter
                          </div>
                          {onRent && (
                            <span className="rounded-full border border-violet-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:border-violet-500/50 dark:bg-violet-900/70 dark:text-violet-200">
                              Rent
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-sm font-bold leading-snug text-navy break-words dark:text-slate-50">
                          {f.renterName || "—"}
                        </div>
                        {f.renterMobile ? (
                          <button
                            type="button"
                            onClick={() => copyPhone(f.id + "-renter", f.renterMobile)}
                            title="Copy renter number"
                            className="mt-1.5 group inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-white/80 px-2 py-1 text-left hover:bg-white dark:border-violet-700/50 dark:bg-slate-900/60 dark:hover:bg-slate-900"
                          >
                            <span className="text-[10px] font-semibold uppercase text-violet-600 dark:text-violet-300">
                              Mobile
                            </span>
                            <span className="text-sm font-medium tabular-nums text-brand">
                              {formatPhone(f.renterMobile)}
                            </span>
                            <span className="text-slate-400 dark:text-slate-300" aria-hidden>
                              {copiedKey === f.id + "-renter" ? "✓" : "⧉"}
                            </span>
                          </button>
                        ) : (
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">No renter mobile</div>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5">
                      {onRent && (
                        <span className="rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:border-violet-500/50 dark:bg-violet-900/60 dark:text-violet-200">
                          Rent
                        </span>
                      )}
                      <span
                        className={
                          "rounded-full border px-3 py-1 text-xs font-medium " +
                          (available
                            ? "border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400"
                            : "border-emerald-400 text-emerald-600 dark:border-emerald-500/60 dark:text-emerald-400")
                        }
                      >
                        {available ? "Unsold" : "Sold"}
                      </span>

                      {isSuperAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(f)}
                            className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(f);
                            }}
                            className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    {(copiedKey === f.id + "-owner-top" || copiedKey === f.id + "-renter") && (
                      <div className="mt-1 text-[11px] font-medium text-emerald-600">Number copied</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      {!loading && floors.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No flats match your search.</p>
      )}

      <PlotDetailsModal
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
        title="Delete Flat Details?"
        confirmLabel="Remove details"
        loadingLabel="Removing…"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
      >
        <p>Are you sure you want to delete this record?</p>
        {deleteTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">Flat:</span>{" "}
            <span className="font-bold tabular-nums">{deleteTarget.flatNumber}</span>
            {deleteTarget.ownerName || deleteTarget.renterName ? (
              <>
                <br />
                <span className="font-semibold">Name:</span>{" "}
                {deleteTarget.ownerName || deleteTarget.renterName}
              </>
            ) : null}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">
          The flat card will stay. Owner/renter info will be cleared and status set to Unsold.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}
