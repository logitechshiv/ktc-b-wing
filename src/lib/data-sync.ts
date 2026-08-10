/**
 * Cross-page live data sync for the dashboard (and other listeners).
 * Mutations call `notifyDataChanged`; Dashboard subscribes and refetches.
 */

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
      handler(parsed.source || "unknown");
    } catch {
      handler("unknown");
    }
  };

  const onFocus = () => handler("unknown");
  const onVisible = () => {
    if (document.visibilityState === "visible") handler("unknown");
  };

  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
