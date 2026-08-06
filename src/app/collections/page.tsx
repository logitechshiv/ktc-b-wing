"use client";

import { useCallback, useEffect, useState } from "react";
import { inr } from "@/lib/format";
import type { SafeUser } from "@/lib/auth-client";
import {
  createPurpose,
  deletePurpose,
  readPurposeDetails,
  readPurposes,
  updatePurpose,
  type PurposeDetails,
  type PurposeInput,
  type PurposeRecord,
  type PurposeStat,
} from "@/lib/payment-purposes-api";
import {
  createPayment,
  type PaymentMode,
} from "@/lib/payments-api";
import { readFlats, type FlatRecord } from "@/lib/flats-api";
import type { PurposePendingFlat } from "@/lib/payment-purposes-api";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import PurposeModal from "@/components/collections/PurposeModal";
import DeletePurposeDialog from "@/components/collections/DeletePurposeDialog";
import PurposeDetailsPanel from "@/components/collections/PurposeDetailsPanel";
import CollectionModal from "@/components/collections/CollectionModal";
import { formSelectFilter } from "@/lib/form-styles";


function shortPurposeTitle(title: string) {
  return title
    .replace("Monthly Maintenance — ", "")
    .replace("Monthly Maintenance - ", "")
    .replace(" Repair Fund ", " ")
    .trim();
}

/** Display owner name (Gujarati only). */
function displayOwnerName(ownerName?: string | null) {
  const name = (ownerName || "").trim();
  return name || "કોઈ માલિક નથી";
}

function flatHasOwner(ownerName?: string | null) {
  return !!ownerName?.trim();
}

/** Oldest first (createdAt ascending); prefer active purposes. */
function pickFirstPurpose(list: PurposeRecord[]): PurposeRecord | null {
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });
  return sorted.find((p) => p.isActive) || sorted[0] || null;
}

