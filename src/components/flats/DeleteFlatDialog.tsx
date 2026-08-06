"use client";

interface Props {
  open: boolean;
  flatNumber?: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteFlatDialog({ open, flatNumber, loading, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-[22px] bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-navy">Remove flat details?</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Are you sure you want to remove this flat details
          {flatNumber ? (
            <>
              {" "}
              for <span className="font-semibold text-navy">{flatNumber}</span>
            </>
          ) : null}
          ?
        </p>
        <p className="mt-2 text-xs text-slate-400">
          The flat card will stay. Owner/renter info will be cleared and status set to Unsold.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="h-11 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-70"
          >
            {loading ? "Removing…" : "Remove details"}
          </button>
        </div>
      </div>
    </div>
  );
}
