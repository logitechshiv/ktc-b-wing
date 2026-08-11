/**
 * One-shot application data bootstrap.
 * Prefetches every module's default read into the shared `data-cache`,
 * so navigating roots never triggers a first-visit network load.
 */

import { readCurrentUser } from "@/lib/auth-client";
import { readDashboard } from "@/lib/dashboard-api";
import { readCommonExpenseSplit } from "@/lib/common-expense-split-api";
import { readFlats } from "@/lib/flats-api";
import { readVehicles } from "@/lib/vehicles-api";
import { readExpenses, readExpenseCategories } from "@/lib/expenses-api";
import { readNotices } from "@/lib/notices-api";
import { readNotificationsForEveryone } from "@/lib/notifications-api";
import { readPurposes, readPurposeDetails } from "@/lib/payment-purposes-api";
import { hasCache, CacheKeys } from "@/lib/data-cache";

let bootstrapPromise: Promise<void> | null = null;
let bootstrapDone = false;

export function isAppDataReady(): boolean {
  return bootstrapDone;
}

/** Await the in-flight (or completed) startup prefetch. */
export function awaitAppDataBootstrap(): Promise<void> {
  return bootstrapAppData();
}

/**
 * Prefetch all default module datasets in parallel into the existing cache.
 * Safe to call multiple times — shares one promise.
 */
export function bootstrapAppData(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Wave 1 — independent module roots (parallel)
    const [purposesResult] = await Promise.all([
      readPurposes(false).catch(() => ({ purposes: [], stats: [] })),
      readCurrentUser().catch(() => null),
      readDashboard().catch(() => undefined),
      readCommonExpenseSplit(month, year).catch(() => undefined),
      readFlats({ status: "all" }).catch(() => undefined),
      readVehicles({ q: "", sticker: "all", type: "all" }).catch(() => undefined),
      readExpenses({ q: "", category: "all" }).catch(() => undefined),
      readExpenseCategories().catch(() => undefined),
      readNotices({ q: "" }).catch(() => undefined),
      readNotices({ limit: 3 }).catch(() => undefined),
      readNotificationsForEveryone({ limit: 100, status: "all" }).catch(() => undefined),
      readNotificationsForEveryone({ limit: 12, status: "all" }).catch(() => undefined),
    ]);

    // Wave 2 — purpose details for collections accordion / filter summary
    const purposes = purposesResult?.purposes ?? [];
    if (purposes.length > 0) {
      await Promise.all(
        purposes.map((p) => readPurposeDetails(p.id).catch(() => undefined))
      );
    }

    bootstrapDone = true;
  })().catch((err) => {
    // Allow a retry on next call if the whole bootstrap failed hard
    bootstrapPromise = null;
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
