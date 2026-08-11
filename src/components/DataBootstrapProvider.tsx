"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  bootstrapAppData,
  hasCoreModuleCache,
  isAppDataReady,
} from "@/lib/bootstrap-data";

const AppDataReadyContext = createContext(false);

export function useAppDataReady() {
  return useContext(AppDataReadyContext);
}

function isBareRoute(pathname: string) {
  if (!pathname) return false;
  return pathname === "/login" || pathname.startsWith("/login/");
}

/**
 * Prefetches all module data once when the main app shell mounts,
 * then exposes ready=true so roots render from cache with no first-load fetch.
 */
export default function DataBootstrapProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const bare = isBareRoute(pathname);
  const [ready, setReady] = useState(() => bare || isAppDataReady() || hasCoreModuleCache());

  useEffect(() => {
    if (bare) {
      setReady(true);
      return;
    }

    if (isAppDataReady() || hasCoreModuleCache()) {
      setReady(true);
      // Still ensure any missing keys are filled without blocking UI
      void bootstrapAppData().finally(() => setReady(true));
      return;
    }

    setReady(false);
    let cancelled = false;
    void bootstrapAppData()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [bare]);

  if (!bare && !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface dark:bg-slate-950">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <AppDataReadyContext.Provider value={ready || bare}>
      {children}
    </AppDataReadyContext.Provider>
  );
}
