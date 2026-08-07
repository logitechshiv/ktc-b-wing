"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  BulkVehicleInput,
  VehicleEntryInput,
  VehicleInput,
  VehicleOwnerType,
  VehicleRecord,
  VehicleType,
} from "@/lib/vehicles-api";
import { readFlats, type FlatRecord } from "@/lib/flats-api";
import { formField, formFieldReadonly, formSelect } from "@/lib/form-styles";

const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "car", label: "Car" },
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "auto", label: "Auto" },
  { value: "other", label: "Other" },
];

function emptyEntry(): VehicleEntryInput {
  return {
    vehicleType: "car",
    vehicleNumber: "",
    brand: "",
    model: "",
    color: "",
    stickerIssued: false,
    stickerNumber: "",
    notes: "",
  };
}

type FlatOptionKind = "owner" | "renter" | "none";

interface FlatDropdownOption {
  /** Unique select value: `${flatId}|owner` | `${flatId}|renter` | `${flatId}|none` */
  value: string;
  flatId: string;
  kind: FlatOptionKind;
  label: string;
  disabled: boolean;
}

function optionValue(flatId: string, kind: FlatOptionKind) {
  return `${flatId}|${kind}`;
}

function parseOptionValue(value: string): { flatId: string; kind: FlatOptionKind } | null {
  const sep = value.lastIndexOf("|");
  if (sep <= 0) return null;
  const flatId = value.slice(0, sep);
  const kind = value.slice(sep + 1) as FlatOptionKind;
  if (!flatId || (kind !== "owner" && kind !== "renter" && kind !== "none")) return null;
  return { flatId, kind };
}

/** Sold / rent flats only (exclude unsold). */
function isSoldFlat(flat: FlatRecord) {
  return flat.status === "sold" || flat.status === "rent";
}

/**
 * Sold flats only — one row per flat:
 * - has renter → `101-dipak bhai (Renter)`
 * - owner only → `101-નિલેશ શાહ (Owner)`
 * - no owner → `103-કોઈ માલિક નથી` (disabled)
 */
function buildFlatOptions(flats: FlatRecord[]): FlatDropdownOption[] {
  const sorted = [...flats]
    .filter(isSoldFlat)
    .sort((a, b) => Number(a.flatNumber) - Number(b.flatNumber));
  const options: FlatDropdownOption[] = [];

  for (const flat of sorted) {
    const ownerName = flat.ownerName?.trim() || "";
    const renterName = flat.renterName?.trim() || "";
    const hasRenter = !!(renterName || flat.renterMobile?.trim());

    if (!ownerName) {
      options.push({
        value: optionValue(flat.id, "none"),
        flatId: flat.id,
        kind: "none",
        label: `${flat.flatNumber}-કોઈ માલિક નથી`,
        disabled: true,
      });
      continue;
    }

    if (hasRenter) {
      options.push({
        value: optionValue(flat.id, "renter"),
        flatId: flat.id,
        kind: "renter",
        label: `${flat.flatNumber}-${renterName || "Renter"} (Renter)`,
        disabled: false,
      });
      continue;
    }

    options.push({
      value: optionValue(flat.id, "owner"),
      flatId: flat.id,
      kind: "owner",
      label: `${flat.flatNumber}-${ownerName} (Owner)`,
      disabled: false,
    });
  }

  return options;
}

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: VehicleRecord | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: VehicleInput | BulkVehicleInput) => Promise<void>;
}

