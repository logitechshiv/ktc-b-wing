"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inr } from "@/lib/format";
import type { PurposeRecord, PurposeUnsoldPendingFlat } from "@/lib/payment-purposes-api";
import type { CollectPersonOption, PaymentMode } from "@/lib/payments-api";
import { normalizeCollectionScope } from "@/lib/collection-scope";
import { formSelect } from "@/lib/form-styles";

export type CollectionFlatTab = "sold" | "unsold";

interface Props {
  open: boolean;
  purposes: PurposeRecord[];
  searchablePurposes: PurposeRecord[];
  formPurposeId: string;
  formPurposeLocked: boolean;
  formPurposeSearch: string;
  collectOptions: CollectPersonOption[];
  formPendingLoading: boolean;
  formAllPaid: boolean;
  formSelectedKeys: string[];
  formAmount: number;
  formDate: string;
  formNotes: string;
  formMode: PaymentMode;
  formSaving: boolean;
  formTab: CollectionFlatTab;
  formBuilderName: string;
  formUnsoldPending: PurposeUnsoldPendingFlat[];
  formUnsoldAllPaid: boolean;
  error?: string | null;
  onClose: () => void;
  onPurposeSearchChange: (value: string) => void;
  onPurposeChange: (purposeId: string) => void;
  onSelectedKeysChange: (keys: string[]) => void;
  onAmountChange: (amount: number) => void;
  onDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
  onModeChange: (mode: PaymentMode) => void;
  onTabChange: (tab: CollectionFlatTab) => void;
  onBuilderNameChange: (name: string) => void;
  onSave: () => void;
  /** Switch Add Collection to Common-Expense Builder form */
  onSwitchToBuilder?: () => void;
}

