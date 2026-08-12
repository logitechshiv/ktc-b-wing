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
 * Starts progressive prefetch when the main app shell mounts.
 * Never blocks the UI behind a global loading screen — pages render
 * immediately and hydrate from cache / their own section loaders.
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

  return (
    <AppDataReadyContext.Provider value={bare || ready || isAppDataReady()}>
      {children}
    </AppDataReadyContext.Provider>
  );
}
