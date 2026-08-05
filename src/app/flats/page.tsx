"use client";
import { useMemo, useState } from "react";
import { flats } from "@/lib/mock-data";
import type { Flat } from "@/lib/types";

const BADGE_COLORS = [
  "bg-sky-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-fuchsia-500",
  "bg-indigo-500",
];

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone;
}

function badgeColor(unit: number, floor: number) {
  return BADGE_COLORS[(floor * 4 + unit - 1) % BADGE_COLORS.length];
}

export default function FlatsPage() {
  const [q, setQ] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return flats;
    return flats.filter(
      (f) =>
        f.flatNo.toLowerCase().includes(query) ||
        f.ownerName.toLowerCase().includes(query) ||
        f.ownerPhone.includes(query.replace(/\s/g, ""))
    );
  }, [q]);

  const byFloor: Record<number, Flat[]> = {};
  filtered.forEach((f) => {
    (byFloor[f.floor] = byFloor[f.floor] || []).push(f);
  });
  const floors = Object.keys(byFloor)
    .map(Number)
    .sort((a, b) => a - b);

  async function copyPhone(f: Flat) {
    if (!f.ownerPhone) return;
    try {
      await navigator.clipboard.writeText(f.ownerPhone);
      setCopiedId(f.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === f.id ? null : cur)), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search flat no., owner or phone"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

      {floors.map((fl) => {
        const floorFlats = byFloor[fl];
        const soldCount = floorFlats.filter((f) => f.status === "sold").length;
        return (
          <section key={fl} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 21V8l8-5 8 5v13" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold text-navy">Floor {fl}</div>
                <div className="text-xs text-slate-400">
                  {floorFlats.length} flats · {soldCount} sold
                </div>
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {floorFlats.map((f) => {
                const unitLabel = String(f.floor * 100 + f.unit);
                const unsold = f.status === "unsold";

                return (
                  <li key={f.id} className="px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <span
                        className={
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white " +
                          badgeColor(f.unit, f.floor)
                        }
                      >
                        {unitLabel}
                      </span>

                      <div className="min-w-0 flex-1 font-semibold text-navy">
                        {unsold ? (
                          <span className="font-medium text-slate-400">કોઈ માલિક નથી</span>
                        ) : (
                          f.ownerName
                        )}
                      </div>

                      {!unsold && f.ownerPhone && (
                        <button
                          type="button"
                          onClick={() => copyPhone(f)}
                          title="Copy number"
                          className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-brand/5"
                        >
                          <span className="text-sm font-medium tabular-nums text-brand">{formatPhone(f.ownerPhone)}</span>
                          <span className="text-slate-400 group-hover:text-brand" aria-hidden>
                            {copiedId === f.id ? (
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="11" height="11" rx="2" />
                                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                              </svg>
                            )}
                          </span>
                          <span className="sr-only">{copiedId === f.id ? "Copied" : "Copy number"}</span>
                        </button>
                      )}

                      <span
                        className={
                          "ml-auto rounded-full border px-3 py-1 text-xs font-medium " +
                          (unsold
                            ? "border-slate-300 text-slate-500"
                            : "border-emerald-400 text-emerald-600")
                        }
                      >
                        {unsold ? "Unsold" : "Sold"}
                      </span>
                    </div>
                    {!unsold && f.ownerPhone && copiedId === f.id && (
                      <div className="mt-1 pl-12 text-[11px] font-medium text-emerald-600">Number copied</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {floors.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No flats match your search.</p>
      )}
    </div>
  );
}
