"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { FlatInput, FlatRecord, FlatStatus } from "@/lib/flats-api";
import { formField, formSelect } from "@/lib/form-styles";

const FLOORS = Array.from({ length: 13 }, (_, i) => i + 1);

function flatsForFloor(floor: number) {
  return [1, 2, 3, 4].map((u) => String(floor * 100 + u));
}

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: FlatRecord | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: FlatInput) => Promise<void>;
}

export default function PlotDetailsModal({
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
  const [status, setStatus] = useState<FlatStatus>("available");
  const [ownerName, setOwnerName] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [renterName, setRenterName] = useState("");
  const [renterMobile, setRenterMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const flatOptions = useMemo(() => flatsForFloor(floorNumber), [floorNumber]);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setFloorNumber(initial.floorNumber);
      setFlatNumber(initial.flatNumber);
      setStatus(initial.status);
      setOwnerName(initial.ownerName);
      setOwnerMobile(initial.ownerMobile);
      setRenterName(initial.renterName);
      setRenterMobile(initial.renterMobile);
      setNotes(initial.notes);
    } else {
      setFloorNumber(1);
      setFlatNumber("101");
      setStatus("available");
      setOwnerName("");
      setOwnerMobile("");
      setRenterName("");
      setRenterMobile("");
      setNotes("");
    }
  }, [open, mode, initial]);

  useEffect(() => {
    if (mode === "add" && !flatOptions.includes(flatNumber)) {
      setFlatNumber(flatOptions[0]);
    }
  }, [flatOptions, flatNumber, mode]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (ownerMobile && !/^\d{10}$/.test(ownerMobile)) {
      setLocalError("Owner Mobile must be exactly 10 digits");
      return;
    }
    if (renterMobile && !/^\d{10}$/.test(renterMobile)) {
      setLocalError("Renter Mobile must be exactly 10 digits");
      return;
    }
    if (mode === "add" && !String(flatNumber).trim()) {
      setLocalError("Flat Number is required");
      return;
    }

    const nextOwnerName = ownerName.trim();
    const nextOwnerMobile = ownerMobile.trim();
    const nextRenterName = renterName.trim();
    const nextRenterMobile = renterMobile.trim();
    const hasRenter = !!(nextRenterName || nextRenterMobile);

    const nextStatus: FlatStatus = hasRenter && status === "available" ? "rent" : status;

    await onSubmit({
      floorNumber,
      flatNumber,
      status: nextStatus,
      ownerName: nextOwnerName,
      ownerMobile: nextOwnerMobile,
      renterName: nextRenterName,
      renterMobile: nextRenterMobile,
      notes: notes.trim(),
    });
  }

  const field = formField;
  const fieldSelect = formSelect;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {mode === "add" ? "Add Plot Details" : `Edit Flat ${initial?.flatNumber ?? ""}`}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Owner, renter & status for B-Wing flats</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-400 hover:text-navy">
            Close
          </button>
        </div>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Property Details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-600">
                Floor Number
                <select
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(Number(e.target.value))}
                  disabled={mode === "edit"}
                  className={fieldSelect + (mode === "edit" ? " bg-slate-50 dark:bg-slate-900" : "")}
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
                  disabled={mode === "edit"}
                  className={fieldSelect + (mode === "edit" ? " bg-slate-50 dark:bg-slate-900" : "")}
                  required
                >
                  {flatOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FlatStatus)}
                  className={fieldSelect}
                  required
                >
                  <option value="available">Unsold</option>
                  <option value="sold">Sold</option>
                  <option value="rent">Rent</option>
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Owner Details</h3>
            <label className="block text-xs font-semibold text-slate-600">
              Owner Name (Gujarati)
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={field} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Owner Mobile Number
              <input
                value={ownerMobile}
                onChange={(e) => setOwnerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                className={field}
                placeholder="10-digit mobile"
              />
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Renter Details (Optional)
            </h3>
            <p className="text-[11px] text-slate-400">
              If you add renter details, status will be saved as Rent and shown on the flat card.
            </p>
            <label className="block text-xs font-semibold text-slate-600">
              Renter Name (Gujarati)
              <input
                value={renterName}
                onChange={(e) => setRenterName(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Renter Mobile Number
              <input
                value={renterMobile}
                onChange={(e) => setRenterMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                className={field}
                placeholder="10-digit mobile"
              />
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Additional Information</h3>
            <label className="block text-xs font-semibold text-slate-600">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={field}
              />
            </label>
          </section>
        </div>

        {(localError || error) && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
            {localError || error}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 flex-1 rounded-xl bg-navy text-sm font-semibold text-white transition hover:bg-[#063A6B] disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
