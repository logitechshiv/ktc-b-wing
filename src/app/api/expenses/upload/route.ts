import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireSuperAdmin } from "@/lib/require-super-admin";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

/** POST /api/expenses/upload — Super Admin bill upload */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { success: false, message: "Only JPG, PNG or PDF files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "File must be under 8 MB" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = EXT[file.type] || path.extname(file.name) || ".bin";
    const filename = `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "expenses");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);

    const url = `/uploads/expenses/${filename}`;
    return NextResponse.json({ success: true, url, message: "Bill uploaded" });
  } catch (error) {
    console.error("POST /api/expenses/upload error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
