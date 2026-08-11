export type NotificationType =
  | "FLAT_ADDED"
  | "FLAT_UPDATED"
  | "COLLECTION_ADDED"
  | "EXPENSE_ADDED"
  | "NOTICE_CREATED"
  | "VEHICLE_ADDED";

const ROUTE_BY_RELATED_TYPE: Record<string, string> = {
  flat: "/flats",
  payment: "/collections",
  builder_payment: "/collections",
  expense: "/expenses",
  notice: "/notices",
  vehicle: "/vehicles",
};

const ROUTE_BY_NOTIFICATION_TYPE: Record<string, string> = {
  FLAT_ADDED: "/flats",
  FLAT_UPDATED: "/flats",
  COLLECTION_ADDED: "/collections",
  EXPENSE_ADDED: "/expenses",
  NOTICE_CREATED: "/notices",
  VEHICLE_ADDED: "/vehicles",
};

const MODULE_ROOTS = new Set([
  "/flats",
  "/collections",
  "/expenses",
  "/vehicles",
  "/notices",
]);

function normalizeModuleRoute(raw: string): string | null {
  const path = String(raw || "").trim();
  if (!path.startsWith("/")) return null;
  // Individual notification clicks must never land on the notifications inbox
  if (path === "/notifications" || path.startsWith("/notifications/")) return null;
  const root = "/" + path.split("/").filter(Boolean)[0];
  if (MODULE_ROOTS.has(root)) return root;
  if (MODULE_ROOTS.has(path)) return path;
  return null;
}

/**
 * Resolve the module root for a notification.
 * Prefer targetRoute → meta.targetRoute → relatedType → type.
 * Never use message text. Never returns /notifications.
 */
export function resolveNotificationRoute(n: {
  type?: string | null;
  relatedType?: string | null;
  targetRoute?: string | null;
  meta?: Record<string, unknown> | null;
}): string {
  const fromTop = normalizeModuleRoute(String(n.targetRoute || ""));
  if (fromTop) return fromTop;

  const fromMeta = normalizeModuleRoute(String(n.meta?.targetRoute || ""));
  if (fromMeta) return fromMeta;

  const related = String(n.relatedType || "").trim().toLowerCase();
  if (related && ROUTE_BY_RELATED_TYPE[related]) {
    return ROUTE_BY_RELATED_TYPE[related];
  }

  const type = String(n.type || "").trim().toUpperCase();
  if (type && ROUTE_BY_NOTIFICATION_TYPE[type]) {
    return ROUTE_BY_NOTIFICATION_TYPE[type];
  }

  return "/";
}

/** @deprecated Prefer resolveNotificationRoute(notification) */
export function notificationHref(type: NotificationType | string): string {
  return resolveNotificationRoute({ type });
}

export interface UserNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string | null;
  relatedType: string | null;
  /** Module root for click navigation, e.g. /flats — never /notifications */
  targetRoute: string;
  meta: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const GUEST_READ_KEY = "ktc:notif-read-ids";
const GUEST_HIDDEN_KEY = "ktc:notif-hidden-ids";

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