export default function VehicleModal({
  open,
  mode,
  initial,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [flats, setFlats] = useState<FlatRecord[]>([]);
  const [flatsLoading, setFlatsLoading] = useState(false);
  /** Combined flat + owner/renter selection */
  const [selection, setSelection] = useState("");
  const [entries, setEntries] = useState<VehicleEntryInput[]>([emptyEntry()]);
  const [localError, setLocalError] = useState<string | null>(null);

  const flatOptions = useMemo(() => buildFlatOptions(flats), [flats]);

  const parsed = useMemo(() => parseOptionValue(selection), [selection]);
  const selectedFlat = useMemo(
    () => (parsed ? flats.find((f) => f.id === parsed.flatId) ?? null : null),
    [flats, parsed]
  );
  const vehicleOwnerType: VehicleOwnerType =
    parsed?.kind === "renter" ? "renter" : "owner";

  const ownerAvailable = !!selectedFlat?.ownerName?.trim();
  const canSave =
    !!selectedFlat &&
    !!parsed &&
    parsed.kind !== "none" &&
    (parsed.kind === "owner"
      ? ownerAvailable
      : !!(selectedFlat.renterName?.trim() || selectedFlat.renterMobile?.trim()));

  // Load all flats when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFlatsLoading(true);
    readFlats({ status: "all" })
      .then((floors) => {
        if (cancelled) return;
        setFlats(floors.flatMap((g) => g.flats).filter(isSoldFlat));
      })
      .catch(() => {
        if (!cancelled) setFlats([]);
      })
      .finally(() => {
        if (!cancelled) setFlatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset form when opened
  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      const kind: FlatOptionKind =
        initial.vehicleOwnerType === "renter" ? "renter" : "owner";
      setSelection(initial.flatId ? optionValue(initial.flatId, kind) : "");
      setEntries([
        {
          vehicleType: initial.vehicleType,
          vehicleNumber: initial.vehicleNumber,
          brand: "",
          model: "",
          color: "",
          stickerIssued: initial.stickerIssued,
          stickerNumber: "",
          notes: initial.notes,
        },
      ]);
    } else {
      setSelection("");
      setEntries([emptyEntry()]);
    }
  }, [open, mode, initial]);

  // Resolve flatId from flatNumber when editing older records without flatId
  useEffect(() => {
    if (!open || !flats.length || mode !== "edit" || !initial) return;
    if (selection && flatOptions.some((o) => o.value === selection && !o.disabled)) return;

    const match = initial.flatId
      ? flats.find((f) => f.id === initial.flatId)
      : flats.find((f) => f.flatNumber === initial.flatNumber);
    if (!match) return;

    const preferRenter = initial.vehicleOwnerType === "renter";
    const hasRenter = !!(match.renterName?.trim() || match.renterMobile?.trim());
    // Dropdown shows only Renter when present; otherwise Owner
    const kind: FlatOptionKind = hasRenter
      ? "renter"
      : match.ownerName?.trim()
        ? "owner"
        : "none";
    if (kind === "none") return;
    // Prefer matching saved ownerType when both were historically possible
    if (preferRenter && hasRenter) {
      setSelection(optionValue(match.id, "renter"));
      return;
    }
    setSelection(optionValue(match.id, kind));
  }, [open, flats, flatOptions, selection, mode, initial]);

  if (!open) return null;

  function onSelectionChange(next: string) {
    const parsedNext = parseOptionValue(next);
    if (parsedNext?.kind === "none") return;
    setSelection(next);
    setLocalError(null);
  }

  function updateEntry(index: number, patch: Partial<VehicleEntryInput>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function addEntry() {
    setEntries((prev) => [...prev, emptyEntry()]);
  }

  function removeEntry(index: number) {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!selectedFlat || !parsed || parsed.kind === "none") {
      setLocalError("Please select a Flat / Owner");
      return;
    }
    if (!ownerAvailable) {
      setLocalError("કોઈ માલિક નથી");
      return;
    }
    if (parsed.kind === "renter" && !selectedFlat.renterName?.trim() && !selectedFlat.renterMobile?.trim()) {
      setLocalError("No renter is available for this flat.");
      return;
    }

    const contactName =
      vehicleOwnerType === "renter"
        ? selectedFlat.renterName.trim()
        : selectedFlat.ownerName.trim();
    const contactMobile =
      vehicleOwnerType === "renter"
        ? selectedFlat.renterMobile.trim()
        : selectedFlat.ownerMobile.trim();

    const cleaned: VehicleEntryInput[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const vehicleNumber = (entry.vehicleNumber || "").trim().toUpperCase().replace(/\s+/g, "");

      if (!vehicleNumber) {
        setLocalError(`Vehicle ${i + 1}: Vehicle Number is required`);
        return;
      }
      if (seen.has(vehicleNumber)) {
        setLocalError(`Duplicate Vehicle Number: ${vehicleNumber}`);
        return;
      }
      seen.add(vehicleNumber);
      cleaned.push({
        vehicleType: entry.vehicleType,
        vehicleNumber,
        brand: "",
        model: "",
        color: "",
        stickerIssued: !!entry.stickerIssued,
        stickerNumber: "",
        notes: (entry.notes || "").trim(),
      });
    }

    const contact = {
      floorNumber: selectedFlat.floorNumber,
      flatNumber: selectedFlat.flatNumber,
      flatId: selectedFlat.id,
      vehicleOwnerType,
      ownerName: contactName,
      ownerMobile: contactMobile,
    };

    if (mode === "edit") {
      await onSubmit({ ...contact, ...cleaned[0] });
      return;
    }

    await onSubmit({ ...contact, vehicles: cleaned });
  }

  const field = formField;
  const fieldSelect = formSelect;
  const fieldReadonly = formFieldReadonly;

  const contactName =
    vehicleOwnerType === "renter"
      ? selectedFlat?.renterName?.trim() || ""
      : selectedFlat?.ownerName?.trim() || "";
  const contactMobile =
    vehicleOwnerType === "renter"
      ? selectedFlat?.renterMobile?.trim() || ""
      : selectedFlat?.ownerMobile?.trim() || "";
  const nameLabel =
    vehicleOwnerType === "renter" ? "Renter Name (Gujarati)" : "Owner Name (Gujarati)";
  const mobileLabel = vehicleOwnerType === "renter" ? "Renter Mobile" : "Owner Mobile";
  const typeLabel = vehicleOwnerType === "renter" ? "Renter" : "Owner";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {mode === "add" ? "Add Vehicle" : "Edit Vehicle"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {mode === "add"
                ? "Add one or more vehicles for the same flat"
                : "Owner, vehicle & sticker details"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-400 hover:text-navy">
            Close
          </button>
        </div>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Owner Information</h3>

            <label className="block text-xs font-semibold text-slate-600">
              Flat / Owner
              <select
                value={selection}
                onChange={(e) => onSelectionChange(e.target.value)}
                disabled={flatsLoading}
                required
                className={
                  fieldSelect +
                  " disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                }
              >
                {flatsLoading && <option value="">Loading flats…</option>}
                {!flatsLoading && flatOptions.length === 0 && (
                  <option value="">No flats found</option>
                )}
                {!flatsLoading && flatOptions.length > 0 && (
                  <option value="">Select flat…</option>
                )}
                {!flatsLoading &&
                  flatOptions.map((o) => (
                    <option key={o.value} value={o.value} disabled={o.disabled}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>

            {selectedFlat && parsed?.kind === "none" && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800"
              >
                કોઈ માલિક નથી
              </div>
            )}

            {selectedFlat && canSave && (
              <>
                <label className="block text-xs font-semibold text-slate-600">
                  Flat Number
                  <input value={selectedFlat.flatNumber} readOnly className={fieldReadonly} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  {nameLabel}
                  <input value={contactName} readOnly className={fieldReadonly} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  {mobileLabel}
                  <input value={contactMobile} readOnly className={fieldReadonly} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Owner Type
                  <input value={typeLabel} readOnly className={fieldReadonly} />
                </label>
              </>
            )}
          </section>

          {entries.map((entry, index) => (
            <section key={index} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Vehicle Information{mode === "add" && entries.length > 1 ? ` ${index + 1}` : ""}
                </h3>
                {mode === "add" && entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Vehicle Type
                  <select
                    value={entry.vehicleType}
                    onChange={(e) => updateEntry(index, { vehicleType: e.target.value as VehicleType })}
                    className={fieldSelect}
                    required
                  >
                    {VEHICLE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Vehicle Number
                  <input
                    value={entry.vehicleNumber}
                    onChange={(e) => updateEntry(index, { vehicleNumber: e.target.value.toUpperCase() })}
                    placeholder="GJ01AB1234"
                    className={field}
                    required
                  />
                </label>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-600">Sticker Issued</div>
                <div className="mt-1 flex gap-2">
                  {(
                    [
                      [false, "No"],
                      [true, "Yes"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => updateEntry(index, { stickerIssued: value, stickerNumber: "" })}
                      className={
                        "h-10 flex-1 rounded-xl border text-sm font-semibold transition " +
                        (entry.stickerIssued === value
                          ? "border-brand bg-brand text-white"
                          : "border-slate-200 bg-white text-slate-600")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-600">
                Notes
                <textarea
                  value={entry.notes}
                  onChange={(e) => updateEntry(index, { notes: e.target.value })}
                  rows={2}
                  className={field + " resize-none"}
                />
              </label>
            </section>
          ))}

          {mode === "add" && (
            <button
              type="button"
              onClick={addEntry}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/40 bg-brand/5 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10"
            >
              + Add another vehicle
            </button>
          )}
        </div>

        {(localError || error) && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {localError || error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !canSave}
            className="h-11 flex-1 rounded-xl bg-black text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : mode === "add"
                ? entries.length > 1
                  ? `Add ${entries.length} Vehicles`
                  : "Add Vehicle"
                : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