export default function CollectionModal({
  open,
  purposes,
  searchablePurposes,
  formPurposeId,
  formPurposeLocked,
  formPurposeSearch,
  collectOptions,
  formPendingLoading,
  formAllPaid,
  formSelectedKeys,
  formAmount,
  formDate,
  formNotes,
  formMode,
  formSaving,
  formTab,
  formBuilderName: _formBuilderName,
  formUnsoldPending: _formUnsoldPending,
  formUnsoldAllPaid: _formUnsoldAllPaid,
  error,
  onClose,
  onPurposeSearchChange,
  onPurposeChange,
  onSelectedKeysChange,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onModeChange,
  onTabChange,
  onBuilderNameChange: _onBuilderNameChange,
  onSave,
  onSwitchToBuilder,
}: Props) {
  const [personSearch, setPersonSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPersonSearch("");
      setDropdownOpen(false);
    }
  }, [open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const purposeOptions = formPurposeLocked
    ? purposes.filter((p) => p.id === formPurposeId)
    : searchablePurposes;

  // Member collection is sold flats only — Builder payer type handles common-expense builder share
  useEffect(() => {
    if (open && formTab !== "sold") onTabChange("sold");
  }, [open, formTab, onTabChange]);

  const soldBlocked = !formPurposeId || formAllPaid || formPendingLoading;
  const canSaveSold =
    !formSaving && !!formPurposeId && !formAllPaid && formSelectedKeys.length > 0 && formAmount > 0;

  const selectedOptions = useMemo(() => {
    const map = new Map(collectOptions.map((o) => [o.key, o]));
    return formSelectedKeys.map((k) => map.get(k)).filter(Boolean) as CollectPersonOption[];
  }, [collectOptions, formSelectedKeys]);

  const filteredOptions = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return collectOptions;
    return collectOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.flatNumber.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.ownerType.toLowerCase().includes(q)
    );
  }, [collectOptions, personSearch]);

  function toggleKey(key: string) {
    if (formSelectedKeys.includes(key)) {
      onSelectedKeysChange(formSelectedKeys.filter((k) => k !== key));
    } else {
      onSelectedKeysChange([...formSelectedKeys, key]);
    }
  }

  function removeKey(key: string) {
    onSelectedKeysChange(formSelectedKeys.filter((k) => k !== key));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !formSaving) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-sm font-bold text-navy">New collection</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={formSaving}
            className="text-sm font-medium text-slate-400 hover:text-navy"
          >
            Close
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs font-semibold text-slate-600">Payer Type</div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-xl border border-brand bg-brand/5 px-3 py-2.5 text-left text-sm font-semibold text-brand"
            >
              Member
            </button>
            <button
              type="button"
              disabled={formSaving || !onSwitchToBuilder}
              onClick={() => onSwitchToBuilder?.()}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Builder
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Purpose
            {!formPurposeLocked && (
              <input
                value={formPurposeSearch}
                onChange={(e) => onPurposeSearchChange(e.target.value)}
                placeholder="Search purpose…"
                className="mt-1 mb-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            )}
            <select
              value={formPurposeId}
              onChange={(e) => onPurposeChange(e.target.value)}
              disabled={formPurposeLocked}
              className={
                formSelect +
                (formPurposeLocked
                  ? " cursor-default bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  : "")
              }
            >
              {!formPurposeLocked && <option value="">Select purpose…</option>}
              {purposeOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {normalizeCollectionScope(p.collectionScope) === "all" ? "All · " : "Sold · "}
                  {p.title} ({inr(p.amountPerFlat ?? p.amount)})
                </option>
              ))}
            </select>
            {formPurposeLocked && (
              <span className="mt-1 block text-[11px] font-normal text-slate-400">
                Purpose is locked to the currently selected purpose.
              </span>
            )}
          </label>

          <div className="block text-xs font-semibold text-slate-600">
            Flat / Owner / Renter
            <div ref={dropdownRef} className="relative mt-1">
              <button
                type="button"
                disabled={soldBlocked}
                onClick={() => setDropdownOpen((v) => !v)}
                className={
                  "flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 " +
                  (dropdownOpen ? "border-brand" : "")
                }
              >
                <span className="truncate text-slate-600">
                  {!formPurposeId
                    ? "Select a purpose first…"
                    : formPendingLoading
                      ? "Loading…"
                      : formSelectedKeys.length > 0
                        ? `${formSelectedKeys.length} selected`
                        : "Search & select Owner/Renter…"}
                </span>
                <span className="text-slate-400" aria-hidden>
                  ▾
                </span>
              </button>

              {dropdownOpen && !soldBlocked && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 p-2">
                    <input
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      placeholder="Search flat, name…"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-brand"
                      autoFocus
                    />
                  </div>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {filteredOptions.map((opt) => {
                      const checked = formSelectedKeys.includes(opt.key);
                      return (
                        <li key={opt.key}>
                          <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-brand/5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleKey(opt.key)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                            />
                            <span className="min-w-0 leading-snug text-navy">{opt.label}</span>
                          </label>
                        </li>
                      );
                    })}
                    {filteredOptions.length === 0 && (
                      <li className="px-3 py-4 text-center text-sm text-slate-400">
                        No matching Owner/Renter
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {selectedOptions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedOptions.map((opt) => (
                  <span
                    key={opt.key}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 text-[11px] font-medium text-brand"
                  >
                    <span className="truncate">{opt.label}</span>
                    <button
                      type="button"
                      disabled={formSaving}
                      onClick={() => removeKey(opt.key)}
                      className="shrink-0 text-brand/70 hover:text-brand"
                      aria-label={`Remove ${opt.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {formPurposeId && formAllPaid && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              No pending sold flats with owners for this purpose.
            </p>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Amount (Per Flat)
            <input
              type="number"
              value={formAmount}
              onChange={(e) => onAmountChange(Number(e.target.value))}
              disabled={soldBlocked}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:opacity-60"
            />
          </label>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-600">Payment Method</div>
            <div className="flex flex-wrap gap-2">
              {(["cash", "bank", "upi", "cheque"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={soldBlocked}
                  onClick={() => onModeChange(m)}
                  className={
                    "min-w-[4.5rem] flex-1 rounded-xl border px-3 py-2 text-sm capitalize disabled:opacity-50 " +
                    (formMode === m
                      ? "border-brand bg-brand/5 font-medium text-brand"
                      : "border-slate-200 text-slate-600")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Payment Date
            <input
              type="date"
              value={formDate}
              onChange={(e) => onDateChange(e.target.value)}
              disabled={soldBlocked}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:opacity-60"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Notes
            <input
              type="text"
              value={formNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              disabled={soldBlocked}
              placeholder="Notes (optional)"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:opacity-60"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={!canSaveSold}
            className="w-full rounded-xl bg-navy py-2.5 text-sm font-medium text-white disabled:opacity-70"
          >
            {formSaving ? "Saving…" : "Save collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
