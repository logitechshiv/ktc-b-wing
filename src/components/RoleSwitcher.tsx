"use client";
import { useRole } from "@/context/RoleContext";

export default function RoleSwitcher() {
  const { role, setRole } = useRole();
  return (
    <div
      className="flex items-center rounded-full border border-white/20 bg-white/10 p-0.5 text-[11px] backdrop-blur-sm"
      role="group"
      aria-label="Switch role"
    >
      <button
        type="button"
        onClick={() => setRole("superadmin")}
        className={
          "rounded-full px-2.5 py-1.5 transition " +
          (role === "superadmin" ? "bg-white font-semibold text-navy shadow-sm" : "text-white/75 hover:text-white")
        }
      >
        <span className="sm:hidden">Admin</span>
        <span className="hidden sm:inline">Super Admin</span>
      </button>
      <button
        type="button"
        onClick={() => setRole("editor")}
        className={
          "rounded-full px-2.5 py-1.5 transition " +
          (role === "editor" ? "bg-white font-semibold text-navy shadow-sm" : "text-white/75 hover:text-white")
        }
      >
        Editor
      </button>
    </div>
  );
}
