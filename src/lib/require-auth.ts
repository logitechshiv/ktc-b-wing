import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { SafeUser } from "@/lib/auth-client";

/** Any authenticated active user. */
export async function requireAuth(): Promise<
  { user: SafeUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized. Please login." },
        { status: 401 }
      ),
    };
  }

  return { user };
}
