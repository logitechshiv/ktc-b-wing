export type UserRole = "super_admin" | "admin" | "user";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: boolean;
}

/** Client-safe helpers (no Node-only imports). */
export function formatRoleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