export default function CollectionsPage() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const [flatQ, setFlatQ] = useState("");
  const [purposeId, setPurposeId] = useState<"all" | string>("all");
  const [purposeReady, setPurposeReady] = useState(false);
  const [modeFilter, setModeFilter] = useState<"all" | PaymentMode>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");

  const [purposes, setPurposes] = useState<PurposeRecord[]>([]);
  const [purposeStats, setPurposeStats] = useState<PurposeStat[]>([]);

  const [flats, setFlats] = useState<FlatRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formFlatId, setFormFlatId] = useState("");
  const [formPurposeId, setFormPurposeId] = useState("");
  const [formAmount, setFormAmount] = useState(0);
  const [formMode, setFormMode] = useState<PaymentMode>("cash");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formNotes, setFormNotes] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formPendingFlats, setFormPendingFlats] = useState<PurposePendingFlat[]>([]);
  const [formPendingLoading, setFormPendingLoading] = useState(false);
  /** When true, purpose came from page selection and cannot be changed in the form */
  const [formPurposeLocked, setFormPurposeLocked] = useState(false);
  const [formPurposeSearch, setFormPurposeSearch] = useState("");

  const [purposeModalOpen, setPurposeModalOpen] = useState(false);
  const [purposeModalMode, setPurposeModalMode] = useState<"add" | "edit">("add");
  const [editingPurpose, setEditingPurpose] = useState<PurposeRecord | null>(null);
  const [purposeSaving, setPurposeSaving] = useState(false);
  const [purposeModalError, setPurposeModalError] = useState<string | null>(null);
  const [deletePurposeTarget, setDeletePurposeTarget] = useState<PurposeRecord | null>(null);
  const [deletingPurpose, setDeletingPurpose] = useState(false);
  const [deletePurposeError, setDeletePurposeError] = useState<string | null>(null);

  const [purposeDetails, setPurposeDetails] = useState<PurposeDetails | null>(null);
  const [purposeDetailsLoading, setPurposeDetailsLoading] = useState(false);
  const [purposeDetailsError, setPurposeDetailsError] = useState<string | null>(null);
  /** Explicit Manage Purpose open state — synced with Purpose dropdown */
  const [managingPurposeId, setManagingPurposeId] = useState<string | null>(null);

  const isManagingPurpose = managingPurposeId !== null;
  const firstPurpose = pickFirstPurpose(purposes);

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

  const loadPurposes = useCallback(async () => {
    const data = await readPurposes();
    setPurposes(data.purposes);
    setPurposeStats(data.stats);
    return data.purposes;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const purposeList = await loadPurposes();
      const floors = await readFlats({ status: "all" });
      const flatList = floors.flatMap((f) => f.flats);
      setFlats(flatList);

      const first = pickFirstPurpose(purposeList);
      setPurposeId((current) => {
        const stillValid = current !== "all" && purposeList.some((p) => p.id === current);
        if (stillValid) return current;
        return first?.id ?? "all";
      });
      setPurposeReady(true);

      setFormPurposeId((current) => {
        if (current && purposeList.some((p) => p.id === current)) return current;
        if (first) {
          setFormAmount(first.amountPerFlat ?? first.amount);
          return first.id;
        }
        return "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments");
      setPurposeReady(true);
    }
  }, [loadPurposes]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  /** Load pending flats for New Collection when purpose changes */
  const refreshFormPending = useCallback(async (purposeIdValue: string) => {
    if (!purposeIdValue) {
      setFormPendingFlats([]);
      setFormFlatId("");
      return;
    }
    setFormPendingLoading(true);
    try {
      const details = await readPurposeDetails(purposeIdValue);
      const collectable = details.pending.filter((f) => f.hasOwner);
      setFormPendingFlats(collectable);
      setFormFlatId((current) => {
        if (current && collectable.some((f) => f.flatId === current)) return current;
        return collectable[0]?.flatId || "";
      });
    } catch {
      setFormPendingFlats([]);
      setFormFlatId("");
    } finally {
      setFormPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showForm || !formPurposeId) return;
    void refreshFormPending(formPurposeId);
  }, [showForm, formPurposeId, refreshFormPending]);

  const formAllPaid = formPendingFlats.length === 0 && !formPendingLoading && !!formPurposeId;

  const activePurposes = purposes.filter((p) => p.isActive);
  const searchablePurposes = activePurposes.filter((p) => {
    const q = formPurposeSearch.trim().toLowerCase();
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
  });

  const hasFilters =
    flatQ.trim() !== "" ||
    modeFilter !== "all" ||
    statusFilter !== "all" ||
    (purposeReady && firstPurpose != null && purposeId !== firstPurpose.id);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 2500);
  }

  function clearFilters() {
    setFlatQ("");
    setModeFilter("all");
    setStatusFilter("all");
    setPurposeId(firstPurpose?.id ?? "all");
  }

  function openAddPurpose() {
    setPurposeModalMode("add");
    setEditingPurpose(null);
    setPurposeModalError(null);
    setPurposeModalOpen(true);
  }

  function openEditPurpose(p: PurposeRecord) {
    setPurposeModalMode("edit");
    setEditingPurpose(p);
    setPurposeModalError(null);
    setPurposeModalOpen(true);
  }

  const loadPurposeDetails = useCallback(async (id: string) => {
    setPurposeDetailsError(null);
    setPurposeDetailsLoading(true);
    try {
      const details = await readPurposeDetails(id);
      setPurposeDetails(details);
    } catch (err) {
      setPurposeDetails(null);
      setPurposeDetailsError(err instanceof Error ? err.message : "Unable to load purpose details");
    } finally {
      setPurposeDetailsLoading(false);
    }
  }, []);

  function selectPurpose(id: string) {
    setPurposeId(id);
  }

  function openManagePurpose(id: string) {
    selectPurpose(id);
  }

  function closeManagePurpose() {
    // Keep a purpose selected — return to the first purpose details
    setPurposeId(firstPurpose?.id ?? "all");
  }

  /** Dropdown / auto-select drives Manage Purpose Details (no page refresh). */
  useEffect(() => {
    if (!purposeReady) return;
    if (purposeId === "all" || !purposeId) {
      setManagingPurposeId(null);
      setPurposeDetails(null);
      setPurposeDetailsError(null);
      setPurposeDetailsLoading(false);
      return;
    }
    setManagingPurposeId(purposeId);
    void loadPurposeDetails(purposeId);
  }, [purposeId, purposeReady, loadPurposeDetails]);

  // Keep dropdown on a real purpose once list is ready (never stay on "All" when purposes exist)
  useEffect(() => {
    if (!purposeReady || purposes.length === 0) return;
    if (purposeId !== "all" && purposes.some((p) => p.id === purposeId)) return;
    const first = pickFirstPurpose(purposes);
    if (first) setPurposeId(first.id);
  }, [purposeReady, purposes, purposeId]);

  /** Live refresh when purpose/payment/flat mutations happen (no full page reload). */
  useEffect(() => {
    return subscribeDataChanged((source) => {
      if (source === "payment" || source === "purpose" || source === "flat" || source === "unknown") {
        void load();
        if (managingPurposeId) {
          void loadPurposeDetails(managingPurposeId);
        }
      }
    });
  }, [load, managingPurposeId, loadPurposeDetails]);

  async function handlePurposeSave(data: PurposeInput) {
    setPurposeSaving(true);
    setPurposeModalError(null);
    try {
      if (purposeModalMode === "edit") {
        if (!editingPurpose?.id) throw new Error("Missing purpose id");
        await updatePurpose(editingPurpose.id, data);
        flashSuccess("Purpose updated");
      } else {
        const created = await createPurpose(data);
        flashSuccess("Purpose created");
        setPurposeId(created.id);
      }
      setPurposeModalOpen(false);
      setEditingPurpose(null);
      await loadPurposes();
      if (purposeModalMode === "edit" && managingPurposeId) {
        void loadPurposeDetails(managingPurposeId);
      }
      notifyDataChanged("purpose");
    } catch (err) {
      setPurposeModalError(err instanceof Error ? err.message : "Unable to save purpose");
    } finally {
      setPurposeSaving(false);
    }
  }

  async function handlePurposeDelete() {
    if (!deletePurposeTarget?.id) return;
    setDeletingPurpose(true);
    setDeletePurposeError(null);
    try {
      await deletePurpose(deletePurposeTarget.id);
      const removedId = deletePurposeTarget.id;
      setDeletePurposeTarget(null);
      flashSuccess("Purpose deleted");
      const remaining = await loadPurposes();
      if (purposeId === removedId || managingPurposeId === removedId) {
        setPurposeId(pickFirstPurpose(remaining)?.id ?? "all");
      }
      notifyDataChanged("purpose");
    } catch (err) {
      setDeletePurposeError(
        err instanceof Error
          ? err.message
          : "This Purpose cannot be deleted because payment records already exist."
      );
    } finally {
      setDeletingPurpose(false);
    }
  }

  function openCollectForm() {
    setFormFlatId("");
    setFormPendingFlats([]);
    setFormMode("cash");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormNotes("");
    setFormPurposeSearch("");
    setError(null);

    // Case 1: Viewing Manage Purpose Details — lock to that purpose
    const lockedId = managingPurposeId;
    if (lockedId) {
      const selected =
        purposes.find((p) => p.id === lockedId) ||
        (purposeDetails?.purpose.id === lockedId ? purposeDetails.purpose : null);
      setFormPurposeId(lockedId);
      setFormAmount(selected?.amountPerFlat ?? selected?.amount ?? 0);
      setFormPurposeLocked(true);
    } else {
      // Case 2: No managed purpose — user must choose
      setFormPurposeId("");
      setFormAmount(0);
      setFormPurposeLocked(false);
    }
    setShowForm(true);
  }

  function closeCollectForm() {
    setShowForm(false);
    setFormPurposeLocked(false);
    setFormPurposeSearch("");
    setFormPendingFlats([]);
    setFormFlatId("");
    setFormNotes("");
  }

  async function saveCollection() {
    if (!formFlatId || !formPurposeId || formAmount <= 0 || formAllPaid) return;
    const pendingFlat = formPendingFlats.find((f) => f.flatId === formFlatId);
    const flat = flats.find((f) => f.id === formFlatId);
    const purpose =
      purposes.find((p) => p.id === formPurposeId) ||
      (purposeDetails?.purpose.id === formPurposeId ? purposeDetails.purpose : null);
    if ((!pendingFlat && !flat) || !purpose) {
      setError("Select a valid pending flat and purpose");
      return;
    }
    if (!flatHasOwner(pendingFlat?.ownerName || flat?.ownerName)) {
      setError("Cannot collect payment — this flat has no owner");
      return;
    }

    setFormSaving(true);
    setError(null);
    try {
      const savedPurposeId = purpose.id;
      await createPayment({
        flatId: pendingFlat?.flatId || flat!.id,
        floorNumber: pendingFlat?.floorNumber || flat!.floorNumber,
        flatNumber: pendingFlat?.flatNumber || flat!.flatNumber,
        ownerName: pendingFlat?.ownerName || flat!.ownerName,
        paymentPurposeId: savedPurposeId,
        paymentPurpose: purpose.title,
        amount: formAmount,
        paymentMode: formMode,
        paymentDate: formDate,
        notes: formNotes.trim(),
      });
      flashSuccess("Collection saved");
      closeCollectForm();
      // Live refresh: purpose list, history, and open Purpose Details (no page reload)
      await loadPurposes();
      if (managingPurposeId) {
        await loadPurposeDetails(managingPurposeId);
      }
      notifyDataChanged("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save collection");
    } finally {
      setFormSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h1 className="text-[15px] font-bold text-navy">Search by Flat No — Payment History & Dues</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          ફ્લેટ અથવા માલિકથી શોધો · Purpose (Round) પસંદ કરો · Paid / Pending અને Payment Mode થી ફિલ્ટર કરો.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Flat No / Owner</span>
            <input
              value={flatQ}
              onChange={(e) => setFlatQ(e.target.value)}
              placeholder="e.g. 201"
              className="w-full rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Purpose (Round)</span>
            <select
              value={purposeId === "all" && firstPurpose ? firstPurpose.id : purposeId}
              onChange={(e) => selectPurpose(e.target.value)}
              disabled={purposeReady && purposes.length === 0}
              className={formSelectFilter}
            >
              {purposes.length === 0 ? (
                <option value="all">No Purpose available</option>
              ) : (
                [...purposes]
                  .sort((a, b) => {
                    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return ta - tb;
                  })
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))
              )}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-40 sm:w-auto"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "paid", "pending"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition " +
                (statusFilter === s
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-500")
              }
            >
              {s === "all" ? "All" : s === "paid" ? "Paid" : "Pending"}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(["all", "cash", "bank", "upi"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeFilter(m)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition " +
                (modeFilter === m
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-500")
              }
            >
              {m === "all" ? "All modes" : m}
            </button>
          ))}
        </div>

        {/* Purpose progress */}
        <ul className="mt-3 space-y-1.5">
          {purposeStats.map((s) => {
            const purpose = purposes.find((p) => p.id === s.purposeId);
            if (!purpose) return null;
            return (
              <li key={s.purposeId} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                <span className="mt-0.5 text-amber-500" aria-hidden>
                  ◆
                </span>
                <button
                  type="button"
                  className="text-left"
                  onClick={() => selectPurpose(s.purposeId)}
                >
                  <span className="font-semibold text-navy">{shortPurposeTitle(purpose.title)}:</span>{" "}
                  {s.total} ફ્લેટ માંથી{" "}
                  <span className="font-semibold text-emerald-600">{s.collected}</span> ફ્લેટનું કલેક્શન
                  આવી ગયું છે
                  {s.pending > 0 ? (
                    <>
                      , <span className="font-semibold text-amber-600">{s.pending}</span> ફ્લેટના{" "}
                      <span className="font-semibold text-amber-600">{inr(s.pendingAmount)}</span> બાકી છે.
                    </>
                  ) : (
                    <>
                      . <span className="text-emerald-600">કોઈ બાકી રકમ નથી.</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
          {purposes.length === 0 && (
            <li className="text-xs text-slate-400">No payment purposes yet.</li>
          )}
        </ul>
      </section>

      {isSuperAdmin && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openAddPurpose}
            className="text-xs font-semibold text-brand hover:underline"
          >
            + Add Purpose
          </button>
          <button
            type="button"
            onClick={() => (showForm ? closeCollectForm() : openCollectForm())}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {showForm ? "✕ Close form" : "+ Add Collection"}
          </button>
        </div>
      )}

      {purposeReady && purposes.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
          No Purpose available. Please create a Purpose first.
          {isSuperAdmin && (
            <div className="mt-3">
              <button
                type="button"
                onClick={openAddPurpose}
                className="text-xs font-semibold text-brand hover:underline"
              >
                + Add Purpose
              </button>
            </div>
          )}
        </div>
      )}

      {isSuperAdmin && purposes.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Manage Purposes
          </div>

          <ul className="divide-y divide-slate-100">
            {(purposeId === "all" ? purposes : purposes.filter((p) => p.id === purposeId)).map(
              (purpose) => (
                <li key={purpose.id} className="px-3 py-2.5 sm:px-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openManagePurpose(purpose.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-navy">{purpose.title}</div>
                      {!!purpose.description.trim() && (
                        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                          {purpose.description}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400">
                        {inr(purpose.amountPerFlat ?? purpose.amount)}
                        {!purpose.isActive && (
                          <span className="ml-2 text-amber-600">Inactive</span>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditPurpose(purpose)}
                      className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletePurposeError(null);
                        setDeletePurposeTarget(purpose);
                      }}
                      className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        </section>
      )}

      {isManagingPurpose && (purposeDetails || purposeDetailsLoading || purposeDetailsError) && (
        <PurposeDetailsPanel
          details={purposeDetails}
          loading={purposeDetailsLoading}
          error={purposeDetailsError}
          isSuperAdmin={isSuperAdmin}
          searchQuery={flatQ}
          statusFilter={statusFilter}
          onClose={closeManagePurpose}
          onAddCollection={isSuperAdmin ? openCollectForm : undefined}
        />
      )}

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

      <PurposeModal
        open={purposeModalOpen}
        mode={purposeModalMode}
        initial={editingPurpose}
        saving={purposeSaving}
        error={purposeModalError}
        onClose={() => {
          setPurposeModalOpen(false);
          setEditingPurpose(null);
          setPurposeModalError(null);
        }}
        onSubmit={handlePurposeSave}
      />

      <CollectionModal
        open={showForm && isSuperAdmin}
        purposes={
          formPurposeLocked &&
          formPurposeId &&
          !purposes.some((p) => p.id === formPurposeId) &&
          purposeDetails?.purpose.id === formPurposeId
            ? [...purposes, purposeDetails.purpose]
            : purposes
        }
        searchablePurposes={searchablePurposes}
        formPurposeId={formPurposeId}
        formPurposeLocked={formPurposeLocked}
        formPurposeSearch={formPurposeSearch}
        formPendingFlats={formPendingFlats}
        formPendingLoading={formPendingLoading}
        formAllPaid={formAllPaid}
        formFlatId={formFlatId}
        formAmount={formAmount}
        formDate={formDate}
        formNotes={formNotes}
        formMode={formMode}
        formSaving={formSaving}
        error={error}
        displayOwnerName={displayOwnerName}
        onClose={closeCollectForm}
        onPurposeSearchChange={setFormPurposeSearch}
        onPurposeChange={(id) => {
          setFormPurposeId(id);
          const p = purposes.find((x) => x.id === id);
          if (p) setFormAmount(p.amountPerFlat ?? p.amount);
        }}
        onFlatChange={setFormFlatId}
        onAmountChange={setFormAmount}
        onDateChange={setFormDate}
        onNotesChange={setFormNotes}
        onModeChange={setFormMode}
        onSave={() => void saveCollection()}
      />

      <DeletePurposeDialog
        open={!!deletePurposeTarget}
        title={deletePurposeTarget?.title}
        loading={deletingPurpose}
        error={deletePurposeError}
        onCancel={() => {
          setDeletePurposeTarget(null);
          setDeletePurposeError(null);
        }}
        onConfirm={handlePurposeDelete}
      />
    </div>
  );
}

