import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import type { SafeUser, UserRole } from "@/lib/auth-client";
import { AUTH_COOKIE } from "@/lib/auth-constants";

export type { SafeUser, UserRole } from "@/lib/auth-client";
export { AUTH_COOKIE } from "@/lib/auth-constants";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment variables");
  }
  return secret;
}

export function signAuthToken(payload: AuthTokenPayload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function toSafeUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  mobile: string;
  role: string;
  status: boolean;
}): SafeUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role as UserRole,
    status: user.status,
  };
}

export function formatRoleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function authenticateUser(identifier: string, password: string) {
  await connectDB();

  const value = identifier.trim().toLowerCase();
  const mobileValue = identifier.trim();

  const user = await User.findOne({
    $or: [{ email: value }, { mobile: mobileValue }],
  }).select("+password");

  if (!user || !user.status) {
    return { ok: false as const, error: "Invalid credentials" };
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return { ok: false as const, error: "Invalid credentials" };
  }

  const safe = toSafeUser(user);
  const token = signAuthToken({
    sub: safe.id,
    email: safe.email,
    role: safe.role,
  });

  return { ok: true as const, token, user: safe };
}

/** Reads httpOnly JWT cookie and returns the logged-in user (or null). */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload?.sub) return null;

  await connectDB();
  const user = await User.findById(payload.sub);
  if (!user || !user.status) return null;

  return toSafeUser(user);
}

export function authCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
