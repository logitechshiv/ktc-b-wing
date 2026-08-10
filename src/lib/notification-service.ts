import mongoose from "mongoose";
import User from "@/models/User";
import Notification, {
  NOTIFICATION_TYPES,
  type NotificationType,
  type NotificationRelatedType,
} from "@/models/Notification";
import NotificationRecipient from "@/models/NotificationRecipient";
import { inr } from "@/lib/format";

const TARGET_ROUTE_BY_RELATED: Record<string, string> = {
  flat: "/flats",
  payment: "/collections",
  builder_payment: "/collections",
  expense: "/expenses",
  notice: "/notices",
  vehicle: "/vehicles",
};

const TARGET_ROUTE_BY_TYPE: Record<string, string> = {
  FLAT_ADDED: "/flats",
  FLAT_UPDATED: "/flats",
  COLLECTION_ADDED: "/collections",
  EXPENSE_ADDED: "/expenses",
  NOTICE_CREATED: "/notices",
  VEHICLE_ADDED: "/vehicles",
};

function resolveTargetRoute(
  type: string,
  relatedType?: string | null,
  meta?: Record<string, unknown>
): string {
  const fromMeta = String(meta?.targetRoute || "").trim();
  if (fromMeta.startsWith("/")) return fromMeta;
  const related = String(relatedType || "").trim().toLowerCase();
  if (related && TARGET_ROUTE_BY_RELATED[related]) return TARGET_ROUTE_BY_RELATED[related];
  const t = String(type || "").trim().toUpperCase();
  if (t && TARGET_ROUTE_BY_TYPE[t]) return TARGET_ROUTE_BY_TYPE[t];
  return "/";
}
export type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string | null;
  relatedType?: NotificationRelatedType | null;
  dedupeKey: string;
  meta?: Record<string, unknown>;
  /** If omitted, fan-out to all active users */
  targetUserIds?: string[];
  /** Always include this user in recipients (e.g. creating Super Admin) */
  actorUserId?: string;
};

