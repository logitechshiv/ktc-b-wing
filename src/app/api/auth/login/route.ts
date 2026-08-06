import { NextResponse } from "next/server";
import { AUTH_COOKIE, authenticateUser, authCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.emailOrMobile ?? body.identifier ?? body.email ?? body.mobile ?? "").trim();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: "Email/mobile and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const result = await authenticateUser(identifier, password);

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      token: result.token,
      user: result.user,
    });

    const options = authCookieOptions();
    response.cookies.set({
      name: AUTH_COOKIE,
      value: result.token,
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      path: options.path,
      maxAge: options.maxAge,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to login. Please try again." },
      { status: 500 }
    );
  }
}
