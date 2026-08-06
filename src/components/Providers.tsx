"use client";
import { useEffect } from "react";
import { RoleProvider } from "@/context/RoleContext";
import { ThemeProvider } from "@/context/ThemeContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <RoleProvider>{children}</RoleProvider>
    </ThemeProvider>
  );
}
