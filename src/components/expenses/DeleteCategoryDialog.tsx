"use client";

import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

interface Props {
  open: boolean;
  name?: string;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** @deprecated Prefer ConfirmDeleteModal directly */
export default function DeleteCategoryDialog({
  open,
  name,
  loading,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <ConfirmDeleteModal
      open={open}
      title="Delete Expense Category?"
      itemName={name}
      description="Existing expenses that use this category name will keep their category text. This action cannot be undone."
      loading={loading}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
