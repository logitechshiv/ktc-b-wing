"use client";
import { useEffect } from "react";
import { RoleProvider } from "@/context/RoleContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return <RoleProvider>{children}</RoleProvider>;
}
