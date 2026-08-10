"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Building2, Home } from "lucide-react";
import type { PurposeInput, PurposeRecord } from "@/lib/payment-purposes-api";
import {
  DEFAULT_COLLECTION_SCOPE,
  normalizeCollectionScope,
  type CollectionScope,
} from "@/lib/collection-scope";
import { inr } from "@/lib/format";
import { formField } from "@/lib/form-styles";

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: PurposeRecord | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: PurposeInput) => Promise<void>;
}

export default function PurposeModal({
  open,
  mode,
  initial,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amountPerFlat, setAmountPerFlat] = useState(0);
  const [collectionScope, setCollectionScope] =
    useState<CollectionScope>(DEFAULT_COLLECTION_SCOPE);
  const [isActive, setIsActive] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setTitle(initial.title);
      setDescription(initial.description);
      setAmountPerFlat(initial.amountPerFlat ?? initial.amount);
      setCollectionScope(normalizeCollectionScope(initial.collectionScope));
      setIsActive(initial.isActive);
    } else {
      setTitle("");
      setDescription("");
      setAmountPerFlat(0);
      setCollectionScope(DEFAULT_COLLECTION_SCOPE);
      setIsActive(true);
    }
  }, [open, mode, initial]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!title.trim()) {
      setLocalError("Purpose Title is required");
      return;
    }
    if (!Number.isFinite(amountPerFlat) || amountPerFlat < 0) {
      setLocalError("Amount Per Flat is required");
      return;
    }
    if (collectionScope !== "sold" && collectionScope !== "all") {
      setLocalError("Collection Applicable To is required");
      return;
    }
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      amountPerFlat,
      amount: amountPerFlat,
      collectionScope,
      isActive,
    });
  }

  const field = formField;

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
              {mode === "add" ? "Add Purpose" : "Edit Purpose"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Purpose (Round) for payment collections</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-400 hover:text-navy">
            Close
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            Purpose Title <span className="text-rose-500">*</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Monthly Maintenance — Aug 2025"
              className={field}
              required
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Description <span className="font-normal text-slate-400">(Optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short note about this collection round"
              className={field + " resize-none"}
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Amount Per Flat <span className="text-rose-500">*</span>
            <span className="ml-1 font-normal text-slate-400">({inr(amountPerFlat || 0)})</span>
            <input
              type="number"
              min={0}
              value={amountPerFlat}
              onChange={(e) => setAmountPerFlat(Number(e.target.value))}
              className={field}
              required
            />
          </label>

          <div>
            <div className="text-xs font-semibold text-slate-600">
              Collection Applicable To <span className="text-rose-500">*</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "sold" as const,
                    label: "Sold Flats Only",
                    hint: "Owner / Renter flats",
                    Icon: Home,
                  },
                  {
                    value: "all" as const,
                    label: "All Flats",
                    hint: "Sold + Unsold / Builder",
                    Icon: Building2,
                  },
                ] as const
              ).map(({ value, label, hint, Icon }) => {
                const selected = collectionScope === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCollectionScope(value)}
                    className={
                      "rounded-xl border px-3 py-2.5 text-left transition " +
                      (selected
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[9px] " +
                          (selected ? "border-brand" : "border-current")
                        }
                        aria-hidden
                      >
                        {selected ? "●" : "○"}
                      </span>
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold leading-tight">{label}</span>
                        <span
                          className={
                            "mt-0.5 block text-[10px] font-normal leading-tight " +
                            (selected ? "text-brand/70" : "text-slate-400")
                          }
                        >
                          {hint}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600">Status</div>
            <div className="mt-1 flex gap-2">
              {(
                [
                  [true, "Active"],
                  [false, "Inactive"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setIsActive(value)}
                  className={
                    "h-10 flex-1 rounded-xl border text-sm font-semibold transition " +
                    (isActive === value
                      ? "border-brand bg-brand text-white"
                      : "border-slate-200 bg-white text-slate-600")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
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
            {saving ? "Saving…" : mode === "add" ? "Add Purpose" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
