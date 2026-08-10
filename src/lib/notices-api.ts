export interface NoticeRecord {
  id: string;
  title: string;
  description: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Mapped for NoticeCard compatibility */
  body: string;
  date: string;
  category: "general";
  pinned: boolean;
}

export interface NoticeInput {
  title: string;
  description: string;
}

function toNotice(raw: Record<string, unknown>): NoticeRecord {
  const description = String(raw.description ?? raw.body ?? "").trim();
  const createdAt = raw.createdAt ? String(raw.createdAt) : null;
  return {
    id: String(raw.id ?? raw._id),
    title: String(raw.title ?? "").trim(),
    description,
    createdAt,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    body: description,
    date: createdAt ? createdAt.slice(0, 10) : "",
    category: "general",
    pinned: false,
  };
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function readNotices(params: { q?: string; limit?: number } = {}): Promise<NoticeRecord[]> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.limit && params.limit > 0) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  const res = await fetch(`/api/notices${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  const data = await parseJson(res);
  return ((data.notices as Record<string, unknown>[]) || []).map(toNotice);
}

export async function createNotice(input: NoticeInput): Promise<NoticeRecord> {
  const res = await fetch("/api/notices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toNotice(data.notice);
}

export async function updateNotice(id: string, input: NoticeInput): Promise<NoticeRecord> {
  const res = await fetch(`/api/notices/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
  });
  const data = await parseJson(res);
  return toNotice(data.notice);
}

export async function deleteNotice(id: string): Promise<void> {
  const res = await fetch(`/api/notices/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  await parseJson(res);
}
