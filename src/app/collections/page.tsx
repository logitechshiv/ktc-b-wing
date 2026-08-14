"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Home } from "lucide-react";
import { inr } from "@/lib/format";
import { readCurrentUser, type SafeUser } from "@/lib/auth-client";
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
  collectionScopeShortLabel,
  normalizeCollectionScope,
} from "@/lib/collection-scope";
import {
  createBuilderPayment,
  createPaymentsBulk,
  deletePayment,
  updatePayment,
  type CollectPersonOption,
  type PaymentMode,
} from "@/lib/payments-api";
import { readFlats, type FlatRecord, type FloorGroup } from "@/lib/flats-api";
import type { PurposePaidFlat, PurposePendingFlat } from "@/lib/payment-purposes-api";
import { CacheKeys, peekCache } from "@/lib/data-cache";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import PurposeModal from "@/components/collections/PurposeModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import PurposeDetailsPanel from "@/components/collections/PurposeDetailsPanel";
import PurposeSummaryModal from "@/components/collections/PurposeSummaryModal";
import PurposeScopeSelect from "@/components/collections/PurposeScopeSelect";
import CollectionModal, {
  type CollectionFlatTab,
} from "@/components/collections/CollectionModal";
import EditCollectionModal from "@/components/collections/EditCollectionModal";
import BuilderCommonCollectionModal, {
  type BuilderCommonCollectionFormData,
} from "@/components/collections/BuilderCommonCollectionModal";
import {
  createBuilderCommonCollectionClient,
  updateBuilderCommonCollectionClient,
  type BuilderCommonCollectionRecord,
} from "@/lib/builder-common-collections-api";

function shortPurposeTitle(title: string) {
  return title
    .replace("Monthly Maintenance — ", "")
    .replace("Monthly Maintenance - ", "")
    .replace(" Repair Fund ", " ")
    .trim();
}

const FLAT_BADGE_COLORS = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function flatBadgeColor(flatNumber: string) {
  let h = 0;
  for (let i = 0; i < flatNumber.length; i++) {
    h = (h + flatNumber.charCodeAt(i) * (i + 1)) % FLAT_BADGE_COLORS.length;
  }
  return FLAT_BADGE_COLORS[h];
}

/** Any unpaid flat for the selected purpose (sold pending + unsold/builder pending). */
function isPendingFlat(row: PurposePendingFlat) {
  return (Number(row.pendingAmount) || 0) > 0;
}

