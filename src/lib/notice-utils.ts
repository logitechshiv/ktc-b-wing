export function serializeNotice(doc: {
  _id: { toString(): string };
  title: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const createdAt = doc.createdAt ? new Date(doc.createdAt) : null;
  return {
    id: doc._id.toString(),
    title: String(doc.title || "").trim(),
    description: String(doc.description || "").trim(),
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    /** Compatibility fields for existing NoticeCard UI */
    body: String(doc.description || "").trim(),
    date: createdAt ? createdAt.toISOString().slice(0, 10) : "",
    category: "general" as const,
    pinned: false,
  };
}

export function validateNoticePayload(
  body: Record<string, unknown>
): { ok: true; data: { title: string; description: string } } | { ok: false; message: string } {
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? body.body ?? "").trim();

  if (!title) return { ok: false, message: "Notice Title is required" };
  if (!description) return { ok: false, message: "Notice Description is required" };
  if (title.length > 200) return { ok: false, message: "Title is too long" };
  if (description.length > 5000) return { ok: false, message: "Description is too long" };

  return { ok: true, data: { title, description } };
}
