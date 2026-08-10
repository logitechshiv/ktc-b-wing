"use client";

import type { ReactNode } from "react";

export interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  /** Record name/identifier shown in the confirmation sentence */
  itemName?: string;
  /** Wrap itemName in quotes (default true) */
  quoteItemName?: boolean;
  /**
   * Lead-in before the item name.
   * Example: "Are you sure you want to delete"
   */
  message?: string;
  /** Extra caution line under the main message */
  description?: string;
  /** Optional fully custom body (overrides message/itemName/description) */
  children?: ReactNode;
  confirmLabel?: string;
  loadingLabel?: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shared delete confirmation popup — use for every delete action in the app.
 * Visual style matches the existing modal system (do not redesign).
 */
export default function ConfirmDeleteModal({
  open,
  title,
  itemName,
  quoteItemName = true,
  message = "Are you sure you want to delete",
  description = "This action cannot be undone.",
  children,
  confirmLabel = "Delete",
  loadingLabel = "Deleting…",
  loading = false,
  error = null,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!open) return null;

  const displayName = itemName
    ? quoteItemName
      ? `"${itemName}"`
      : itemName
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-[22px] bg-white p-5 shadow-xl">
        <h3 id="confirm-delete-title" className="text-lg font-bold text-navy">
          {title}
        </h3>

        <div className="mt-2 text-sm leading-relaxed text-slate-600">
          {children ? (
            children
          ) : (
            <>
              <p>
                {message}
                {displayName ? (
                  <>
                    {" "}
                    <span className="font-semibold text-navy">{displayName}</span>
                  </>
                ) : null}
                ?
              </p>
              {description ? <p className="mt-2 text-xs text-slate-400">{description}</p> : null}
            </>
          )}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (loading) return;
              onConfirm();
            }}
            disabled={loading}
            className="h-11 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-70"
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
