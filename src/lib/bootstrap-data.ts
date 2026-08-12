/**
 * Progressive application data bootstrap.
 * Critical path warms auth + dashboard first; secondary modules fill the
 * shared cache afterward so the UI is never blocked on a full prefetch.
 * Purpose details are NOT prefetched (loaded on demand by Collections).
 */

import { readCurrentUser } from "@/lib/auth-client";
import { readDashboard } from "@/lib/dashboard-api";
import { readCommonExpenseSplit } from "@/lib/common-expense-split-api";
import { readKiran3CommonBalance } from "@/lib/kiran3-common-api";
import { readFlats } from "@/lib/flats-api";
import { readVehicles } from "@/lib/vehicles-api";
import { readExpenses, readExpenseCategories } from "@/lib/expenses-api";
import { readNotices } from "@/lib/notices-api";
import { readNotificationsForEveryone } from "@/lib/notifications-api";
import { readPurposes } from "@/lib/payment-purposes-api";
import { hasCache, CacheKeys } from "@/lib/data-cache";

let bootstrapPromise: Promise<void> | null = null;
let bootstrapDone = false;
let criticalPromise: Promise<void> | null = null;

export function isAppDataReady(): boolean {
  return bootstrapDone;
}

/** Await the in-flight (or completed) startup prefetch. */
export function awaitAppDataBootstrap(): Promise<void> {
  return bootstrapAppData();
}

function scheduleDeferred(fn: () => void) {
  if (typeof window === "undefined") {
    fn();
    return;
  }
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(() => fn(), { timeout: 2500 });
  } else {
    window.setTimeout(fn, 50);
  }
}

/** Auth + dashboard — enough for home Fund Summary to paint from cache soon. */
export function bootstrapCriticalData(): Promise<void> {
  if (criticalPromise) return criticalPromise;
  criticalPromise = Promise.all([
    readCurrentUser().catch(() => null),
    readDashboard().catch(() => undefined),
  ]).then(() => undefined);
  return criticalPromise;
}

/**
 * Prefetch module datasets into the shared cache without blocking the shell.
 * Safe to call multiple times — shares one promise.
 */
export function bootstrapAppData(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Wave 1 — critical for Dashboard home (parallel, deduped with page fetches)
    await bootstrapCriticalData();

    // Wave 2 — home-adjacent + list roots (parallel). One notices + one notifications call.
    await Promise.all([
      readCommonExpenseSplit(month, year).catch(() => undefined),
      readKiran3CommonBalance().catch(() => undefined),
      readNotices({ q: "" }).catch(() => undefined),
      readNotificationsForEveryone({ limit: 100, status: "all" }).catch(() => undefined),
      readPurposes(false).catch(() => undefined),
      readExpenseCategories().catch(() => undefined),
    ]);

    // Wave 3 — heavier module lists after idle (SPA nav warm; not needed for first paint)
    await new Promise<void>((resolve) => {
      scheduleDeferred(() => {
        void Promise.all([
          readFlats({ status: "all" }).catch(() => undefined),
          readVehicles({ q: "", sticker: "all", type: "all" }).catch(() => undefined),
          readExpenses({ q: "", category: "all" }).catch(() => undefined),
        ]).finally(() => resolve());
      });
    });

    bootstrapDone = true;
  })().catch((err) => {
    bootstrapPromise = null;
    criticalPromise = null;
    bootstrapDone = false;
    throw err;
  });

  return bootstrapPromise;
}

/** True when the default keys every root needs are already warm. */
export function hasCoreModuleCache(): boolean {
  return (
    hasCache(CacheKeys.dashboard()) &&
    hasCache(CacheKeys.flats("", "all")) &&
    hasCache(CacheKeys.vehicles("", "all", "all")) &&
    hasCache(CacheKeys.expenses("", "all")) &&
    hasCache(CacheKeys.purposes(false)) &&
    hasCache(CacheKeys.notices("", 0)) &&
    hasCache(CacheKeys.notifications("all", 100))
  );
}