export type UserNotificationDTO = {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId: string | null;
  relatedType: string | null;
  meta: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

function serializeUserNotification(
  recipient: {
    _id: { toString(): string };
    isRead?: boolean | null;
    readAt?: Date | null;
    createdAt?: Date | null;
  },
  notification: {
    _id: { toString(): string };
    type: string;
    title: string;
    message: string;
    relatedId?: string | null;
    relatedType?: string | null;
    meta?: Record<string, unknown> | null;
    createdAt?: Date | null;
  }
): UserNotificationDTO {
  return {
    id: notification._id.toString(),
    recipientId: recipient._id.toString(),
    type: notification.type as NotificationType,
    title: notification.title,
    message: notification.message,
    relatedId: notification.relatedId ? String(notification.relatedId) : null,
    relatedType: notification.relatedType ? String(notification.relatedType) : null,
    meta: (notification.meta || {}) as Record<string, unknown>,
    isRead: !!recipient.isRead,
    readAt: recipient.readAt ? new Date(recipient.readAt).toISOString() : null,
    createdAt: notification.createdAt
      ? new Date(notification.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

async function resolveTargetUserIds(explicit?: string[]): Promise<mongoose.Types.ObjectId[]> {
  if (explicit && explicit.length > 0) {
    return explicit
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  }
  const users = await User.find({ status: true }).select("_id").lean();
  return users.map((u) => u._id as mongoose.Types.ObjectId);
}

/**
 * Create a society notification and fan-out per-user recipient rows.
 * Duplicate dedupeKey is ignored (idempotent). Never throws for CRUD callers —
 * wrap externally if needed; this function returns null on soft failure.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ notificationId: string; created: boolean } | null> {
  try {
    if (!NOTIFICATION_TYPES.includes(input.type)) return null;
    const dedupeKey = String(input.dedupeKey || "").trim();
    if (!dedupeKey) return null;

    let notification = await Notification.findOne({ dedupeKey });
    let created = false;

    if (!notification) {
      try {
        const meta = { ...(input.meta || {}) };
        if (!meta.targetRoute) {
          meta.targetRoute = resolveTargetRoute(
            input.type,
            input.relatedType,
            meta
          );
        }
        notification = await Notification.create({
          type: input.type,
          title: String(input.title || "").trim(),
          message: String(input.message || "").trim(),
          relatedId: input.relatedId ? String(input.relatedId) : null,
          relatedType: input.relatedType || null,
          dedupeKey,
          meta,
        });
        created = true;
      } catch (err: unknown) {
        const code =
          err && typeof err === "object" && "code" in err
            ? Number((err as { code: number }).code)
            : 0;
        if (code === 11000) {
          notification = await Notification.findOne({ dedupeKey });
          created = false;
        } else {
          throw err;
        }
      }
    }

    if (!notification) return null;

    const userIds = await resolveTargetUserIds(input.targetUserIds);
    if (input.actorUserId && mongoose.Types.ObjectId.isValid(input.actorUserId)) {
      const actorOid = new mongoose.Types.ObjectId(input.actorUserId);
      if (!userIds.some((id) => id.equals(actorOid))) {
        userIds.push(actorOid);
      }
    }
    if (userIds.length === 0) {
      return { notificationId: notification._id.toString(), created };
    }

    const createdAt = notification.createdAt || new Date();
    const docs = userIds.map((userId) => ({
      notificationId: notification!._id,
      userId,
      isRead: false,
      readAt: null,
      createdAt,
    }));

    try {
      await NotificationRecipient.insertMany(docs, { ordered: false });
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? Number((err as { code: number }).code)
          : 0;
      // Ignore duplicate recipient rows
      if (code !== 11000) {
        const writeErrors =
          err && typeof err === "object" && "writeErrors" in err
            ? (err as { writeErrors?: Array<{ code?: number }> }).writeErrors
            : null;
        const onlyDupes =
          Array.isArray(writeErrors) &&
          writeErrors.length > 0 &&
          writeErrors.every((e) => e.code === 11000);
        if (!onlyDupes && code !== 11000) {
          console.error("notification recipient fan-out error:", err);
        }
      }
    }

    return { notificationId: notification._id.toString(), created };
  } catch (error) {
    console.error("createNotification error:", error);
    return null;
  }
}

/** Fire-and-forget helper — never blocks / fails parent CRUD. */
export function enqueueNotification(input: CreateNotificationInput): void {
  void createNotification(input).catch((err) => {
    console.error("enqueueNotification error:", err);
  });
}

export async function countUnreadForUser(userId: string): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
  await ensureRecipientsForUser(userId);
  return NotificationRecipient.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    isRead: false,
  });
}

/** Backfill recipient rows so logged-in users see society notifications they missed. */
async function ensureRecipientsForUser(userId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  const uid = new mongoose.Types.ObjectId(userId);
  const recent = await Notification.find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .select("_id createdAt")
    .lean();
  if (recent.length === 0) return;

  const ids = recent.map((n) => n._id);
  const existing = await NotificationRecipient.find({
    userId: uid,
    notificationId: { $in: ids },
  })
    .select("notificationId")
    .lean();
  const have = new Set(existing.map((e) => String(e.notificationId)));
  const missing = recent.filter((n) => !have.has(String(n._id)));
  if (missing.length === 0) return;

  try {
    await NotificationRecipient.insertMany(
      missing.map((n) => ({
        notificationId: n._id,
        userId: uid,
        isRead: false,
        readAt: null,
        createdAt: n.createdAt || new Date(),
      })),
      { ordered: false }
    );
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? Number((err as { code: number }).code)
        : 0;
    if (code !== 11000) {
      const writeErrors =
        err && typeof err === "object" && "writeErrors" in err
          ? (err as { writeErrors?: Array<{ code?: number }> }).writeErrors
          : null;
      const onlyDupes =
        Array.isArray(writeErrors) &&
        writeErrors.length > 0 &&
        writeErrors.every((e) => e.code === 11000);
      if (!onlyDupes) {
        console.error("ensureRecipientsForUser error:", err);
      }
    }
  }
}

export async function listNotificationsForUser(params: {
  userId: string;
  limit?: number;
  status?: "all" | "unread" | "read";
}): Promise<{ notifications: UserNotificationDTO[]; unreadCount: number }> {
  const userId = params.userId;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { notifications: [], unreadCount: 0 };
  }

  await ensureRecipientsForUser(userId);

  const uid = new mongoose.Types.ObjectId(userId);
  const limit = Math.min(100, Math.max(1, params.limit || 30));
  const status = params.status || "all";

  const filter: Record<string, unknown> = { userId: uid };
  if (status === "unread") filter.isRead = false;
  if (status === "read") filter.isRead = true;

  const [recipients, unreadCount] = await Promise.all([
    NotificationRecipient.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).lean(),
    NotificationRecipient.countDocuments({ userId: uid, isRead: false }),
  ]);

  if (recipients.length === 0) {
    return { notifications: [], unreadCount };
  }

  const ids = recipients.map((r) => r.notificationId);
  const notes = await Notification.find({ _id: { $in: ids } }).lean();
  const byId = new Map(notes.map((n) => [n._id.toString(), n]));

  const notifications: UserNotificationDTO[] = [];
  for (const r of recipients) {
    const n = byId.get(String(r.notificationId));
    if (!n) continue;
    notifications.push(serializeUserNotification(r as never, n as never));
  }

  return { notifications, unreadCount };
}

