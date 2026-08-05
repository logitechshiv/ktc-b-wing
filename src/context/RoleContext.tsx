"use client";
import { createContext, useContext, useState } from "react";
import type { Role } from "@/lib/types";
import { permsFor, type Permissions } from "@/lib/roles";

interface Ctx {
  role: Role;
  setRole: (r: Role) => void;
  perms: Permissions;
}

const RoleCtx = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("superadmin");
  return <RoleCtx.Provider value={{ role, setRole, perms: permsFor(role) }}>{children}</RoleCtx.Provider>;
}

export function useRole() {
  const c = useContext(RoleCtx);
  if (!c) throw new Error("useRole must be used within RoleProvider");
  return c;
}
