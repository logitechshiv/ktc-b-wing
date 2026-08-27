"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formField } from "@/lib/form-styles";
import type {
  ImportantNumberInput,
  ImportantNumberRecord,
} from "@/lib/important-numbers-api";

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: ImportantNumberRecord | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: ImportantNumberInput) => Promise<void>;
}

export default function ImportantNumberModal({
  open,
  mode,
  initial,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setName(initial.name);
      setDescription(initial.description || "");
      setPhone(initial.phone || "");
    } else {
      setName("");
      setDescription("");
      setPhone("");
    }
  }, [open, mode, initial]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!name.trim()) {
      setLocalError("Name / Title is required");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      setLocalError("Phone Number is required");
      return;
    }
    if (!/^\d{10}$/.test(digits)) {
      setLocalError("Phone Number must be exactly 10 digits");
      return;
    }
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      area: "",
      phone: digits,
      displayOrder: 0,
      isActive: true,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {mode === "add" ? "Add Important Number" : "Edit Important Number"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Society contact details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-400 hover:text-navy"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            Name / Title <span className="text-rose-500">*</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formField}
              required
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={formField + " resize-none"}
              placeholder="Optional short note"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Phone Number <span className="text-rose-500">*</span>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={formField}
              placeholder="10-digit mobile"
              required
            />
          </label>
        </div>

        {(localError || error) && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
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
            {saving ? "Saving…" : mode === "add" ? "Add Number" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
