"use client";

import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

interface Props {
  open: boolean;
  vehicleNumber?: string;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** @deprecated Prefer ConfirmDeleteModal directly */
export default function DeleteVehicleDialog({
  open,
  vehicleNumber,
  loading,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <ConfirmDeleteModal
      open={open}
      title="Delete Vehicle?"
      message="Are you sure you want to delete vehicle"
      itemName={vehicleNumber}
      quoteItemName={false}
      description="Only this vehicle record will be removed. Flat details will not be affected."
      loading={loading}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
