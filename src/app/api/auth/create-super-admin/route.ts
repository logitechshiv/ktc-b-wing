import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { toSafeUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Postman-only Super Admin creator (no UI page).
 *
 * POST /api/auth/create-super-admin
 * Header: x-setup-secret: <SETUP_SECRET from .env.local>
 * Body JSON: { name, email, mobile, password }
 */
export async function POST(request: Request) {
  try {
    const setupSecret = process.env.SETUP_SECRET;
    const headerSecret = request.headers.get("x-setup-secret");

    if (!setupSecret || headerSecret !== setupSecret) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const mobile = String(body.mobile ?? "").trim();
    const password = String(body.password ?? "");

    if (!name || !email || !mobile || !password) {
      return NextResponse.json(
        { success: false, message: "name, email, mobile and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, message: "Mobile must be a valid 10-digit Indian number" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({
      $or: [{ email }, { mobile }, { role: "super_admin" }],
    });

    if (existing) {
      if (existing.role === "super_admin") {
        return NextResponse.json(
          { success: false, message: "Super Admin already exists. Duplicate not allowed." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: "Email or mobile already registered" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      mobile,
      password: hashed,
      role: "super_admin",
      status: true,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Super Admin created successfully",
        user: toSafeUser(user),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Super Admin error:", error);
    const message =
      error instanceof Error ? error.message : "Unable to create Super Admin";

    // Surface real DB/network errors so Postman debugging is possible
    const isDbError =
      message.includes("querySrv") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("Mongo") ||
      message.includes("buffering timed out") ||
      message.includes("Authentication failed");

    return NextResponse.json(
      {
        success: false,
        message: isDbError
          ? `Database connection failed: ${message}`
          : "Unable to create Super Admin",
        error: process.env.NODE_ENV !== "production" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
