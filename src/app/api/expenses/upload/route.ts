import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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

/** POST /api/expenses/upload — Super Admin → Vercel Blob */
export async function POST(request: Request) {
  try {
    const gate = await requireSuperAdmin();
    if (gate.error) return gate.error;

    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || "").trim();
    if (!blobToken) {
      return NextResponse.json(
        {
          success: false,
          message: "BLOB_READ_WRITE_TOKEN is not configured. Add it in .env.local / Vercel env.",
        },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { success: false, message: "Only JPG, JPEG, PNG or PDF files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "File must be under 8 MB" }, { status: 400 });
    }

    const ext = EXT[file.type] || ".bin";
    const filename = `expenses/expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      token: blobToken,
      contentType: file.type,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      message: "Bill uploaded",
    });
  } catch (error) {
    console.error("POST /api/expenses/upload error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
