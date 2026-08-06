import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-constants";

export const runtime = "nodejs";

function clearAuthCookie(response: NextResponse) {
  // Must match login cookie attributes or the browser will keep the old token
  response.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  return clearAuthCookie(response);
}

/** Optional GET support for simple redirects / testing */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  return clearAuthCookie(response);
}
