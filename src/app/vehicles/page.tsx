"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPhone, formatPlate } from "@/lib/format";
import type { SafeUser } from "@/lib/auth-client";
import {
  createVehicle,
  createVehicles,
  deleteVehicle,
  readVehicles,
  updateVehicle,
  type BulkVehicleInput,
  type VehicleGroup,
  type VehicleInput,
  type VehicleRecord,
  type VehicleSummary,
  type VehicleType,
} from "@/lib/vehicles-api";
import { notifyDataChanged } from "@/lib/data-sync";
import VehicleModal from "@/components/vehicles/VehicleModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

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

function VehicleIcon({ type }: { type: VehicleType }) {
  if (type === "bike") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-lg" title="Bike" aria-hidden>
        🏍️
      </span>
    );
  }
  if (type === "auto") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-lg" title="Auto" aria-hidden>
        🛺
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-lg" title="Car" aria-hidden>
      🚗
    </span>
  );
}

const TYPE_FILTERS: { value: VehicleType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "car", label: "Car" },
  { value: "bike", label: "Bike" },
  { value: "auto", label: "Auto" },
];

const STICKER_FILTERS: { value: "all" | "yes" | "no"; label: string }[] = [
  { value: "all", label: "All stickers" },
  { value: "yes", label: "Sticker Yes" },
  { value: "no", label: "No Sticker" },
];

const TYPE_SORT_RANK: Record<string, number> = { car: 0, bike: 1, auto: 2 };

/** Flat-number-wise listing: cards ordered by flat, vehicles by type under each flat. */
function sortGroupsByFlatNumber(groups: VehicleGroup[]): VehicleGroup[] {
  return [...groups]
    .map((g) => ({
      ...g,
      vehicles: [...g.vehicles].sort(
        (a, b) =>
          (TYPE_SORT_RANK[a.vehicleType] ?? 99) - (TYPE_SORT_RANK[b.vehicleType] ?? 99) ||
          String(a.vehicleNumber).localeCompare(String(b.vehicleNumber))
      ),
    }))
    .sort(
      (a, b) =>
        Number(a.flatNumber) - Number(b.flatNumber) ||
        a.flatNumber.localeCompare(b.flatNumber) ||
        a.vehicleOwnerType.localeCompare(b.vehicleOwnerType)
    );
}

