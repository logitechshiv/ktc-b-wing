"use client";
import { useEffect } from "react";
import { RoleProvider } from "@/context/RoleContext";
import { ThemeProvider } from "@/context/ThemeContext";
import DataBootstrapProvider from "@/components/DataBootstrapProvider";

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
      <RoleProvider>
        <DataBootstrapProvider>{children}</DataBootstrapProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}
