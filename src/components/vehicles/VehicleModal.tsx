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

function flatHasRenter(flat: FlatRecord | null) {
  if (!flat) return false;
  return !!(flat.renterName?.trim() || flat.renterMobile?.trim());
}

function flatHasOwner(flat: FlatRecord | null) {
  if (!flat) return false;
  return !!flat.ownerName?.trim();
}

/** Occupied flats only (sold / rent with owner). */
function isSoldFlat(flat: FlatRecord) {
  return (flat.status === "sold" || flat.status === "rent") && !!flat.ownerName?.trim();
}

/** Same style as Add Collection: flat + owner; include renter when present. */
function flatOptionLabel(flat: FlatRecord) {
  const owner = flat.ownerName.trim();
  const renter = flat.renterName?.trim();
  const name = renter ? `${owner} / ${renter}` : owner;
  return `${flat.flatNumber} — ${name}`;
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
  const [flatId, setFlatId] = useState("");
  const [vehicleOwnerType, setVehicleOwnerType] = useState<VehicleOwnerType>("owner");
  const [entries, setEntries] = useState<VehicleEntryInput[]>([emptyEntry()]);
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedFlat = useMemo(
    () => flats.find((f) => f.id === flatId) ?? null,
    [flats, flatId]
  );

  const renterAvailable = flatHasRenter(selectedFlat);
  const ownerAvailable = flatHasOwner(selectedFlat);
  const canSave = !!selectedFlat && ownerAvailable;

  // Load flats when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFlatsLoading(true);
    readFlats({ status: "all" })
      .then((floors) => {
        if (cancelled) return;
        const list = floors
          .flatMap((g) => g.flats)
          .filter(isSoldFlat)
          .sort((a, b) => Number(a.flatNumber) - Number(b.flatNumber));
        setFlats(list);
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
      setFlatId(initial.flatId || "");
      setVehicleOwnerType(initial.vehicleOwnerType || "owner");
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
      setFlatId("");
      setVehicleOwnerType("owner");
      setEntries([emptyEntry()]);
    }
  }, [open, mode, initial]);

  // Resolve flatId from flatNumber when editing older records without flatId
  useEffect(() => {
    if (!open || !flats.length) return;
    if (flatId && flats.some((f) => f.id === flatId)) return;
    if (mode === "edit" && initial?.flatNumber) {
      const match = flats.find((f) => f.flatNumber === initial.flatNumber);
      if (match) setFlatId(match.id);
    }
  }, [open, flats, flatId, mode, initial]);

  // When flat changes (or renter disappears), keep owner type valid
  useEffect(() => {
    if (!selectedFlat) return;
    if (!flatHasRenter(selectedFlat) && vehicleOwnerType === "renter") {
      setVehicleOwnerType("owner");
    }
  }, [selectedFlat, vehicleOwnerType]);

  if (!open) return null;

  function onFlatChange(nextId: string) {
    setFlatId(nextId);
    setLocalError(null);
    setVehicleOwnerType("owner");
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

    if (!selectedFlat) {
      setLocalError("Please select a Flat Number");
      return;
    }
    if (!ownerAvailable) {
      setLocalError("કોઈ માલિક નથી");
      return;
    }
    if (vehicleOwnerType === "renter" && !renterAvailable) {
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

  const displayOwnerName = selectedFlat?.ownerName?.trim() || "";
  const displayOwnerMobile = selectedFlat?.ownerMobile?.trim() || "";
  const displayRenterName = selectedFlat?.renterName?.trim() || "";
  const displayRenterMobile = selectedFlat?.renterMobile?.trim() || "";

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
                value={flatId}
                onChange={(e) => onFlatChange(e.target.value)}
                disabled={flatsLoading}
                required
                className={
                  fieldSelect +
                  " disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                }
              >
                {flatsLoading && <option value="">Loading flats…</option>}
                {!flatsLoading && flats.length === 0 && (
                  <option value="">No flats found</option>
                )}
                {!flatsLoading && flats.length > 0 && (
                  <option value="">Select flat…</option>
                )}
                {!flatsLoading &&
                  flats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {flatOptionLabel(f)}
                    </option>
                  ))}
              </select>
            </label>

            {selectedFlat && !ownerAvailable && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800"
              >
                કોઈ માલિક નથી
              </div>
            )}

            {selectedFlat && ownerAvailable && (
              <>
                {renterAvailable ? (
                  <>
                    <label className="block text-xs font-semibold text-slate-600">
                      Renter Name (Gujarati)
                      <input value={displayRenterName} readOnly className={fieldReadonly} />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      Renter Mobile
                      <input value={displayRenterMobile} readOnly className={fieldReadonly} />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      Owner Name (Gujarati)
                      <input value={displayOwnerName} readOnly className={fieldReadonly} />
                    </label>

                    <div>
                      <div className="text-xs font-semibold text-slate-600">Vehicle Belongs To</div>
                      <div className="mt-1 flex gap-2">
                        {(
                          [
                            ["owner", "Owner"],
                            ["renter", "Renter"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setVehicleOwnerType(value);
                              setLocalError(null);
                            }}
                            className={
                              "h-10 flex-1 rounded-xl border text-sm font-semibold transition " +
                              (vehicleOwnerType === value
                                ? "border-brand bg-brand text-white"
                                : "border-slate-200 bg-white text-slate-600")
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-semibold text-slate-600">
                      Owner Name (Gujarati)
                      <input value={displayOwnerName} readOnly className={fieldReadonly} />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      Owner Mobile
                      <input value={displayOwnerMobile} readOnly className={fieldReadonly} />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      Owner Type
                      <input value="Owner" readOnly className={fieldReadonly} />
                    </label>
                  </>
                )}
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
