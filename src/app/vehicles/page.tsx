"use client";
import { useMemo, useState } from "react";
import { flats, vehicles } from "@/lib/mock-data";
import { formatPhone, formatPlate } from "@/lib/format";
import type { Flat, Vehicle, VehicleType } from "@/lib/types";

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

function VehicleIcon({ type }: { type: VehicleType }) {
  if (type === "car") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-lg" title="Car" aria-hidden>
        🚗
      </span>
    );
  }
  if (type === "bike") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-lg" title="Bike" aria-hidden>
        🏍️
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-lg" title="Scooter" aria-hidden>
      🛵
    </span>
  );
}

interface FlatVehicles {
  flat: Flat;
  vehicles: Vehicle[];
}

export default function VehiclesPage() {
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [stickerFilter, setStickerFilter] = useState<"all" | "yes" | "no">("all");

  const grouped = useMemo(() => {
    const query = q.trim().toLowerCase().replace(/\s/g, "");
    const byFlat = new Map<string, FlatVehicles>();

    for (const v of vehicles) {
      if (stickerFilter === "yes" && !v.sticker) continue;
      if (stickerFilter === "no" && v.sticker) continue;

      const flat = flats.find((f) => f.id === v.flatId);
      if (!flat || flat.status !== "sold") continue;

      const plate = v.number.toLowerCase().replace(/\s/g, "");
      const flatNo = flat.flatNo.toLowerCase().replace(/\s/g, "");
      const unit = String(flat.floor * 100 + flat.unit);
      const owner = flat.ownerName.toLowerCase().replace(/\s/g, "");
      if (
        query &&
        !plate.includes(query) &&
        !flatNo.includes(query) &&
        !unit.includes(query) &&
        !owner.includes(query) &&
        !flat.ownerPhone.includes(query)
      ) {
        continue;
      }

      const entry = byFlat.get(flat.id) ?? { flat, vehicles: [] };
      entry.vehicles.push(v);
      byFlat.set(flat.id, entry);
    }

    return Array.from(byFlat.values()).sort(
      (a, b) => a.flat.floor - b.flat.floor || a.flat.unit - b.flat.unit
    );
  }, [q, stickerFilter]);

  const totals = useMemo(() => {
    const cars = vehicles.filter((v) => v.type === "car").length;
    const twoWheel = vehicles.filter((v) => v.type !== "car").length;
    const noSticker = vehicles.filter((v) => !v.sticker).length;
    return { total: vehicles.length, cars, twoWheel, noSticker };
  }, []);

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-navy">Vehicles</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ફ્લેટ અથવા વાહન નંબરથી શોધો — માલિકની વિગતો તરત જોઈ શકાય.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
          <div className="text-[10px] text-slate-400">Total</div>
          <div className="text-lg font-bold tabular-nums text-navy">{totals.total}</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
          <div className="text-[10px] text-slate-400">Cars / 2W</div>
          <div className="text-lg font-bold tabular-nums text-navy">
            {totals.cars}
            <span className="text-slate-300"> / </span>
            {totals.twoWheel}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
          <div className="text-[10px] text-slate-400">No sticker</div>
          <div className={"text-lg font-bold tabular-nums " + (totals.noSticker ? "text-amber-600" : "text-navy")}>
            {totals.noSticker}
          </div>
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Vehicle No / Flat No"
          className="w-full rounded-xl border border-brand/30 bg-brand/5 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-brand focus:bg-white"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs">
        {(
          [
            ["all", "All"],
            ["yes", "Sticker Yes"],
            ["no", "Sticker No"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStickerFilter(value)}
            className={
              "shrink-0 rounded-full border px-3 py-1 font-medium transition " +
              (stickerFilter === value
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-500")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span aria-hidden>📋</span>
        નંબર પર દબાવો તો કોપી થઈ જશે
      </p>

      {grouped.map(({ flat, vehicles: flatVehicles }) => {
        const unitLabel = String(flat.floor * 100 + flat.unit);
        return (
          <section key={flat.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col items-center px-4 pb-2 pt-4">
              <span
                className={
                  "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white " +
                  badgeColor(flat.unit, flat.floor)
                }
              >
                {unitLabel}
              </span>
              <div className="mt-2 text-center text-base font-bold text-navy">{flat.ownerName}</div>
              {flat.ownerPhone && (
                <button
                  type="button"
                  onClick={() => copyText("phone-" + flat.id, flat.ownerPhone)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums text-brand hover:bg-brand/5"
                  title="Copy number"
                >
                  <span className="text-rose-500" aria-hidden>
                    ☎
                  </span>
                  {formatPhone(flat.ownerPhone)}
                  {copied === "phone-" + flat.id && (
                    <span className="text-[10px] font-medium text-emerald-600">Copied</span>
                  )}
                </button>
              )}
            </div>

            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {flatVehicles.map((v) => (
                <li key={v.id} className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4">
                  <VehicleIcon type={v.type} />
                  <button
                    type="button"
                    onClick={() => copyText("plate-" + v.id, v.number)}
                    className="min-w-0 flex-1 text-left"
                    title="Copy vehicle number"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold tabular-nums tracking-wide text-brand">
                        {formatPlate(v.number)}
                      </span>
                      <span
                        className={
                          "shrink-0 text-[11px] font-medium " +
                          (v.sticker ? "text-emerald-600" : "text-amber-600")
                        }
                      >
                        સ્ટીકર: {v.sticker ? "Yes" : "No"}
                      </span>
                    </div>
                    {copied === "plate-" + v.id && (
                      <div className="text-[10px] font-medium text-emerald-600">Number copied</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {grouped.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No vehicles match your search.</p>
      )}
    </div>
  );
}
