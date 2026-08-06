import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { SafeUser } from "@/lib/auth-client";

/** Returns the logged-in Super Admin, or a 403 JSON response. */
export async function requireSuperAdmin(): Promise<
  { user: SafeUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized. Please login as Super Admin." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "super_admin") {
    return {
      error: NextResponse.json(
        { success: false, message: "Forbidden. Super Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { user };
}