export default function VehiclesPage() {
  const [q, setQ] = useState("");
  const [stickerFilter, setStickerFilter] = useState<"all" | "yes" | "no">("all");
  const [typeFilter, setTypeFilter] = useState<VehicleType | "all">("all");
  const [copied, setCopied] = useState<string | null>(null);

  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [summary, setSummary] = useState<VehicleSummary>({
    total: 0,
    cars: 0,
    bikes: 0,
    autos: 0,
    twoWheel: 0,
    noSticker: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<VehicleRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<VehicleRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readVehicles({
        q,
        sticker: stickerFilter,
        type: typeFilter,
      });
      setGroups(sortGroupsByFlatNumber(data.groups));
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load vehicles");
      setGroups([]);
      setSummary({ total: 0, cars: 0, bikes: 0, autos: 0, twoWheel: 0, noSticker: 0 });
    } finally {
      setLoading(false);
    }
  }, [q, stickerFilter, typeFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 2500);
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  function openAdd() {
    setModalMode("add");
    setEditing(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(vehicle: VehicleRecord) {
    setModalMode("edit");
    setEditing(vehicle);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSave(data: VehicleInput | BulkVehicleInput) {
    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === "edit") {
        if (!editing?.id) throw new Error("Missing vehicle id — cannot update");
        await updateVehicle(editing.id, data as VehicleInput);
        flashSuccess("Vehicle updated");
      } else if ("vehicles" in data) {
        const created = await createVehicles(data);
        flashSuccess(created.length === 1 ? "Vehicle added" : `${created.length} vehicles added`);
      } else {
        await createVehicle(data);
        flashSuccess("Vehicle added");
      }
      setModalOpen(false);
      setEditing(null);
      await load();
      notifyDataChanged("vehicle");
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
      await deleteVehicle(deleteTarget.id);
      setDeleteTarget(null);
      flashSuccess("Vehicle deleted");
      await load();
      notifyDataChanged("vehicle");
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
          <h1 className="text-lg font-bold text-navy">Vehicles</h1>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-black px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-900 active:scale-[0.98] sm:px-4 sm:text-[13px]"
          >
            + Add Vehicle
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-center shadow-sm">
          <div className="text-xl font-bold tabular-nums text-brand sm:text-2xl">{summary.total}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">Total</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-center shadow-sm">
          <div className="text-xl font-bold tabular-nums text-brand sm:text-2xl">{summary.cars}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">Cars</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-center shadow-sm">
          <div className="text-xl font-bold tabular-nums text-teal-600 sm:text-2xl">{summary.twoWheel}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">2-Wheelers</div>
        </div>
      </div>

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
        <span className="mt-0.5 shrink-0 text-brand" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </span>
        <span>
          અહીં ફ્લેટ નંબર અથવા વાહન નંબર નાખીને કોઈપણ ફ્લેટના માલિકનું નામ, મોબાઈલ નંબર અને તેમના વાહનની વિગત જોઈ શકાય છે
        </span>
      </p>

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Vehicle No / Flat No / Owner / Mobile"
          className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs">
        {TYPE_FILTERS.map(({ value, label }) => {
          const count =
            value === "all"
              ? summary.total
              : value === "car"
                ? summary.cars
                : value === "bike"
                  ? summary.bikes
                  : summary.autos;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={
                "shrink-0 rounded-full border px-3 py-1.5 font-medium transition " +
                (typeFilter === value
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-500")
              }
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs">
        {STICKER_FILTERS.map(({ value, label }) => {
          const count =
            value === "all"
              ? summary.total
              : value === "yes"
                ? Math.max(0, summary.total - summary.noSticker)
                : summary.noSticker;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setStickerFilter(value)}
              className={
                "shrink-0 rounded-full border px-3 py-1.5 font-medium transition " +
                (stickerFilter === value
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-500")
              }
            >
              {label} ({count})
            </button>
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

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span aria-hidden>📋</span>
        નંબર પર દબાવો તો કોપી થઈ જશે
      </p>

      {loading && (
        <p className="py-8 text-center text-sm text-slate-400">Loading vehicles…</p>
      )}

      {!loading &&
        groups.map((group) => {
          // Role tag must come from MongoDB vehicleOwnerType on the vehicle docs
          const vehicleOwnerType =
            String(
              group.vehicles[0]?.vehicleOwnerType ?? group.vehicleOwnerType ?? "owner"
            ).toLowerCase() === "renter"
              ? "renter"
              : "owner";
          const roleLabel = vehicleOwnerType === "renter" ? "Renter" : "Owner";
          const displayName = group.ownerName || `Flat ${group.flatNumber}`;
          const displayMobile = group.ownerMobile;

          return (
            <section
              key={group.key}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
            >
              <div className="flex flex-col items-center px-4 pb-2 pt-4">
                <span
                  className={
                    "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white " +
                    badgeColor(group.flatNumber, group.floorNumber)
                  }
                >
                  {group.flatNumber}
                </span>
                <div className="mt-2 text-center text-base font-bold text-navy">{displayName} <span className="mt-0.5 text-[11px] font-medium text-slate-400">({roleLabel})</span></div>
                
                {displayMobile && (
                  <button
                    type="button"
                    onClick={() => copyText("phone-" + group.key, displayMobile)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums text-brand hover:bg-brand/5"
                    title="Copy number"
                  >
                    <span className="text-rose-500" aria-hidden>
                      ☎
                    </span>
                    {formatPhone(displayMobile)}
                    {copied === "phone-" + group.key && (
                      <span className="text-[10px] font-medium text-emerald-600">Copied</span>
                    )}
                  </button>
                )}
              </div>

              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {group.vehicles.map((v) => (
                  <li key={v.id} className="flex items-start gap-2.5 px-3 py-2.5 sm:px-4">
                    <VehicleIcon type={v.vehicleType} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => copyText("plate-" + v.id, v.vehicleNumber)}
                        className="w-full text-left"
                        title="Copy vehicle number"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold tabular-nums tracking-wide text-brand">
                            {v.vehicleNumber ? formatPlate(v.vehicleNumber) : "No number"}
                          </span>
                          <span
                            className={
                              "shrink-0 text-[11px] font-medium " +
                              (v.stickerIssued ? "text-emerald-600" : "text-amber-600")
                            }
                          >
                            સ્ટીકર: {v.stickerIssued ? "Yes" : "No"}
                          </span>
                        </div>
                        {copied === "plate-" + v.id && (
                          <div className="text-[10px] font-medium text-emerald-600">Number copied</div>
                        )}
                      </button>
                      {v.notes?.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-snug text-slate-500">
                          {v.notes.trim()}
                        </p>
                      ) : null}
                    </div>
                    {isSuperAdmin && (
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => openEdit(v)}
                          className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(v);
                          }}
                          className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      {!loading && groups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No vehicles match your search.</p>
      )}

      <VehicleModal
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
        title="Delete Vehicle?"
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
            <span className="font-semibold">Vehicle:</span>{" "}
            <span className="font-bold tabular-nums">{deleteTarget.vehicleNumber}</span>
            <br />
            <span className="font-semibold">Flat:</span>{" "}
            <span className="tabular-nums">{deleteTarget.flatNumber}</span>
            {deleteTarget.ownerName ? (
              <>
                <br />
                <span className="font-semibold">Owner:</span> {deleteTarget.ownerName}
              </>
            ) : null}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">
          Only this vehicle record will be removed. Flat details will not be affected.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}
