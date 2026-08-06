"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";

const EMAIL_OR_MOBILE =
  "^([a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}|[6-9]\\d{9})$";

const inputClass =
  "h-[52px] w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm text-slate-800 outline-none transition duration-200 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const form = e.currentTarget;
    const emailOrMobile = String(new FormData(form).get("emailOrMobile") || "").trim();
    const password = String(new FormData(form).get("password") || "");

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrMobile, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      if (data.user?.role !== "super_admin") {
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
        setError("Only Super Admin can sign in here.");
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to login. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(22,131,196,0.14),_transparent_55%),linear-gradient(180deg,#E8EEF5_0%,#F3F5F8_42%,#EEF2F7_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-8 h-72 w-72 rounded-full bg-navy/10 blur-3xl"
        aria-hidden="true"
      />

      <main className="relative z-10 w-full max-w-[440px] animate-fade-in">
        <section
          className="animate-fade-in-up overflow-hidden rounded-[22px] border border-slate-100/80 bg-white/95 shadow-[0_8px_24px_rgba(15,40,80,0.06),0_20px_48px_rgba(10,76,134,0.08)] backdrop-blur-sm"
          aria-labelledby="login-title"
        >
          <div className="bg-gradient-to-r from-[#063A6B] via-navy to-brand px-7 pb-6 pt-7 text-white sm:px-9 sm:pt-8">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"
                aria-hidden="true"
              >
                <svg viewBox="0 0 60 80" className="h-7 w-6 text-white" aria-hidden="true">
                  <polyline
                    points="46,10 18,40 46,70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.45"
                  />
                  <polyline
                    points="34,10 6,40 34,70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[15px] font-extrabold tracking-tight sm:text-[16px]">
                  B-Wing <span className="font-semibold text-white/55">-</span> Management System
                </div>
                <div className="mt-1 truncate text-[10px] font-medium tracking-[0.08em] text-white/70">
                  Kiran Classic Tower - 3
                </div>
              </div>
            </div>
          </div>

          <div className="p-7 sm:p-9">
            <header className="mb-7">
              <h1 id="login-title" className="text-[22px] font-extrabold tracking-tight text-navy sm:text-[24px]">
                Super Admin Login
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Sign in to access the administration panel.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email-or-mobile" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Email or Mobile Number
                </label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"
                    aria-hidden="true"
                  >
                    <Mail className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <input
                    id="email-or-mobile"
                    name="emailOrMobile"
                    type="text"
                    required
                    minLength={10}
                    autoComplete="username"
                    inputMode="email"
                    pattern={EMAIL_OR_MOBILE}
                    title="Enter a valid email address or 10-digit Indian mobile number"
                    placeholder="Enter email or mobile number"
                    className={inputClass}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"
                    aria-hidden="true"
                  >
                    <Lock className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={inputClass + " pr-12"}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-1.5 flex items-center rounded-lg px-2.5 text-slate-400 transition hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" strokeWidth={1.75} />
                    ) : (
                      <Eye className="h-5 w-5" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-navy text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,76,134,0.28)] transition duration-200 hover:bg-[#063A6B] active:scale-[0.99] active:bg-[#052F56] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-80"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            <div className="mt-7 text-center">
              <Link
                href="/"
                className="inline-flex text-sm font-medium text-slate-500 transition hover:text-navy focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-8 text-center animate-fade-in">
          <p className="text-[12px] text-slate-400">© 2026 Kiran Classic Towers-3. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
