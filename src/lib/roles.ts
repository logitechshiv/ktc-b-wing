import type { Role } from "./types";

export interface Permissions {
  canAddOperational: boolean;
  canAddFinancial: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
}

// Confirmed model: Editors can ADD (operational + financial) but never edit or delete.
// Only the Super Admin can edit/adjust or delete records and manage users.
export function permsFor(role: Role): Permissions {
  if (role === "superadmin") {
    return { canAddOperational: true, canAddFinancial: true, canEdit: true, canDelete: true, canManageUsers: true };
  }
  return { canAddOperational: true, canAddFinancial: true, canEdit: false, canDelete: false, canManageUsers: false };
}
