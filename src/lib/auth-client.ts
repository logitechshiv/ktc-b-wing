import { CacheKeys, cachedQuery } from "@/lib/data-cache";

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

/** Cached GET /api/auth/me — shared across module pages + AdminButton. */
export async function readCurrentUser(): Promise<SafeUser | null> {
  return cachedQuery(CacheKeys.authMe(), async () => {
    const res = await fetch("/api/auth/me", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return (data.user as SafeUser) ?? null;
  });
}
