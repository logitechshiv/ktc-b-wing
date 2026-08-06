import { NextResponse, type NextRequest } from "next/server";

/**
 * Dashboard is public. Do not block /login — Admin button must always open it.
 * (Previously a leftover token cookie redirected /login → /dashboard.)
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
