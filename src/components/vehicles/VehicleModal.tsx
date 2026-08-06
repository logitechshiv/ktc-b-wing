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
import { formField, formFieldReadonly, formSelect } from "@/lib/form-styles";

const FLOORS = Array.from({ length: 13 }, (_, i) => i + 1);

const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: "car", label: "Car" },
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "auto", label: "Auto" },
  { value: "other", label: "Other" },
];

function flatsForFloor(floor: number) {
  return [1, 2, 3, 4].map((u) => String(floor * 100 + u));
}

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

interface FlatContact {
  ownerName: string;
  ownerMobile: string;
  renterName: string;
  renterMobile: string;
}

function hasRenter(flat: FlatContact | null) {
  if (!flat) return false;
  return !!(flat.renterName || flat.renterMobile);
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
  const [floorNumber, setFloorNumber] = useState(1);
  const [flatNumber, setFlatNumber] = useState("101");
  const [vehicleOwnerType, setVehicleOwnerType] = useState<VehicleOwnerType>("owner");
  const [contactName, setContactName] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [entries, setEntries] = useState<VehicleEntryInput[]>([emptyEntry()]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const [flatContact, setFlatContact] = useState<FlatContact | null>(null);

  const flatOptions = useMemo(() => flatsForFloor(floorNumber), [floorNumber]);
  const renterAvailable = hasRenter(flatContact);

  function applyContactFromFlat(type: VehicleOwnerType, flat: FlatContact | null) {
    if (!flat) return;
    if (type === "renter") {
      setContactName(flat.renterName);
      setContactMobile(flat.renterMobile);
    } else {
      setContactName(flat.ownerName);
      setContactMobile(flat.ownerMobile);
    }
  }

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setFloorNumber(initial.floorNumber);
      setFlatNumber(initial.flatNumber);
      setVehicleOwnerType(initial.vehicleOwnerType || "owner");
      setContactName(initial.ownerName);
      setContactMobile(initial.ownerMobile);
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
      setFloorNumber(1);
      setFlatNumber("101");
      setVehicleOwnerType("owner");
      setContactName("");
      setContactMobile("");
      setFlatContact(null);
      setEntries([emptyEntry()]);
    }
  }, [open, mode, initial]);

  useEffect(() => {
    if (mode === "add" && !flatOptions.includes(flatNumber)) {
      setFlatNumber(flatOptions[0]);
    }
  }, [flatOptions, flatNumber, mode]);

  // Load flat owner/renter whenever floor/flat changes
  useEffect(() => {
    if (!open || !flatNumber) return;
    let cancelled = false;
    setPrefilling(true);
    fetch(`/api/flats?q=${encodeURIComponent(flatNumber)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const floors = (data.floors as Array<{ flats: Array<Record<string, unknown>> }>) || [];
        const match = floors
          .flatMap((f) => f.flats || [])
          .find((f) => String(f.flatNumber) === flatNumber);

        if (!match || cancelled) {
          setFlatContact(null);
          return;
        }

        const next: FlatContact = {
          ownerName: String(match.ownerName ?? ""),
          ownerMobile: String(match.ownerMobile ?? ""),
          renterName: String(match.renterName ?? ""),
          renterMobile: String(match.renterMobile ?? ""),
        };
        setFlatContact(next);

        if (!hasRenter(next)) {
          setVehicleOwnerType((prev) => (prev === "renter" ? "owner" : prev));
        }
      })
      .catch(() => {
        if (!cancelled) setFlatContact(null);
      })
      .finally(() => {
        if (!cancelled) setPrefilling(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, floorNumber, flatNumber]);

  // Keep displayed contact in sync with belongs-to + flat registry
  useEffect(() => {
    if (!open || !flatContact) return;
    if (vehicleOwnerType === "renter" && !hasRenter(flatContact)) return;
    applyContactFromFlat(vehicleOwnerType, flatContact);
  }, [open, flatContact, vehicleOwnerType]);

  function selectBelongsTo(type: VehicleOwnerType) {
    setLocalError(null);
    if (type === "renter" && !renterAvailable) {
      setLocalError("No renter is available for this flat.");
      return;
    }
    setVehicleOwnerType(type);
    applyContactFromFlat(type, flatContact);
  }

  if (!open) return null;

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

    if (vehicleOwnerType === "renter" && !renterAvailable) {
      setLocalError("No renter is available for this flat.");
      return;
    }

    if (contactMobile && !/^\d{10}$/.test(contactMobile.trim())) {
      setLocalError(
        vehicleOwnerType === "renter"
          ? "Renter Mobile must be exactly 10 digits"
          : "Owner Mobile must be exactly 10 digits"
      );
      return;
    }

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
      floorNumber,
      flatNumber,
      vehicleOwnerType,
      ownerName: contactName.trim(),
      ownerMobile: contactMobile.trim(),
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

  const nameLabel =
    vehicleOwnerType === "renter" ? "Renter Name (Gujarati)" : "Owner Name (Gujarati)";
  const mobileLabel = vehicleOwnerType === "renter" ? "Renter Mobile" : "Owner Mobile";

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-600">
                Floor Number
                <select
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(Number(e.target.value))}
                  className={fieldSelect}
                  required
                >
                  {FLOORS.map((f) => (
                    <option key={f} value={f}>
                      Floor {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Flat Number
                <select
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  className={fieldSelect}
                  required
                >
                  {flatOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Vehicle Belongs To</div>
              <div className="mt-1 flex gap-2">
                {(
                  [
                    ["owner", "Owner"],
                    ["renter", "Renter"],
                  ] as const
                ).map(([value, label]) => {
                  const disabled = value === "renter" && !renterAvailable && !prefilling;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectBelongsTo(value)}
                      className={
                        "h-10 flex-1 rounded-xl border text-sm font-semibold transition " +
                        (vehicleOwnerType === value
                          ? "border-brand bg-brand text-white"
                          : "border-slate-200 bg-white text-slate-600") +
                        (disabled ? " cursor-not-allowed opacity-45" : "")
                      }
                      title={
                        disabled ? "No renter is available for this flat." : undefined
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {!prefilling && !renterAvailable && (
                <p className="mt-1.5 text-[11px] text-amber-600">
                  No renter is available for this flat.
                </p>
              )}
            </div>

            {prefilling && (
              <p className="text-[11px] text-slate-400">Loading contact from flat registry…</p>
            )}

            <label className="block text-xs font-semibold text-slate-600">
              {nameLabel}
              <input value={contactName} readOnly className={fieldReadonly} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              {mobileLabel}
              <input
                value={contactMobile}
                readOnly
                inputMode="numeric"
                maxLength={10}
                placeholder="10 digits"
                className={fieldReadonly}
              />
            </label>
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
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-black text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-70"
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