export async function markNotificationReadForUser(
  userId: string,
  notificationId: string
): Promise<UserNotificationDTO | null> {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
    return null;
  }

  await ensureRecipientsForUser(userId);

  const recipient = await NotificationRecipient.findOneAndUpdate(
    {
      userId: new mongoose.Types.ObjectId(userId),
      notificationId: new mongoose.Types.ObjectId(notificationId),
    },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  ).lean();

  if (!recipient) return null;

  const notification = await Notification.findById(notificationId).lean();
  if (!notification) return null;

  return serializeUserNotification(recipient as never, notification as never);
}

export async function markAllNotificationsReadForUser(userId: string): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return 0;
  const result = await NotificationRecipient.updateMany(
    { userId: new mongoose.Types.ObjectId(userId), isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result.modifiedCount || 0;
}

export async function listPublicNotifications(params: {
  limit?: number;
}): Promise<UserNotificationDTO[]> {
  const limit = Math.min(100, Math.max(1, params.limit || 30));
  const notes = await Notification.find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return notes.map((n) =>
    serializeUserNotification(
      {
        _id: n._id,
        isRead: false,
        readAt: null,
        createdAt: n.createdAt || null,
      },
      n as never
    )
  );
}

export async function deleteNotificationForUser(
  userId: string,
  notificationId: string
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
    return false;
  }
  const result = await NotificationRecipient.deleteOne({
    userId: new mongoose.Types.ObjectId(userId),
    notificationId: new mongoose.Types.ObjectId(notificationId),
  });
  return (result.deletedCount || 0) > 0;
}

/** Super Admin — permanently remove notification + all recipient rows */
export async function deleteNotificationAsAdmin(notificationId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) return false;
  const oid = new mongoose.Types.ObjectId(notificationId);
  const existing = await Notification.findById(oid).select("_id").lean();
  if (!existing) return false;
  await NotificationRecipient.deleteMany({ notificationId: oid });
  await Notification.deleteOne({ _id: oid });
  return true;
}

/* ——— Event helpers ——— */

function normFlatText(value: unknown): string {
  return String(value || "").trim();
}

/**
 * Notify when an existing Flat's owner/renter details are actually changed.
 * Returns null when nothing relevant changed (no notification).
 */
