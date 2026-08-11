/**
 * Cross-page live data sync.
 * Mutations call `notifyDataChanged` (invalidates shared cache + notifies listeners).
 * Dashboard and module pages subscribe and refetch only after real data changes.
 */

import { invalidateCacheForSource } from "@/lib/data-cache";

export type DataChangeSource =
  | "payment"
  | "expense"
  | "flat"
  | "vehicle"
  | "purpose"
  | "notice"
  | "notification"
  | "unknown";

const EVENT = "ktc:data-changed";
const STORAGE_KEY = "ktc:data-changed";

export function notifyDataChanged(source: DataChangeSource = "unknown") {
  if (typeof window === "undefined") return;
  // Drop stale cache before listeners refetch so they hit the network once.
  invalidateCacheForSource(source);
  const payload = { source, at: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }));
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore private mode / quota */
  }
}

export function subscribeDataChanged(handler: (source: DataChangeSource) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ source?: DataChangeSource }>).detail;
    handler(detail?.source || "unknown");
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as { source?: DataChangeSource };
      // Other tab already mutated — drop local cache then notify.
      invalidateCacheForSource(parsed.source || "unknown");
      handler(parsed.source || "unknown");
    } catch {
      invalidateCacheForSource("unknown");
      handler("unknown");
    }
  };

  // Intentionally no window focus / visibility refetch — navigation and tab focus
  // must reuse the shared cache until a real CRUD notify invalidates it.

  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
