"use client";
import { useEffect } from "react";
import { RoleProvider } from "@/context/RoleContext";
import { ThemeProvider } from "@/context/ThemeContext";
import DataBootstrapProvider from "@/components/DataBootstrapProvider";

function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {});
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <ThemeProvider>
      <RoleProvider>
        <DataBootstrapProvider>{children}</DataBootstrapProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}
