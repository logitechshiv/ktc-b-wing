"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { inr } from "@/lib/format";
import { subscribeDataChanged } from "@/lib/data-sync";
import { CacheKeys, peekCache } from "@/lib/data-cache";
import {
  emptyKiran3CommonBalance,
  readKiran3CommonBalance,
  type Kiran3CommonBalance,
} from "@/lib/kiran3-common-api";

export default function Kiran3CommonCard() {
  const cached = peekCache<Kiran3CommonBalance>(CacheKeys.kiran3Common());
  const [stats, setStats] = useState<Kiran3CommonBalance>(
    cached ?? emptyKiran3CommonBalance()
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      const data = await readKiran3CommonBalance({ force });
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Kiran 3 Common");
      if (!peekCache(CacheKeys.kiran3Common())) {
        setStats(emptyKiran3CommonBalance());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    let timer: number | undefined;
    const unsub = subscribeDataChanged((source) => {
      if (source !== "expense" && source !== "unknown") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void load(true);
      }, 200);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [load]);

  const given = stats.givenToCommon;
  const common = stats.commonExpense;
  const balance = stats.balance;
  const balancePositive = balance >= 0;
  const balanceLabel = loading
    ? "…"
    : `${balancePositive ? "+" : "−"}${inr(Math.abs(balance))}`;

  return (
    <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-tight text-navy">Kiran 3 Common</h2>
        <Link href="/expenses" className="shrink-0 text-[11px] font-medium text-brand">
          Details →
        </Link>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        વિંગથી કોમનમાં આપેલ રકમ – કોમન ખર્ચ = બાકી બેલેન્સ
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600"
        >
          {error}
        </p>
      ) : null}

      <div
        className={
          "mt-4 rounded-2xl border px-4 py-4 " +
          (balancePositive
            ? "border-emerald-200 bg-emerald-50/80"
            : "border-rose-200 bg-rose-50/80")
        }
      >
        <div
          className={
            "text-2xl font-extrabold tabular-nums sm:text-3xl " +
            (balancePositive ? "text-emerald-700" : "text-rose-600")
          }
        >
          {balanceLabel}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[11px] text-white">
            ⌘
          </span>
          <span className="text-sm font-bold text-navy">KIRAN 3 Common Balance</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          કોમન સોસાયટી પાસે B-Wing ની બાકી ક્રેડિટ
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-3.5 py-3.5">
          <div className="text-lg font-extrabold tabular-nums text-violet-700 sm:text-xl">
            {loading ? "…" : inr(given)}
          </div>
          <div className="mt-1.5 text-[13px] font-bold leading-snug text-navy">
            Given to common
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Society Advance</div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-3.5 py-3.5">
          <div className="text-lg font-extrabold tabular-nums text-rose-600 sm:text-xl">
            {loading ? "…" : inr(common)}
          </div>
          <div className="mt-1.5 text-[13px] font-bold leading-snug text-navy">
            Common expense
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Wing share used</div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {loading
          ? "Loading…"
          : `${inr(given)} આપ્યા – ${inr(common)} ખર્ચ = ${inr(Math.abs(balance))} બાકી`}
      </p>
    </section>
  );
}