/** Build one Flat / Owner / Renter option per pending flat (display rules). */
function buildCollectOptions(
  pending: PurposePendingFlat[],
  flats: FlatRecord[]
): CollectPersonOption[] {
  const byId = new Map(flats.map((f) => [f.id, f]));
  const byNumber = new Map(flats.map((f) => [String(f.flatNumber), f]));
  const options: CollectPersonOption[] = [];

  for (const pendingFlat of pending) {
    const flat =
      byId.get(pendingFlat.flatId) ||
      byNumber.get(String(pendingFlat.flatNumber));

    const status = String(flat?.status || pendingFlat.flatStatus || "");
    if (status === "available") continue;
    if (status && status !== "sold" && status !== "rent") continue;

    const flatId = flat?.id || pendingFlat.flatId;
    const flatNumber = flat?.flatNumber || pendingFlat.flatNumber;
    const floorNumber = flat?.floorNumber ?? pendingFlat.floorNumber;

    const ownerName = (flat?.ownerName || pendingFlat.ownerName || "").trim();
    const renterName = (flat?.renterName || pendingFlat.renterName || "").trim();

    // 1) Owner + Renter → show renter only with (Renter)
    // 2) Owner only → show owner name (no type suffix)
    // 3) Neither → skip (existing: no selectable option)
    if (renterName) {
      options.push({
        key: `${flatId}:renter`,
        flatId,
        flatNumber,
        floorNumber,
        name: renterName,
        ownerType: "Renter",
        label: `${flatNumber} - ${renterName} (Renter)`,
      });
    } else if (ownerName) {
      options.push({
        key: `${flatId}:owner`,
        flatId,
        flatNumber,
        floorNumber,
        name: ownerName,
        ownerType: "Owner",
        label: `${flatNumber} - ${ownerName}`,
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

type PurposesCachePayload = { purposes: PurposeRecord[]; stats: PurposeStat[] };

function readCachedCollectionBootstrap(): {
  purposes: PurposeRecord[];
  stats: PurposeStat[];
  flats: FlatRecord[];
  ready: boolean;
  firstId: string;
} {
  const cachedPurposes = peekCache<PurposesCachePayload>(CacheKeys.purposes(false));
  const cachedFloors = peekCache<FloorGroup[]>(CacheKeys.flats("", "all"));
  if (!cachedPurposes) {
    return { purposes: [], stats: [], flats: [], ready: false, firstId: "" };
  }
  const flats = cachedFloors ? cachedFloors.flatMap((f) => f.flats) : [];
  const first = pickFirstPurpose(cachedPurposes.purposes);
  return {
    purposes: cachedPurposes.purposes,
    stats: cachedPurposes.stats,
    flats,
    ready: true,
    firstId: first?.id ?? "",
  };
}

export default function CollectionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const bootstrap = readCachedCollectionBootstrap();

  const [flatQ, setFlatQ] = useState("");
  const [purposeFilterId, setPurposeFilterId] = useState(bootstrap.firstId);
  const [purposeReady, setPurposeReady] = useState(bootstrap.ready);
  const [modeFilter, setModeFilter] = useState<"all" | PaymentMode>("all");

  const [purposes, setPurposes] = useState<PurposeRecord[]>(bootstrap.purposes);
  const [purposeStats, setPurposeStats] = useState<PurposeStat[]>(bootstrap.stats);

  const [flats, setFlats] = useState<FlatRecord[]>(bootstrap.flats);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /** Accordion — keep selected purpose open by default */
  const [expandedPurposeId, setExpandedPurposeId] = useState<string | null>(
    bootstrap.firstId || null
  );
  const appliedNotificationDeepLinkRef = useRef(false);

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

  const [editingPayment, setEditingPayment] = useState<PurposePaidFlat | null>(null);
  const [editPaymentPurposeTitle, setEditPaymentPurposeTitle] = useState("");
  const [editPaymentPurposeId, setEditPaymentPurposeId] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editMode, setEditMode] = useState<PaymentMode>("cash");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentSaving, setEditPaymentSaving] = useState(false);
  const [editPaymentError, setEditPaymentError] = useState<string | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<PurposePaidFlat | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [deletePaymentError, setDeletePaymentError] = useState<string | null>(null);

  const [purposeDetails, setPurposeDetails] = useState<PurposeDetails | null>(null);
  const [purposeDetailsLoading, setPurposeDetailsLoading] = useState(false);
  const [purposeDetailsError, setPurposeDetailsError] = useState<string | null>(null);
  /** When true, accordion open skips refetch (details already applied live). */
  const skipDetailsReloadRef = useRef(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [builderModalMode, setBuilderModalMode] = useState<"add" | "edit">("add");
  const [editingBuilderCollection, setEditingBuilderCollection] =
    useState<BuilderCommonCollectionRecord | null>(null);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderModalError, setBuilderModalError] = useState<string | null>(null);

  /** Filter-bar summary + pending sold flats for the selected Purpose only */
  const [filterDetails, setFilterDetails] = useState<PurposeDetails | null>(() =>
    bootstrap.firstId
      ? peekCache<PurposeDetails>(CacheKeys.purposeDetails(bootstrap.firstId)) ?? null
      : null
  );
  const [filterDetailsLoading, setFilterDetailsLoading] = useState(false);

  useEffect(() => {
    void readCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  const loadPurposes = useCallback(async (opts?: { force?: boolean }) => {
    const data = await readPurposes(false, { force: opts?.force });
    setPurposes(data.purposes);
    setPurposeStats(data.stats);
    return data.purposes;
  }, []);

  const applyPurposeSelection = useCallback((purposeList: PurposeRecord[]) => {
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
  }, []);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    setError(null);

    if (!force) {
      const cachedPurposes = peekCache<PurposesCachePayload>(CacheKeys.purposes(false));
      const cachedFloors = peekCache<FloorGroup[]>(CacheKeys.flats("", "all"));
      if (cachedPurposes && cachedFloors) {
        setPurposes(cachedPurposes.purposes);
        setPurposeStats(cachedPurposes.stats);
        setFlats(cachedFloors.flatMap((f) => f.flats));
        setPurposeReady(true);
        applyPurposeSelection(cachedPurposes.purposes);
        return;
      }
    }

    try {
      const purposeList = await loadPurposes({ force });
      const floors = await readFlats({ status: "all", force });
      const flatList = floors.flatMap((f) => f.flats);
      setFlats(flatList);
      setPurposeReady(true);
      applyPurposeSelection(purposeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments");
      setPurposeReady(true);
    }
  }, [loadPurposes, applyPurposeSelection]);

  useEffect(() => {
    if (
      peekCache(CacheKeys.purposes(false)) &&
      peekCache(CacheKeys.flats("", "all"))
    ) {
      void load();
      return;
    }
    const t = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  /**
   * Deep link from /notifications:
   * /collections?purposeId=... or /collections?purpose=Title
   * Selects the purpose filter and opens its accordion.
   */
  useEffect(() => {
    if (appliedNotificationDeepLinkRef.current) return;
    if (!purposeReady || purposes.length === 0) return;
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);
    const purposeIdParam = (sp.get("purposeId") || "").trim();
    const purposeTitleParam = (sp.get("purpose") || "").trim();
    if (!purposeIdParam && !purposeTitleParam) return;

    let targetId = "";
    if (purposeIdParam && purposes.some((p) => p.id === purposeIdParam)) {
      targetId = purposeIdParam;
    } else if (purposeTitleParam) {
      const needle = purposeTitleParam.toLowerCase();
      const match = purposes.find((p) => {
        const title = p.title.trim().toLowerCase();
        const short = shortPurposeTitle(p.title).toLowerCase();
        return title === needle || short === needle;
      });
      if (match) targetId = match.id;
    }

    appliedNotificationDeepLinkRef.current = true;

    if (targetId) {
      setPurposeFilterId(targetId);
      setExpandedPurposeId(targetId);
    }

    // Clear query so refresh/back don't re-trigger unexpectedly
    router.replace("/collections", { scroll: false });
  }, [purposeReady, purposes, router]);

  /** Load pending flats for New Collection when purpose changes */
  const refreshFormPending = useCallback(async (purposeIdValue: string) => {
    if (!purposeIdValue) {
      setFormPendingFlats([]);
      setFormUnsoldPending([]);
      setFormSelectedKeys([]);
      return;
    }
    if (!peekCache<PurposeDetails>(CacheKeys.purposeDetails(purposeIdValue))) {
      setFormPendingLoading(true);
    }
    try {
      // Force refresh so renter-only flats are not missed from a stale bootstrap cache
      const details = await readPurposeDetails(purposeIdValue, { force: true });
      const collectable = details.pending.filter((f) => {
        if (f.flatStatus === "available") return false;
        const hasOwner = f.hasOwner || !!(f.ownerName || "").trim();
        const hasRenter = !!(f.renterName || "").trim();
        return hasOwner || hasRenter;
      });
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
    if (normalizeCollectionScope(purpose?.collectionScope) !== "all") {
      setFormTab("sold");
      return;
    }
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
  const selectedPurposeId = purposeFilterId || firstPurpose?.id || "";
  const selectedPurpose =
    purposes.find((p) => p.id === selectedPurposeId) ||
    (filterDetails?.purpose.id === selectedPurposeId ? filterDetails.purpose : null);
  const selectedPurposeStat =
    purposeStats.find((s) => s.purposeId === selectedPurposeId) || null;

  const pendingFlatsForBadges = useMemo(() => {
    if (!filterDetails || filterDetails.purpose.id !== selectedPurposeId) return [];

    const byNumber = new Map<string, PurposePendingFlat>();

    for (const row of filterDetails.pending) {
      if (!isPendingFlat(row)) continue;
      byNumber.set(row.flatNumber, row);
    }

    // Ensure unsold/builder pending flats are included even if only in unsoldPending
    for (const row of filterDetails.unsoldPending || []) {
      if ((Number(row.pendingAmount) || 0) <= 0) continue;
      if (byNumber.has(row.flatNumber)) continue;
      byNumber.set(row.flatNumber, {
        flatId: row.flatId,
        flatNumber: row.flatNumber,
        floorNumber: row.floorNumber,
        ownerName: "",
        ownerMobile: "",
        renterName: "",
        hasOwner: false,
        pendingAmount: row.pendingAmount,
        flatStatus: "available",
      });
    }

    return Array.from(byNumber.values()).sort(
      (a, b) =>
        a.floorNumber - b.floorNumber ||
        Number(a.flatNumber) - Number(b.flatNumber) ||
        a.flatNumber.localeCompare(b.flatNumber)
    );
  }, [filterDetails, selectedPurposeId]);

  const visiblePurposes = purposes.filter((p) =>
    purposeFilterId ? p.id === purposeFilterId : p.id === firstPurpose?.id
  );

  /** Selected purpose accordion stays open (filter shows one purpose at a time). */
  useEffect(() => {
    if (!selectedPurposeId) return;
    setExpandedPurposeId(selectedPurposeId);
  }, [selectedPurposeId]);

  const hasFilters =
    flatQ.trim() !== "" ||
    modeFilter !== "all" ||
    (!!firstPurpose && purposeFilterId !== firstPurpose.id);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 2500);
  }

  function clearFilters() {
    setFlatQ("");
    setModeFilter("all");
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

  const loadPurposeDetails = useCallback(async (id: string, opts?: { silent?: boolean; force?: boolean }) => {
    setPurposeDetailsError(null);
    if (!opts?.force) {
      const cached = peekCache<PurposeDetails>(CacheKeys.purposeDetails(id));
      if (cached) {
        setPurposeDetails(cached);
        setPurposeDetailsLoading(false);
        return;
      }
    }
    if (!opts?.silent) setPurposeDetailsLoading(true);
    try {
      const details = await readPurposeDetails(id, { force: opts?.force });
      setPurposeDetails(details);
    } catch (err) {
      setPurposeDetails(null);
      setPurposeDetailsError(err instanceof Error ? err.message : "Unable to load purpose details");
    } finally {
      if (!opts?.silent) setPurposeDetailsLoading(false);
    }
  }, []);

  const loadFilterPurposeDetails = useCallback(async (id: string, opts?: { force?: boolean }) => {
    if (!id) {
      setFilterDetails(null);
      setFilterDetailsLoading(false);
      return;
    }
    if (!opts?.force) {
      const cached = peekCache<PurposeDetails>(CacheKeys.purposeDetails(id));
      if (cached) {
        setFilterDetails(cached);
        setFilterDetailsLoading(false);
        return;
      }
    }
    setFilterDetailsLoading(true);
    try {
      const details = await readPurposeDetails(id, { force: opts?.force });
      setFilterDetails(details);
    } catch {
      setFilterDetails(null);
    } finally {
      setFilterDetailsLoading(false);
    }
  }, []);

  /** Keep filter summary + pending sold flats in sync with selected Purpose. */
  useEffect(() => {
    if (!purposeReady) return;
    void loadFilterPurposeDetails(selectedPurposeId);
  }, [purposeReady, selectedPurposeId, loadFilterPurposeDetails]);

  function togglePurposeAccordion(id: string) {
    setExpandedPurposeId((current) => {
      if (current === id) {
        setPurposeDetails(null);
        setPurposeDetailsError(null);
        setSummaryModalOpen(false);
        return null;
      }
      return id;
    });
  }

  /** Load details when an accordion opens (first purpose open by default). */
  useEffect(() => {
    if (!expandedPurposeId) {
      setPurposeDetails(null);
      setPurposeDetailsError(null);
      setPurposeDetailsLoading(false);
      setSummaryModalOpen(false);
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
        void load({ force: true });
        if (expandedPurposeId) {
          void loadPurposeDetails(expandedPurposeId, { silent: true, force: true });
        }
        if (selectedPurposeId) {
          void loadFilterPurposeDetails(selectedPurposeId, { force: true });
        }
      }
    });
  }, [load, expandedPurposeId, loadPurposeDetails, selectedPurposeId, loadFilterPurposeDetails]);

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
      setPurposeModalMode("add");
      setEditingPurpose(null);
      notifyDataChanged("purpose");
      await load({ force: true });
      if (purposeModalMode === "edit" && expandedPurposeId) {
        void loadPurposeDetails(expandedPurposeId, { force: true });
      }
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
      notifyDataChanged("purpose");
      const remaining = await loadPurposes({ force: true });
      if (expandedPurposeId === removedId) {
        setExpandedPurposeId(null);
      }
      if (purposeFilterId === removedId) {
        setPurposeFilterId(pickFirstPurpose(remaining)?.id ?? "");
      }
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

  function openEditPayment(row: PurposePaidFlat, purpose: PurposeRecord) {
    if (!isSuperAdmin || !row.paymentId) return;
    const mode = String(row.paymentMode || "cash").toLowerCase() as PaymentMode;
    setEditingPayment(row);
    setEditPaymentPurposeId(purpose.id);
    setEditPaymentPurposeTitle(purpose.title);
    setEditAmount(Number(row.amount) || 0);
    setEditMode(
      mode === "bank" || mode === "upi" || mode === "cheque" || mode === "cash" ? mode : "cash"
    );
    setEditDate(row.paymentDate ? String(row.paymentDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditNotes(row.notes || "");
    setEditPaymentError(null);
  }

  function closeEditPayment() {
    if (editPaymentSaving) return;
    setEditingPayment(null);
    setEditPaymentError(null);
  }

  async function saveEditPayment() {
    if (!editingPayment?.paymentId || editPaymentSaving) return;
    if (editAmount <= 0) {
      setEditPaymentError("Amount must be greater than 0");
      return;
    }
    setEditPaymentSaving(true);
    setEditPaymentError(null);
    try {
      await updatePayment(editingPayment.paymentId, {
        flatId: editingPayment.flatId,
        floorNumber: editingPayment.floorNumber,
        flatNumber: editingPayment.flatNumber,
        ownerName: editingPayment.ownerName,
        paymentPurposeId: editPaymentPurposeId,
        paymentPurpose: editPaymentPurposeTitle,
        amount: editAmount,
        paymentMode: editMode,
        paymentDate: editDate,
        notes: editNotes.trim(),
        whatsappSent: editingPayment.whatsappSent,
      });
      flashSuccess("Collection updated");
      setEditingPayment(null);
      notifyDataChanged("payment");
      await load({ force: true });
      if (expandedPurposeId) {
        await loadPurposeDetails(expandedPurposeId, { silent: true, force: true });
      }
    } catch (err) {
      setEditPaymentError(err instanceof Error ? err.message : "Unable to update collection");
    } finally {
      setEditPaymentSaving(false);
    }
  }

  async function handlePaymentDelete() {
    if (!deletePaymentTarget?.paymentId || deletingPayment) return;
    setDeletingPayment(true);
    setDeletePaymentError(null);
    try {
      await deletePayment(deletePaymentTarget.paymentId);
      setDeletePaymentTarget(null);
      flashSuccess("Collection deleted");
      notifyDataChanged("payment");
      await load({ force: true });
      if (expandedPurposeId) {
        await loadPurposeDetails(expandedPurposeId, { silent: true, force: true });
      }
    } catch (err) {
      setDeletePaymentError(
        err instanceof Error
          ? err.message
          : "Unable to delete this collection. Please try again."
      );
    } finally {
      setDeletingPayment(false);
    }
  }

  function openCollectForm(lockedPurposeId?: string | null) {
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
      setFormTab("sold");
    } else {
      setFormPurposeId("");
      setFormAmount(0);
      setFormPurposeLocked(false);
      setFormTab("sold");
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

  function openBuilderCollectForm(row?: BuilderCommonCollectionRecord | null) {
    closeCollectForm();
    setBuilderModalError(null);
    if (row) {
      setBuilderModalMode("edit");
      setEditingBuilderCollection(row);
    } else {
      setBuilderModalMode("add");
      setEditingBuilderCollection(null);
    }
    setBuilderModalOpen(true);
  }

  function closeBuilderCollectForm() {
    if (builderSaving) return;
    setBuilderModalOpen(false);
    setEditingBuilderCollection(null);
    setBuilderModalError(null);
  }

  async function handleBuilderCollectionSave(data: BuilderCommonCollectionFormData) {
    setBuilderSaving(true);
    setBuilderModalError(null);
    try {
      if (builderModalMode === "edit" && editingBuilderCollection) {
        await updateBuilderCommonCollectionClient(editingBuilderCollection.id, data);
        setSuccess("Builder collection updated.");
      } else {
        await createBuilderCommonCollectionClient(data);
        setSuccess("Builder collection added.");
      }
      notifyDataChanged("payment");
      setBuilderModalOpen(false);
      setEditingBuilderCollection(null);
    } catch (e) {
      setBuilderModalError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBuilderSaving(false);
    }
  }

  function handleFormTabChange(tab: CollectionFlatTab) {
    const purpose =
      purposes.find((p) => p.id === formPurposeId) ||
      (purposeDetails?.purpose.id === formPurposeId ? purposeDetails.purpose : null);
    if (tab === "unsold" && normalizeCollectionScope(purpose?.collectionScope) !== "all") {
      setFormTab("sold");
      setError("This purpose applies to Sold Flats Only");
      return;
    }
    setFormTab(tab);
    setError(null);
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
      notifyDataChanged("payment");
      await load({ force: true });
      if (expandedPurposeId) {
        await loadPurposeDetails(expandedPurposeId, { silent: true, force: true });
      } else if (savedPurposeId) {
        setExpandedPurposeId(savedPurposeId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save collection");
    } finally {
      setFormSaving(false);
    }
  }

  async function saveBuilderCollection() {
    if (!formPurposeId || formAmount <= 0 || formUnsoldAllPaid) return;
    const purpose =
      purposes.find((p) => p.id === formPurposeId) ||
      (purposeDetails?.purpose.id === formPurposeId ? purposeDetails.purpose : null);
    if (!purpose) {
      setError("Select a valid purpose");
      return;
    }
    if (normalizeCollectionScope(purpose.collectionScope) !== "all") {
      setError("This purpose applies to Sold Flats Only. Builder/Unsold collection is not allowed.");
      return;
    }
    if (!formBuilderName.trim()) {
      setError("Builder Name is required");
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
            renterName: String(row.renterName ?? "").trim(),
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
      notifyDataChanged("payment");
      void load({ force: true });
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
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>

          <div className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Purpose (Round)</span>
            <PurposeScopeSelect
              purposes={purposes}
              value={purposeFilterId || firstPurpose?.id || ""}
              disabled={purposeReady && purposes.length === 0}
              onChange={setPurposeFilterId}
            />
          </div>

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
          {(["all", "cash", "bank", "upi", "cheque"] as const).map((m) => (
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

        <ul className="mt-3 space-y-2.5">
          {selectedPurpose && selectedPurposeStat ? (
            <li className="space-y-2.5">
              {/* Screenshot layout: pending line → all pending flat badges → full summary */}
              {(() => {
                const scopeSummary =
                  filterDetails?.purpose.id === selectedPurposeId
                    ? filterDetails.summary
                    : null;
                const total =
                  scopeSummary?.totalFlats ?? selectedPurposeStat.total;
                const collected =
                  scopeSummary?.paidFlats ?? selectedPurposeStat.collected;
                const pending =
                  scopeSummary?.pendingFlats ?? selectedPurposeStat.pending;
                const pendingAmount =
                  scopeSummary?.totalPending ?? selectedPurposeStat.pendingAmount;
                return (
                  <>
              {filterDetailsLoading && pendingFlatsForBadges.length === 0 ? (
                <p className="text-[11px] text-slate-400">Loading pending flats…</p>
              ) : pendingFlatsForBadges.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex gap-2 text-xs leading-relaxed text-slate-600">
                    <span className="mt-0.5 text-amber-500" aria-hidden>
                      ◆
                    </span>
                    <p className="text-left">
                      <span className="font-semibold text-navy">
                        &quot;{shortPurposeTitle(selectedPurpose.title)}&quot;
                      </span>
                      {" — "}
                      <span className="font-semibold text-amber-600">
                        {pendingFlatsForBadges.length}
                      </span>{" "}
                      ફ્લેટનું કલેક્શન બાકી છે:
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pl-4">
                    {pendingFlatsForBadges.map((flat) => {
                      const isUnsold = String(flat.flatStatus || "") === "available";
                      return (
                        <span
                          key={flat.flatId || flat.flatNumber}
                          title={
                            isUnsold
                              ? `Unsold Flat ${flat.flatNumber} pending`
                              : `Sold Flat ${flat.flatNumber} pending`
                          }
                          className={
                            "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[11px] font-bold tabular-nums text-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] " +
                            flatBadgeColor(flat.flatNumber)
                          }
                        >
                          {flat.flatNumber}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 text-xs leading-relaxed text-slate-600">
                  <span className="mt-0.5 text-amber-500" aria-hidden>
                    ◆
                  </span>
                  <p className="text-left">
                    <span className="font-semibold text-navy">
                      &quot;{shortPurposeTitle(selectedPurpose.title)}&quot;
                    </span>
                    {" — "}
                    <span className="text-emerald-600">કોઈ બાકી કલેક્શન નથી.</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 text-xs leading-relaxed text-slate-600">
                <span className="mt-0.5 text-amber-500" aria-hidden>
                  ◆
                </span>
                <p className="text-left">
                  <span className="font-semibold text-navy">
                    {shortPurposeTitle(selectedPurpose.title)}:
                  </span>{" "}
                  {total} ફ્લેટ માંથી{" "}
                  <span className="font-semibold text-emerald-600">
                    {collected}
                  </span>{" "}
                  ફ્લેટનું કલેક્શન
                  {collected === 0 ? " આવ્યું છે" : " આવી ગયું છે"}
                  {pending > 0 ? (
                    <>
                      ,{" "}
                      <span className="font-semibold text-amber-600">
                        {pending}
                      </span>{" "}
                      ફ્લેટના{" "}
                      <span className="font-semibold text-amber-600">
                        {inr(pendingAmount)}
                      </span>{" "}
                      બાકી છે
                    </>
                  ) : (
                    <>
                      . <span className="text-emerald-600">કોઈ બાકી રકમ નથી.</span>
                    </>
                  )}
                </p>
              </div>
                  </>
                );
              })()}
            </li>
          ) : purposes.length === 0 ? (
            <li className="text-xs text-slate-400">No payment purposes yet.</li>
          ) : (
            <li className="text-xs text-slate-400">Select a Purpose (Round) to view summary.</li>
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

      {/* Purpose accordions — first purpose open by default; only one open at a time */}
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
              <div className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => togglePurposeAccordion(purpose.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-1.5">
                      {normalizeCollectionScope(purpose.collectionScope) === "all" ? (
                        <Building2
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                      ) : (
                        <Home
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                      )}
                      <div className="truncate text-sm font-bold text-navy">{purpose.title}</div>
                    </div>
                    <p className="mt-0.5 pl-5 text-[10px] font-medium text-slate-400">
                      {collectionScopeShortLabel(
                        normalizeCollectionScope(purpose.collectionScope)
                      )}
                    </p>
                  </button>

                  <div className="mt-0.5 flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {isSuperAdmin && (
                      <>
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
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (expandedPurposeId !== purpose.id) {
                          togglePurposeAccordion(purpose.id);
                        }
                        setSummaryModalOpen(true);
                      }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-navy hover:bg-slate-100"
                    >
                      Summary
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePurposeAccordion(purpose.id)}
                    className={
                      "mt-0.5 shrink-0 px-0.5 text-slate-400 transition " +
                      (isOpen ? "rotate-180" : "")
                    }
                    aria-label={isOpen ? "Collapse purpose" : "Expand purpose"}
                    aria-expanded={isOpen}
                  >
                    ▾
                  </button>
                </div>

                {!!purpose.description.trim() && (
                  <p className="mt-1.5 break-words text-[11px] leading-snug text-slate-400 [overflow-wrap:anywhere] sm:leading-relaxed">
                    {purpose.description}
                  </p>
                )}
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                  <PurposeDetailsPanel
                    details={detailsForCard}
                    loading={purposeDetailsLoading}
                    error={purposeDetailsError}
                    isSuperAdmin={isSuperAdmin}
                    searchQuery={flatQ}
                    statusFilter="paid"
                    modeFilter={modeFilter}
                    hideHeader
                    onEditPayment={(row) => openEditPayment(row, purpose)}
                    onDeletePayment={(row) => {
                      setDeletePaymentError(null);
                      setDeletePaymentTarget(row);
                    }}
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
          setPurposeModalMode("add");
          setEditingPurpose(null);
          setPurposeModalError(null);
        }}
        onSubmit={handlePurposeSave}
      />

      <PurposeSummaryModal
        open={summaryModalOpen}
        details={
          purposeDetails?.purpose.id === expandedPurposeId ? purposeDetails : null
        }
        loading={purposeDetailsLoading}
        onClose={() => setSummaryModalOpen(false)}
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
          if (p) {
            setFormAmount(p.amountPerFlat ?? p.amount);
            if (normalizeCollectionScope(p.collectionScope) !== "all") {
              setFormTab("sold");
            }
          } else {
            setFormTab("sold");
          }
        }}
        onSelectedKeysChange={setFormSelectedKeys}
        onAmountChange={setFormAmount}
        onDateChange={setFormDate}
        onNotesChange={setFormNotes}
        onModeChange={setFormMode}
        onTabChange={handleFormTabChange}
        onBuilderNameChange={setFormBuilderName}
        onSave={() => void saveCollection()}
        onSwitchToBuilder={() => {
          closeCollectForm();
          openBuilderCollectForm();
        }}
      />

      <BuilderCommonCollectionModal
        open={builderModalOpen && isSuperAdmin}
        mode={builderModalMode}
        initial={editingBuilderCollection}
        saving={builderSaving}
        error={builderModalError}
        onClose={closeBuilderCollectForm}
        onSubmit={handleBuilderCollectionSave}
        onSwitchToMember={
          builderModalMode === "add"
            ? () => {
                closeBuilderCollectForm();
                openCollectForm();
              }
            : undefined
        }
      />

      <ConfirmDeleteModal
        open={!!deletePurposeTarget}
        title="Delete Purpose?"
        loading={deletingPurpose}
        error={deletePurposeError}
        onCancel={() => {
          if (deletingPurpose) return;
          setDeletePurposeTarget(null);
          setDeletePurposeError(null);
        }}
        onConfirm={() => void handlePurposeDelete()}
      >
        <p>Are you sure you want to delete this record?</p>
        {deletePurposeTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">Purpose:</span>{" "}
            <span className="font-bold">{deletePurposeTarget.title}</span>
            {deletePurposeTarget.amountPerFlat || deletePurposeTarget.amount ? (
              <>
                <br />
                <span className="font-semibold">Amount/flat:</span>{" "}
                {deletePurposeTarget.amountPerFlat || deletePurposeTarget.amount}
              </>
            ) : null}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">
          All payment records linked to this Purpose will also be deleted permanently. This action
          cannot be undone.
        </p>
      </ConfirmDeleteModal>

      <EditCollectionModal
        open={!!editingPayment && isSuperAdmin}
        payment={editingPayment}
        purposeTitle={editPaymentPurposeTitle}
        amount={editAmount}
        paymentMode={editMode}
        paymentDate={editDate}
        notes={editNotes}
        saving={editPaymentSaving}
        error={editPaymentError}
        onClose={closeEditPayment}
        onAmountChange={setEditAmount}
        onModeChange={setEditMode}
        onDateChange={setEditDate}
        onNotesChange={setEditNotes}
        onSave={() => void saveEditPayment()}
      />

      <ConfirmDeleteModal
        open={!!deletePaymentTarget && isSuperAdmin}
        title="Delete Collection?"
        loading={deletingPayment}
        error={deletePaymentError}
        onCancel={() => {
          if (deletingPayment) return;
          setDeletePaymentTarget(null);
          setDeletePaymentError(null);
        }}
        onConfirm={() => void handlePaymentDelete()}
      >
        <p>Are you sure you want to delete this collection?</p>
        {deletePaymentTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">Flat:</span>{" "}
            <span className="font-bold">{deletePaymentTarget.flatNumber}</span>
            <br />
            <span className="font-semibold">Amount:</span> {inr(deletePaymentTarget.amount)}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">
          This payment will be removed and the flat will show as pending again.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}
