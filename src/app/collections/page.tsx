"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  type PurposeUnsoldPendingFlat,
} from "@/lib/payment-purposes-api";
import {
  createBuilderPayment,
  createPaymentsBulk,
  type CollectPersonOption,
  type PaymentMode,
} from "@/lib/payments-api";
import { readFlats, type FlatRecord } from "@/lib/flats-api";
import type { PurposePendingFlat } from "@/lib/payment-purposes-api";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import PurposeModal from "@/components/collections/PurposeModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import PurposeDetailsPanel from "@/components/collections/PurposeDetailsPanel";
import CollectionModal, {
  type CollectionFlatTab,
} from "@/components/collections/CollectionModal";
import { formSelectFilter } from "@/lib/form-styles";

function shortPurposeTitle(title: string) {
  return title
    .replace("Monthly Maintenance — ", "")
    .replace("Monthly Maintenance - ", "")
    .replace(" Repair Fund ", " ")
    .trim();
}

/** Build Owner/Renter options from pending sold flats + flat registry. */
function buildCollectOptions(
  pending: PurposePendingFlat[],
  flats: FlatRecord[]
): CollectPersonOption[] {
  const pendingIds = new Set(pending.map((p) => p.flatId));
  const byId = new Map(flats.map((f) => [f.id, f]));
  const options: CollectPersonOption[] = [];

  for (const pendingFlat of pending) {
    if (!pendingIds.has(pendingFlat.flatId)) continue;
    const flat = byId.get(pendingFlat.flatId);
    if (!flat) continue;
    if (flat.status !== "sold" && flat.status !== "rent") continue;

    const ownerName = (flat.ownerName || pendingFlat.ownerName || "").trim();
    const renterName = (flat.renterName || "").trim();

    if (ownerName) {
      options.push({
        key: `${flat.id}:owner`,
        flatId: flat.id,
        flatNumber: flat.flatNumber,
        floorNumber: flat.floorNumber,
        name: ownerName,
        ownerType: "Owner",
        label: `${flat.flatNumber} - ${ownerName} (Owner)`,
      });
    }
    if (renterName) {
      options.push({
        key: `${flat.id}:renter`,
        flatId: flat.id,
        flatNumber: flat.flatNumber,
        floorNumber: flat.floorNumber,
        name: renterName,
        ownerType: "Renter",
        label: `${flat.flatNumber} - ${renterName} (Renter)`,
      });
    }
  }

  return options.sort((a, b) =>
    a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true })
  );
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
  const [purposeFilterId, setPurposeFilterId] = useState("");
  const [purposeReady, setPurposeReady] = useState(false);
  const [modeFilter, setModeFilter] = useState<"all" | PaymentMode>("all");
  const [statusFilter, setStatusFilter] = useState<"paid" | "pending">("paid");

  const [purposes, setPurposes] = useState<PurposeRecord[]>([]);
  const [purposeStats, setPurposeStats] = useState<PurposeStat[]>([]);

  const [flats, setFlats] = useState<FlatRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /** Accordion — only one purpose open at a time; null = all collapsed */
  const [expandedPurposeId, setExpandedPurposeId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState<CollectionFlatTab>("sold");
  const [formSelectedKeys, setFormSelectedKeys] = useState<string[]>([]);
  const [formPurposeId, setFormPurposeId] = useState("");
  const [formAmount, setFormAmount] = useState(0);
  const [formMode, setFormMode] = useState<PaymentMode>("cash");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formNotes, setFormNotes] = useState("");
  const [formBuilderName, setFormBuilderName] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formPendingFlats, setFormPendingFlats] = useState<PurposePendingFlat[]>([]);
  const [formUnsoldPending, setFormUnsoldPending] = useState<PurposeUnsoldPendingFlat[]>([]);
  const [formPendingLoading, setFormPendingLoading] = useState(false);
  /** When true, purpose came from accordion selection and cannot be changed in the form */
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
  /** When true, accordion open skips refetch (details already applied live). */
  const skipDetailsReloadRef = useRef(false);

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
      setPurposeReady(true);

      const first = pickFirstPurpose(purposeList);
      setPurposeFilterId((current) => {
        if (current && purposeList.some((p) => p.id === current)) return current;
        return first?.id ?? "";
      });

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
      setFormUnsoldPending([]);
      setFormSelectedKeys([]);
      return;
    }
    setFormPendingLoading(true);
    try {
      const details = await readPurposeDetails(purposeIdValue);
      const collectable = details.pending.filter(
        (f) => f.hasOwner && f.flatStatus !== "available"
      );
      const unsold = details.unsoldPending || [];
      setFormPendingFlats(collectable);
      setFormUnsoldPending(unsold);
      setFormSelectedKeys((current) => {
        const validKeys = new Set(
          buildCollectOptions(collectable, flats).map((o) => o.key)
        );
        return current.filter((k) => validKeys.has(k));
      });
      const purposeAmount = details.purpose.amountPerFlat ?? details.purpose.amount ?? 0;
      setFormAmount((current) => (current > 0 ? current : purposeAmount));
    } catch {
      setFormPendingFlats([]);
      setFormUnsoldPending([]);
      setFormSelectedKeys([]);
    } finally {
      setFormPendingLoading(false);
    }
  }, [flats]);

  useEffect(() => {
    if (!showForm || !formPurposeId) return;
    void refreshFormPending(formPurposeId);
  }, [showForm, formPurposeId, refreshFormPending]);

  /** When switching to Unsold tab, set amount to unpaid unsold total. */
  useEffect(() => {
    if (!showForm || formTab !== "unsold" || !formPurposeId) return;
    const purpose =
      purposes.find((p) => p.id === formPurposeId) ||
      (purposeDetails?.purpose.id === formPurposeId ? purposeDetails.purpose : null);
    const perFlat = purpose?.amountPerFlat ?? purpose?.amount ?? 0;
    if (formUnsoldPending.length > 0 && perFlat > 0) {
      setFormAmount(formUnsoldPending.length * perFlat);
    }
  }, [
    showForm,
    formTab,
    formPurposeId,
    formUnsoldPending,
    purposes,
    purposeDetails,
  ]);

  const collectOptions = buildCollectOptions(formPendingFlats, flats);
  const formAllPaid = collectOptions.length === 0 && !formPendingLoading && !!formPurposeId;
  const formUnsoldAllPaid =
    formUnsoldPending.length === 0 && !formPendingLoading && !!formPurposeId;

  const activePurposes = purposes.filter((p) => p.isActive);
  const searchablePurposes = activePurposes.filter((p) => {
    const q = formPurposeSearch.trim().toLowerCase();
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
  });

  const firstPurpose = pickFirstPurpose(purposes);

  const visiblePurposes = purposes.filter((p) =>
    purposeFilterId ? p.id === purposeFilterId : p.id === firstPurpose?.id
  );

  const hasFilters =
    flatQ.trim() !== "" ||
    modeFilter !== "all" ||
    statusFilter !== "paid" ||
    (!!firstPurpose && purposeFilterId !== firstPurpose.id);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 2500);
  }

  function clearFilters() {
    setFlatQ("");
    setModeFilter("all");
    setStatusFilter("paid");
    setPurposeFilterId(firstPurpose?.id ?? "");
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

  const loadPurposeDetails = useCallback(async (id: string, opts?: { silent?: boolean }) => {
    setPurposeDetailsError(null);
    if (!opts?.silent) setPurposeDetailsLoading(true);
    try {
      const details = await readPurposeDetails(id);
      setPurposeDetails(details);
    } catch (err) {
      setPurposeDetails(null);
      setPurposeDetailsError(err instanceof Error ? err.message : "Unable to load purpose details");
    } finally {
      if (!opts?.silent) setPurposeDetailsLoading(false);
    }
  }, []);

  function togglePurposeAccordion(id: string) {
    setExpandedPurposeId((current) => {
      if (current === id) {
        setPurposeDetails(null);
        setPurposeDetailsError(null);
        return null;
      }
      return id;
    });
  }

  /** Load details when an accordion opens (collapsed by default). */
  useEffect(() => {
    if (!expandedPurposeId) {
      setPurposeDetails(null);
      setPurposeDetailsError(null);
      setPurposeDetailsLoading(false);
      return;
    }
    if (skipDetailsReloadRef.current) {
      skipDetailsReloadRef.current = false;
      return;
    }
    void loadPurposeDetails(expandedPurposeId);
  }, [expandedPurposeId, loadPurposeDetails]);

  /** Live refresh when purpose/payment/flat mutations happen (no full page reload). */
  useEffect(() => {
    return subscribeDataChanged((source) => {
      if (source === "payment" || source === "purpose" || source === "flat" || source === "unknown") {
        void load();
        if (expandedPurposeId) {
          void loadPurposeDetails(expandedPurposeId, { silent: true });
        }
      }
    });
  }, [load, expandedPurposeId, loadPurposeDetails]);

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
        // Keep accordions collapsed by default — do not auto-open
      }
      setPurposeModalOpen(false);
      setEditingPurpose(null);
      await loadPurposes();
      if (purposeModalMode === "edit" && expandedPurposeId) {
        void loadPurposeDetails(expandedPurposeId);
      }
      notifyDataChanged("purpose");
    } catch (err) {
      setPurposeModalError(err instanceof Error ? err.message : "Unable to save purpose");
    } finally {
      setPurposeSaving(false);
    }
  }

  async function handlePurposeDelete() {
    if (!deletePurposeTarget?.id || deletingPurpose) return;
    setDeletingPurpose(true);
    setDeletePurposeError(null);
    try {
      await deletePurpose(deletePurposeTarget.id);
      const removedId = deletePurposeTarget.id;
      setDeletePurposeTarget(null);
      flashSuccess("Purpose deleted");
      const remaining = await loadPurposes();
      if (expandedPurposeId === removedId) {
        setExpandedPurposeId(null);
      }
      if (purposeFilterId === removedId) {
        setPurposeFilterId(pickFirstPurpose(remaining)?.id ?? "");
      }
      notifyDataChanged("purpose");
    } catch (err) {
      setDeletePurposeError(
        err instanceof Error
          ? err.message
          : "Unable to delete this record. Please try again."
      );
    } finally {
      setDeletingPurpose(false);
    }
  }

  function openCollectForm(lockedPurposeId?: string | null) {
    setFormTab("sold");
    setFormSelectedKeys([]);
    setFormPendingFlats([]);
    setFormUnsoldPending([]);
    setFormMode("cash");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormNotes("");
    setFormBuilderName("");
    setFormPurposeSearch("");
    setError(null);

    const lockedId = lockedPurposeId ?? expandedPurposeId;
    if (lockedId) {
      const selected =
        purposes.find((p) => p.id === lockedId) ||
        (purposeDetails?.purpose.id === lockedId ? purposeDetails.purpose : null);
      setFormPurposeId(lockedId);
      setFormAmount(selected?.amountPerFlat ?? selected?.amount ?? 0);
      setFormPurposeLocked(true);
    } else {
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
    setFormUnsoldPending([]);
    setFormSelectedKeys([]);
    setFormNotes("");
    setFormBuilderName("");
    setFormTab("sold");
  }

  function handleFormTabChange(tab: CollectionFlatTab) {
    setFormTab(tab);
    setError(null);
    const purpose =
      purposes.find((p) => p.id === formPurposeId) ||
      (purposeDetails?.purpose.id === formPurposeId ? purposeDetails.purpose : null);
    const perFlat = purpose?.amountPerFlat ?? purpose?.amount ?? 0;
    if (tab === "sold") {
      setFormAmount(perFlat);
    } else if (formUnsoldPending.length > 0 && perFlat > 0) {
      setFormAmount(formUnsoldPending.length * perFlat);
    }
  }

  async function saveCollection() {
    if (formTab === "unsold") {
      await saveBuilderCollection();
      return;
    }

    if (!formPurposeId || formAmount <= 0 || formAllPaid || formSelectedKeys.length === 0) return;
    const purpose =
      purposes.find((p) => p.id === formPurposeId) ||
      (purposeDetails?.purpose.id === formPurposeId ? purposeDetails.purpose : null);
    if (!purpose) {
      setError("Select a valid purpose");
      return;
    }

    const optionMap = new Map(collectOptions.map((o) => [o.key, o]));
    const items = formSelectedKeys
      .map((key) => optionMap.get(key))
      .filter(Boolean)
      .map((opt) => ({
        flatId: opt!.flatId,
        ownerName: opt!.name,
        ownerType: opt!.ownerType,
      }));

    if (items.length === 0) {
      setError("Select at least one Owner/Renter");
      return;
    }

    setFormSaving(true);
    setError(null);
    try {
      const savedPurposeId = purpose.id;
      const result = await createPaymentsBulk({
        paymentPurposeId: savedPurposeId,
        amount: formAmount,
        paymentMode: formMode,
        paymentDate: formDate,
        notes: formNotes.trim(),
        items,
      });
      flashSuccess(result.message);
      closeCollectForm();
      await loadPurposes();
      if (expandedPurposeId) {
        await loadPurposeDetails(expandedPurposeId, { silent: true });
      } else if (savedPurposeId) {
        setExpandedPurposeId(savedPurposeId);
      }
      notifyDataChanged("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save collection");
    } finally {
      setFormSaving(false);
    }
  }

  async function saveBuilderCollection() {
    if (!formPurposeId || formAmount <= 0 || formUnsoldAllPaid) return;
    if (!formBuilderName.trim()) {
      setError("Builder Name is required");
      return;
    }
    const purpose =
      purposes.find((p) => p.id === formPurposeId) ||
      (purposeDetails?.purpose.id === formPurposeId ? purposeDetails.purpose : null);
    if (!purpose) {
      setError("Select a valid purpose");
      return;
    }

    setFormSaving(true);
    setError(null);
    try {
      const result = await createBuilderPayment({
        paymentPurposeId: purpose.id,
        builderName: formBuilderName.trim(),
        amount: formAmount,
        paymentMode: formMode,
        paymentDate: formDate,
        notes: formNotes.trim(),
      });

      // Live update summary + lists without a full page reload
      if (result.summary) {
        const paid = result.paid.map((row) => {
          const ownerName = String(row.ownerName ?? "");
          return {
            flatId: String(row.flatId ?? ""),
            flatNumber: String(row.flatNumber ?? ""),
            floorNumber: Number(row.floorNumber) || 0,
            ownerName,
            ownerMobile: String(row.ownerMobile ?? ""),
            hasOwner: typeof row.hasOwner === "boolean" ? !!row.hasOwner : !!ownerName.trim(),
            amount: Number(row.amount) || 0,
            paymentDate: row.paymentDate ? String(row.paymentDate).slice(0, 10) : "",
            paymentMode: String(row.paymentMode ?? ""),
            paymentId: String(row.paymentId ?? ""),
            paymentSource:
              row.paymentSource === "builder" ? ("builder" as const) : ("owner" as const),
            whatsappSent: !!row.whatsappSent,
          };
        });
        const pending = result.pending.map((row) => {
          const ownerName = String(row.ownerName ?? "");
          return {
            flatId: String(row.flatId ?? ""),
            flatNumber: String(row.flatNumber ?? ""),
            floorNumber: Number(row.floorNumber) || 0,
            ownerName,
            ownerMobile: String(row.ownerMobile ?? ""),
            hasOwner: typeof row.hasOwner === "boolean" ? !!row.hasOwner : !!ownerName.trim(),
            pendingAmount: Number(row.pendingAmount) || 0,
            flatStatus: row.flatStatus ? String(row.flatStatus) : undefined,
          };
        });
        const unsoldPending = result.unsoldPending.map((row) => ({
          flatId: String(row.flatId ?? ""),
          flatNumber: String(row.flatNumber ?? ""),
          floorNumber: Number(row.floorNumber) || 0,
          pendingAmount: Number(row.pendingAmount) || 0,
        }));

        setPurposeDetails({
          purpose,
          summary: {
            totalFlats: result.summary.totalFlats,
            paidFlats: result.summary.paidFlats,
            pendingFlats: result.summary.pendingFlats,
            totalCollected: result.summary.totalCollected,
            totalPending: result.summary.totalPending,
            collectionPercent: result.summary.collectionPercent,
          },
          paid,
          pending,
          unsoldPending,
        });
      }

      flashSuccess(
        `Builder payment saved — ${result.flatCount} unsold flats marked Paid (${inr(result.totalAmount)})`
      );
      closeCollectForm();
      skipDetailsReloadRef.current = true;
      setExpandedPurposeId(purpose.id);
      setPurposeFilterId(purpose.id);
      // Refresh purpose progress stats only (no full remount)
      void loadPurposes();
      notifyDataChanged("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save builder payment");
    } finally {
      setFormSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
              value={purposeFilterId || firstPurpose?.id || ""}
              onChange={(e) => setPurposeFilterId(e.target.value)}
              disabled={purposeReady && purposes.length === 0}
              className={formSelectFilter}
            >
              {purposes.length === 0 ? (
                <option value="">No Purpose available</option>
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

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Payment History</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "paid" | "pending")}
              className={formSelectFilter}
            >
              <option value="paid">જમા થયેલ (Paid)</option>
              <option value="pending">બાકી (Pending)</option>
            </select>
          </label>
        </div>

        {statusFilter === "paid" && (
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
        )}

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
                  onClick={() => {
                    setPurposeFilterId(s.purposeId);
                    // Filter only — do not auto-expand accordion
                  }}
                >
                  <span className="font-semibold text-navy">{shortPurposeTitle(purpose.title)}:</span>{" "}
                  {s.total} ફ્લેટ માંથી{" "}
                  <span className="font-semibold text-emerald-600">{s.collected}</span> ફ્લેટનું કલેક્શન
                  {s.collected === 0 ? " આવ્યું છે" : " આવી ગયું છે"}
                  {s.pending > 0 ? (
                    <>
                      . <span className="font-semibold text-amber-600">{s.pending}</span> ફ્લેટના{" "}
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

      {/* Purpose accordions — collapsed by default; only one open at a time */}
      <div className="space-y-3">
        {visiblePurposes.map((purpose) => {
          const isOpen = expandedPurposeId === purpose.id;
          const detailsForCard =
            isOpen && purposeDetails?.purpose.id === purpose.id ? purposeDetails : null;

          return (
            <section
              key={purpose.id}
              id={`purpose-accordion-${purpose.id}`}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => togglePurposeAccordion(purpose.id)}
                className="flex w-full items-start gap-2 px-4 py-3 text-left"
                aria-expanded={isOpen}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-navy">{purpose.title}</div>
                  {!!purpose.description.trim() && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                      {purpose.description}
                    </p>
                  )}
                </div>
                <span
                  className={
                    "mt-0.5 shrink-0 text-slate-400 transition " + (isOpen ? "rotate-180" : "")
                  }
                  aria-hidden
                >
                  ▾
                </span>
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                  {isSuperAdmin && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
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
                    </div>
                  )}

                  <PurposeDetailsPanel
                    details={detailsForCard}
                    loading={purposeDetailsLoading}
                    error={purposeDetailsError}
                    isSuperAdmin={isSuperAdmin}
                    searchQuery={flatQ}
                    statusFilter={statusFilter}
                    modeFilter={modeFilter}
                    hideHeader
                    onAddCollection={
                      isSuperAdmin ? () => openCollectForm(purpose.id) : undefined
                    }
                  />
                </div>
              )}
            </section>
          );
        })}
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
        collectOptions={collectOptions}
        formPendingLoading={formPendingLoading}
        formAllPaid={formAllPaid}
        formSelectedKeys={formSelectedKeys}
        formAmount={formAmount}
        formDate={formDate}
        formNotes={formNotes}
        formMode={formMode}
        formSaving={formSaving}
        formTab={formTab}
        formBuilderName={formBuilderName}
        formUnsoldPending={formUnsoldPending}
        formUnsoldAllPaid={formUnsoldAllPaid}
        error={error}
        onClose={closeCollectForm}
        onPurposeSearchChange={setFormPurposeSearch}
        onPurposeChange={(id) => {
          setFormPurposeId(id);
          setFormSelectedKeys([]);
          const p = purposes.find((x) => x.id === id);
          if (p) setFormAmount(p.amountPerFlat ?? p.amount);
        }}
        onSelectedKeysChange={setFormSelectedKeys}
        onAmountChange={setFormAmount}
        onDateChange={setFormDate}
        onNotesChange={setFormNotes}
        onModeChange={setFormMode}
        onTabChange={handleFormTabChange}
        onBuilderNameChange={setFormBuilderName}
        onSave={() => void saveCollection()}
      />

      <ConfirmDeleteModal
        open={!!deletePurposeTarget}
        title="Delete Purpose?"
        itemName={deletePurposeTarget?.title}
        description="All payment records linked to this Purpose will also be deleted permanently. This action cannot be undone."
        loading={deletingPurpose}
        error={deletePurposeError}
        onCancel={() => {
          if (deletingPurpose) return;
          setDeletePurposeTarget(null);
          setDeletePurposeError(null);
        }}
        onConfirm={() => void handlePurposeDelete()}
      />
    </div>
  );
}
