"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formField } from "@/lib/form-styles";
import type { NoticeInput, NoticeRecord } from "@/lib/notices-api";

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: NoticeRecord | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: NoticeInput) => Promise<void>;
}

export default function NoticeModal({
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
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (mode === "edit" && initial) {
      setTitle(initial.title);
      setDescription(initial.description);
    } else {
      setTitle("");
      setDescription("");
    }
  }, [open, mode, initial]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!title.trim()) {
      setLocalError("Notice Title is required");
      return;
    }
    if (!description.trim()) {
      setLocalError("Notice Description is required");
      return;
    }
    await onSubmit({ title: title.trim(), description: description.trim() });
  }

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
              {mode === "add" ? "Add Notice" : "Edit Notice"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Title and description</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-400 hover:text-navy">
            Close
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-600">
            Notice Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={formField}
              required
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            Notice Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className={formField + " resize-none"}
              required
            />
          </label>
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
            {saving ? "Saving…" : mode === "add" ? "Add Notice" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
