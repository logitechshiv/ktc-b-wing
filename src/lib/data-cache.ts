/**
 * In-memory app data cache shared across client navigations.
 * Survives page remounts (module lives in the JS heap while the SPA shell stays up).
 * Invalidated by `notifyDataChanged` so CRUD never leaves stale UI.
 */

export type CacheInvalidationSource =
  | "payment"
  | "expense"
  | "flat"
  | "vehicle"
  | "purpose"
  | "notice"
  | "notification"
  | "unknown";

type CacheEntry = { value: unknown; at: number };

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export const CacheKeys = {
  dashboard: () => "dashboard",
  commonExpenseSplit: (month: number, year: number) =>
    `common-expense-split:${month}:${year}`,
  kiran3Common: () => "kiran3-common",
  flats: (q = "", status = "all") => `flats:q=${q}|status=${status}`,
  vehicles: (q = "", sticker = "all", type = "all") =>
    `vehicles:q=${q}|sticker=${sticker}|type=${type}`,
  expenses: (q = "", category = "all") => `expenses:q=${q}|category=${category}`,
  expenseCategories: () => "expense-categories",
  notices: (q = "", limit = 0) => `notices:q=${q}|limit=${limit}`,
  notifications: (status = "all", limit = 50) =>
    `notifications:status=${status}|limit=${limit}`,
  purposes: (activeOnly = false) => `purposes:active=${activeOnly ? 1 : 0}`,
  purposeDetails: (id: string) => `purpose-details:${id}`,
  authMe: () => "auth:me",
} as const;

/** Synchronous peek — undefined if missing. */
export function peekCache<T>(key: string): T | undefined {
  const hit = store.get(key);
  return hit ? (hit.value as T) : undefined;
}

export function setCache<T>(key: string, value: T): void {
  store.set(key, { value, at: Date.now() });
}

export function hasCache(key: string): boolean {
  return store.has(key);
}

/** Invalidate exact keys and/or key prefixes (prefix match if key ends with "*"). */
export function invalidateCache(...keysOrPrefixes: string[]): void {
  if (keysOrPrefixes.length === 0) {
    store.clear();
    inflight.clear();
    return;
  }
  for (const pattern of keysOrPrefixes) {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      for (const key of [...store.keys()]) {
        if (key.startsWith(prefix)) store.delete(key);
      }
      for (const key of [...inflight.keys()]) {
        if (key.startsWith(prefix)) inflight.delete(key);
      }
    } else {
      store.delete(pattern);
      inflight.delete(pattern);
    }
  }
}

/**
 * Return cached value when present; otherwise run fetcher once (deduped).
 * Pass `force: true` to bypass cache (e.g. notification bell poll).
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { force?: boolean }
): Promise<T> {
  if (!opts?.force) {
    const hit = store.get(key);
    if (hit) return hit.value as T;

    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const run = fetcher()
    .then((value) => {
      setCache(key, value);
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  if (!opts?.force) {
    inflight.set(key, run);
  }
  return run;
}

/** Map mutation sources → cache keys/prefixes to drop. */
export function invalidateCacheForSource(source: CacheInvalidationSource): void {
  switch (source) {
    case "payment":
    case "purpose":
      invalidateCache(
        CacheKeys.dashboard(),
        "purposes:*",
        "purpose-details:*",
        "notifications:*",
        "common-expense-split:*",
        "builder-common-collections:*"
      );
      break;
    case "expense":
      invalidateCache(
        CacheKeys.dashboard(),
        "expenses:*",
        CacheKeys.expenseCategories(),
        "common-expense-split:*",
        "builder-common-collections:*",
        CacheKeys.kiran3Common(),
        "notifications:*"
      );
      break;
    case "flat":
      invalidateCache(
        CacheKeys.dashboard(),
        "flats:*",
        "common-expense-split:*",
        "purpose-details:*",
        "purposes:*",
        "notifications:*"
      );
      break;
    case "vehicle":
      invalidateCache(CacheKeys.dashboard(), "vehicles:*", "notifications:*");
      break;
    case "notice":
      invalidateCache("notices:*", "notifications:*");
      break;
    case "notification":
      invalidateCache("notifications:*");
      break;
    case "unknown":
    default:
      invalidateCache();
      break;
  }
}