export async function notifyFlatDetailsUpdated(input: {
  id: string;
  flatNumber: string;
  before: {
    ownerName?: string | null;
    ownerMobile?: string | null;
    renterName?: string | null;
    renterMobile?: string | null;
  };
  after: {
    ownerName?: string | null;
    ownerMobile?: string | null;
    renterName?: string | null;
    renterMobile?: string | null;
  };
  actorUserId?: string;
  /** Stable stamp from Flat.updatedAt after save — prevents duplicate double-submit */
  updatedAt?: Date | string | null;
}): Promise<{ notificationId: string; created: boolean } | null> {
  const flatNumber = normFlatText(input.flatNumber);
  const beforeOwnerName = normFlatText(input.before.ownerName);
  const beforeOwnerMobile = normFlatText(input.before.ownerMobile);
  const beforeRenterName = normFlatText(input.before.renterName);
  const beforeRenterMobile = normFlatText(input.before.renterMobile);

  const afterOwnerName = normFlatText(input.after.ownerName);
  const afterOwnerMobile = normFlatText(input.after.ownerMobile);
  const afterRenterName = normFlatText(input.after.renterName);
  const afterRenterMobile = normFlatText(input.after.renterMobile);

  const ownerChanged =
    beforeOwnerName !== afterOwnerName || beforeOwnerMobile !== afterOwnerMobile;
  const renterChanged =
    beforeRenterName !== afterRenterName || beforeRenterMobile !== afterRenterMobile;

  if (!ownerChanged && !renterChanged) return null;

  const parts: string[] = [];
  // Gujarati name fields only — include sentence only when the side changed and a name exists
  if (ownerChanged && afterOwnerName) {
    parts.push(
      `Flat No. ${flatNumber} માટે માલિક તરીકે ${afterOwnerName}ની વિગતો ઉમેરવામાં આવી છે.`
    );
  }
  if (renterChanged && afterRenterName) {
    parts.push(
      `Flat No. ${flatNumber} માટે ભાડૂત તરીકે ${afterRenterName}ની વિગતો ઉમેરવામાં આવી છે.`
    );
  }

  if (parts.length === 0) return null;

  const stamp =
    input.updatedAt != null
      ? new Date(input.updatedAt).getTime()
      : Date.now();

  return createNotification({
    type: "FLAT_UPDATED",
    title: "Flat Details Updated",
    message: parts.join(" "),
    relatedId: input.id,
    relatedType: "flat",
    dedupeKey: `FLAT_UPDATED:${input.id}:${stamp}`,
    meta: {
      flatNumber,
      ownerName: afterOwnerName,
      renterName: afterRenterName,
      ownerChanged,
      renterChanged,
    },
    actorUserId: input.actorUserId,
  });
}

export function notifyCollectionAdded(payment: {
  id: string;
  flatNumber: string;
  ownerName?: string;
  amount: number;
  purpose?: string;
}): void {
  const flatNumber = String(payment.flatNumber || "").trim();
  const amount = Number(payment.amount) || 0;
  const owner = String(payment.ownerName || "").trim();
  const purpose = String(payment.purpose || "").trim();
  const who = owner ? ` (${owner})` : "";
  const purposePart = purpose ? ` — ${purpose}` : "";
  enqueueNotification({
    type: "COLLECTION_ADDED",
    title: "New Collection",
    message: `Flat ${flatNumber}${who} નું ${inr(amount)} નું collection મળ્યું છે${purposePart}.`,
    relatedId: payment.id,
    relatedType: "payment",
    dedupeKey: `COLLECTION_ADDED:${payment.id}`,
    meta: { flatNumber, ownerName: owner, amount, purpose },
  });
}

export function notifyBuilderCollectionAdded(batch: {
  id: string;
  builderName: string;
  amount: number;
  flatCount: number;
  purpose?: string;
}): void {
  const amount = Number(batch.amount) || 0;
  const purpose = String(batch.purpose || "").trim();
  const purposePart = purpose ? ` — ${purpose}` : "";
  enqueueNotification({
    type: "COLLECTION_ADDED",
    title: "New Collection",
    message: `Builder (${batch.builderName}) પાસેથી ${batch.flatCount} unsold flats માટે ${inr(amount)} નું collection મળ્યું છે${purposePart}.`,
    relatedId: batch.id,
    relatedType: "builder_payment",
    dedupeKey: `COLLECTION_ADDED:builder:${batch.id}`,
    meta: {
      builderName: batch.builderName,
      amount,
      flatCount: batch.flatCount,
      purpose,
    },
  });
}

export function notifyExpenseAdded(expense: {
  id: string;
  title: string;
  category: string;
  amount: number;
}): void {
  const title = String(expense.title || "").trim() || "Expense";
  const category = String(expense.category || "").trim() || "General";
  const amount = Number(expense.amount) || 0;
  enqueueNotification({
    type: "EXPENSE_ADDED",
    title: "New Expense Added",
    message: `${inr(amount)} નો ${category} expense (${title}) add કરવામાં આવ્યો છે.`,
    relatedId: expense.id,
    relatedType: "expense",
    dedupeKey: `EXPENSE_ADDED:${expense.id}`,
    meta: { title, category, amount },
  });
}

export function notifyNoticeCreated(notice: {
  id: string;
  title: string;
  date?: string | null;
}): void {
  const title = String(notice.title || "").trim() || "Notice";
  enqueueNotification({
    type: "NOTICE_CREATED",
    title: "Notice",
    message: title,
    relatedId: notice.id,
    relatedType: "notice",
    dedupeKey: `NOTICE_CREATED:${notice.id}`,
    meta: { noticeTitle: title },
  });
}
