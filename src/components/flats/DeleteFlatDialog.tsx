"use client";

import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

interface Props {
  open: boolean;
  flatNumber?: string;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** @deprecated Prefer ConfirmDeleteModal directly */
export default function DeleteFlatDialog({
  open,
  flatNumber,
  loading,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <ConfirmDeleteModal
      open={open}
      title="Remove flat details?"
      confirmLabel="Remove details"
      loadingLabel="Removing…"
      loading={loading}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p>
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
    </ConfirmDeleteModal>
  );
}
