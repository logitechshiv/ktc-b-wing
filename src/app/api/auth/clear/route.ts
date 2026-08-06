import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-constants";

export const runtime = "nodejs";

/** Clears invalid/expired auth cookie and sends the user to login. */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
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
