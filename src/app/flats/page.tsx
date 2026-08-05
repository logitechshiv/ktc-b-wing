"use client";
import { useMemo, useState } from "react";
import { flats } from "@/lib/mock-data";
import { formatPhone } from "@/lib/format";
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

function badgeColor(unit: number, floor: number) {
  return BADGE_COLORS[(floor * 4 + unit - 1) % BADGE_COLORS.length];
}

export default function FlatsPage() {
  const [q, setQ] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const queryRaw = q.trim();
    const digits = query.replace(/\s/g, "");
    if (!query) return flats;
    return flats.filter(
      (f) =>
        f.flatNo.toLowerCase().includes(query) ||
        f.ownerName.toLowerCase().includes(query) ||
        f.ownerNameGu.includes(queryRaw) ||
        f.ownerPhone.includes(digits) ||
        (f.renterName || "").toLowerCase().includes(query) ||
        (f.renterNameGu || "").includes(queryRaw) ||
        (f.renterPhone || "").includes(digits)
    );
  }, [q]);

  const byFloor: Record<number, Flat[]> = {};
  filtered.forEach((f) => {
    (byFloor[f.floor] = byFloor[f.floor] || []).push(f);
  });
  const floors = Object.keys(byFloor)
    .map(Number)
    .sort((a, b) => a - b);

  async function copyPhone(key: string, phone: string) {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search flat, owner, renter or phone"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

      {floors.map((fl) => {
        const floorFlats = byFloor[fl];
        const soldCount = floorFlats.filter((f) => f.status === "sold").length;
        const rentCount = floorFlats.filter((f) => f.onRent).length;
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
                  {rentCount > 0 ? ` · ${rentCount} on rent` : ""}
                </div>
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {floorFlats.map((f) => {
                const unitLabel = String(f.floor * 100 + f.unit);
                const unsold = f.status === "unsold";
                const onRent = !!f.onRent && !unsold;

                return (
                  <li key={f.id} className="px-3 py-3 sm:px-4">
                    <div className="min-w-0">
                      {unsold ? (
                        <div className="font-medium text-slate-400">કોઈ માલિક નથી</div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Owner</span>
                            {onRent && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                <span aria-hidden>🔑</span> On Rent
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[15px] font-bold leading-snug text-navy break-words">
                            {f.ownerName}
                          </div>
                          <div className="mt-0.5 text-sm font-medium leading-snug text-slate-600 break-words">
                            {f.ownerNameGu}
                          </div>
                        </>
                      )}
                    </div>

                    {onRent && (
                      <div className="mt-2.5 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Renter</div>
                        <div className="mt-0.5 text-sm font-bold leading-snug text-navy break-words">
                          {f.renterName}
                        </div>
                        {f.renterNameGu && (
                          <div className="mt-0.5 text-xs font-medium leading-snug text-slate-600 break-words">
                            {f.renterNameGu}
                          </div>
                        )}
                        {f.renterPhone && (
                          <button
                            type="button"
                            onClick={() => copyPhone(f.id + "-renter", f.renterPhone!)}
                            title="Copy renter number"
                            className="mt-1.5 group inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left hover:bg-white/70"
                          >
                            <span className="text-sm font-medium tabular-nums text-brand">
                              {formatPhone(f.renterPhone)}
                            </span>
                            <span className="text-slate-400" aria-hidden>
                              {copiedKey === f.id + "-renter" ? "✓" : "⧉"}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-bold text-white " +
                          badgeColor(f.unit, f.floor)
                        }
                      >
                        {unitLabel}
                      </span>

                      {!unsold && f.ownerPhone ? (
                        <button
                          type="button"
                          onClick={() => copyPhone(f.id + "-owner", f.ownerPhone)}
                          title="Copy owner number"
                          className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-brand/5"
                        >
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Owner</span>
                          <span className="text-sm font-medium tabular-nums text-brand">
                            {formatPhone(f.ownerPhone)}
                          </span>
                          <span className="text-slate-400 group-hover:text-brand" aria-hidden>
                            {copiedKey === f.id + "-owner" ? (
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
                        </button>
                      ) : null}

                      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                        {onRent && (
                          <span className="rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                            Rent
                          </span>
                        )}
                        <span
                          className={
                            "rounded-full border px-3 py-1 text-xs font-medium " +
                            (unsold
                              ? "border-slate-300 text-slate-500"
                              : "border-emerald-400 text-emerald-600")
                          }
                        >
                          {unsold ? "Unsold" : "Sold"}
                        </span>
                      </div>
                    </div>

                    {(copiedKey === f.id + "-owner" || copiedKey === f.id + "-renter") && (
                      <div className="mt-1 text-[11px] font-medium text-emerald-600">Number copied</div>
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
