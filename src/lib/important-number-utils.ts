const PHONE_DIGITS_RE = /^\d{10}$/;

export interface ImportantNumberPayload {
  name: string;
  description: string;
  area: string;
  phone: string;
  displayOrder: number;
  isActive: boolean;
}

export function digitsOnlyPhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function serializeImportantNumber(doc: {
  _id: { toString(): string };
  name?: string | null;
  description?: string | null;
  area?: string | null;
  phone?: string | null;
  displayOrder?: number | null;
  isActive?: boolean | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}) {
  return {
    id: doc._id.toString(),
    name: String(doc.name || "").trim(),
    description: String(doc.description || "").trim(),
    area: String(doc.area || "").trim(),
    phone: digitsOnlyPhone(doc.phone),
    displayOrder: Number.isFinite(Number(doc.displayOrder)) ? Number(doc.displayOrder) : 0,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export function validateImportantNumberPayload(
  body: Record<string, unknown>
): { ok: true; data: ImportantNumberPayload } | { ok: false; message: string } {
  const name = String(body.name ?? body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const area = String(body.area ?? body.location ?? "").trim();
  const phone = digitsOnlyPhone(body.phone);
  const orderRaw = body.displayOrder;
  const displayOrder =
    orderRaw === "" || orderRaw === null || orderRaw === undefined
      ? 0
      : Number(orderRaw);
  const isActive =
    body.isActive === undefined || body.isActive === null
      ? true
      : body.isActive === true || body.isActive === "true" || body.isActive === 1 || body.isActive === "1";

  if (!name) return { ok: false, message: "Name / Title is required" };
  if (name.length > 200) return { ok: false, message: "Name is too long" };
  if (description.length > 1000) return { ok: false, message: "Description is too long" };
  if (area.length > 200) return { ok: false, message: "Area / Location is too long" };
  if (!phone) return { ok: false, message: "Phone Number is required" };
  if (!PHONE_DIGITS_RE.test(phone)) {
    return { ok: false, message: "Phone Number must be exactly 10 digits" };
  }
  if (!Number.isFinite(displayOrder) || displayOrder < 0) {
    return { ok: false, message: "Display Order must be a valid number (0 or more)" };
  }

  return {
    ok: true,
    data: {
      name,
      description,
      area,
      phone,
      displayOrder: Math.floor(displayOrder),
      isActive,
    },
  };
}