function toNotification(raw: Record<string, unknown>): UserNotification {
  const meta =
    raw.meta && typeof raw.meta === "object"
      ? ({ ...(raw.meta as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const base = {
    id: String(raw.id ?? ""),
    recipientId: String(raw.recipientId ?? ""),
    type: String(raw.type ?? "NOTICE_CREATED") as NotificationType,
    title: String(raw.title ?? ""),
    message: String(raw.message ?? ""),
    relatedId: raw.relatedId ? String(raw.relatedId) : null,
    relatedType: raw.relatedType ? String(raw.relatedType) : null,
    targetRoute: raw.targetRoute ? String(raw.targetRoute) : "",
    meta,
    isRead: !!raw.isRead,
    readAt: raw.readAt ? String(raw.readAt) : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : "",
  };
  const targetRoute = resolveNotificationRoute(base);
  return {
    ...base,
    targetRoute,
    meta: {
      ...meta,
      targetRoute,
    },
  };
}

function readIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function applyGuestReadState(
  notifications: UserNotification[]
): { notifications: UserNotification[]; unreadCount: number } {
  const readIds = readIdSet(GUEST_READ_KEY);
  const hiddenIds = readIdSet(GUEST_HIDDEN_KEY);
  const visible = notifications
    .filter((n) => !hiddenIds.has(n.id))
    .map((n) => ({
      ...n,
      isRead: readIds.has(n.id),
      readAt: readIds.has(n.id) ? n.readAt || new Date().toISOString() : null,
    }));
  const unreadCount = visible.filter((n) => !n.isRead).length;
  return { notifications: visible, unreadCount };
}

export function guestMarkRead(id: string) {
  const readIds = readIdSet(GUEST_READ_KEY);
  readIds.add(id);
  writeIdSet(GUEST_READ_KEY, readIds);
}

export function guestMarkAllRead(ids: string[]) {
  const readIds = readIdSet(GUEST_READ_KEY);
  for (const id of ids) readIds.add(id);
  writeIdSet(GUEST_READ_KEY, readIds);
}

export function guestHideNotification(id: string) {
  const hidden = readIdSet(GUEST_HIDDEN_KEY);
  hidden.add(id);
  writeIdSet(GUEST_HIDDEN_KEY, hidden);
  guestMarkRead(id);
}

/**
 * Public feed for everyone. Uses auth read-state when logged in.
 * Guests get feed + localStorage read tracking.
 */
export async function readNotificationsForEveryone(params: {
  limit?: number;
  status?: "all" | "unread" | "read";
} = {}): Promise<{
  notifications: UserNotification[];
  unreadCount: number;
  authenticated: boolean;
}> {
  const sp = new URLSearchParams();
  if (params.limit) sp.set("limit", String(params.limit));
  // Always fetch all from server for guests; filter locally after read-state
  if (params.status && params.status !== "all") sp.set("status", "all");
  else if (params.status) sp.set("status", params.status);

  const res = await fetch(`/api/notifications/public?${sp.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await parseJson(res);
  const authenticated = !!data.authenticated;
  let notifications = ((data.notifications as Record<string, unknown>[]) || []).map(
    toNotification
  );
  let unreadCount = Number(data.unreadCount) || 0;

  if (!authenticated) {
    const guest = applyGuestReadState(notifications);
    notifications = guest.notifications;
    unreadCount = guest.unreadCount;
  }

  if (params.status === "unread") {
    notifications = notifications.filter((n) => !n.isRead);
  } else if (params.status === "read") {
    notifications = notifications.filter((n) => n.isRead);
  }

  return { notifications, unreadCount, authenticated };
}

export async function readNotifications(params: {
  limit?: number;
  status?: "all" | "unread" | "read";
} = {}): Promise<{ notifications: UserNotification[]; unreadCount: number; unauthorized?: boolean }> {
  const result = await readNotificationsForEveryone(params);
  return {
    notifications: result.notifications,
    unreadCount: result.unreadCount,
  };
}

export async function readUnreadCount(): Promise<number> {
  const data = await readNotificationsForEveryone({ limit: 50, status: "all" });
  return data.unreadCount;
}

export async function markNotificationRead(
  id: string,
  authenticated = true
): Promise<{ notification: UserNotification | null; unreadCount: number }> {
  if (!authenticated) {
    guestMarkRead(id);
    const data = await readNotificationsForEveryone({ limit: 50 });
    const notification = data.notifications.find((n) => n.id === id) || null;
    return { notification, unreadCount: data.unreadCount };
  }

  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
  });
  // Any auth failure / missing recipient → guest local read (User + Admin both still navigate)
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    guestMarkRead(id);
    const data = await readNotificationsForEveryone({ limit: 50 });
    return {
      notification: data.notifications.find((n) => n.id === id) || null,
      unreadCount: data.unreadCount,
    };
  }
  const data = await parseJson(res);
  return {
    notification: toNotification(data.notification as Record<string, unknown>),
    unreadCount: Number(data.unreadCount) || 0,
  };
}

export async function markAllNotificationsRead(
  authenticated = true,
  ids: string[] = []
): Promise<number> {
  if (!authenticated) {
    guestMarkAllRead(ids);
    const data = await readNotificationsForEveryone({ limit: 50 });
    return data.unreadCount;
  }

  const res = await fetch("/api/notifications/read-all", {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (res.status === 401) {
    guestMarkAllRead(ids);
    const data = await readNotificationsForEveryone({ limit: 50 });
    return data.unreadCount;
  }
  const data = await parseJson(res);
  return Number(data.unreadCount) || 0;
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}
