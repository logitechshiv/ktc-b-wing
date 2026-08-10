"use client";

import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

interface Props {
  open: boolean;
  title?: string;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** @deprecated Prefer ConfirmDeleteModal directly */
export default function DeletePurposeDialog({
  open,
  title,
  loading,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <ConfirmDeleteModal
      open={open}
      title="Delete Purpose?"
      itemName={title}
      description="All payment records linked to this Purpose will also be deleted permanently. This action cannot be undone."
      loading={loading}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
