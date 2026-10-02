"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { inr } from "@/lib/format";
import { formSelectFilter } from "@/lib/form-styles";
import { subscribeDataChanged } from "@/lib/data-sync";
import {
  emptyCommonExpenseSplit,
  readCommonExpenseSplit,
  type CommonExpenseSplitStats,
} from "@/lib/common-expense-split-api";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function monthRangeDMY(month: number, year: number) {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `01/${mm}/${year}`,
    end: `${String(lastDay).padStart(2, "0")}/${mm}/${year}`,
  };
}

function ReceiptIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M7 3h10a2 2 0 012 2v15.5l-2.2-1.3-2.3 1.3-2.2-1.3-2.3 1.3-2.2-1.3L5 20.5V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 12h6M9 16h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function BuilderReceiptPage() {
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<CommonExpenseSplitStats>(() =>
    emptyCommonExpenseSplit(now.getMonth() + 1, now.getFullYear())
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selectedMonth: number, selectedYear: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await readCommonExpenseSplit(selectedMonth, selectedYear, { force: true });
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load builder receipt");
      setStats(emptyCommonExpenseSplit(selectedMonth, selectedYear));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month, year);
  }, [load, month, year]);

  useEffect(() => {
    let timer: number | undefined;
    const unsub = subscribeDataChanged((source) => {
      if (
        source !== "expense" &&
        source !== "flat" &&
        source !== "payment" &&
        source !== "unknown"
      ) {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void load(month, year);
      }, 200);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [load, month, year]);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? "";
  const { start: monthStartDMY, end: monthEndDMY } = monthRangeDMY(month, year);
  const hasMonthlyUnsoldFlats = stats.hasMonthlyUnsoldFlats;
  const unsold = Number.isFinite(stats.unsoldFlats) ? Number(stats.unsoldFlats) : 0;
  const perFlat = Number.isFinite(stats.perFlatShare) ? stats.perFlatShare : 0;
  const builderShare = Number.isFinite(stats.builderShare) ? stats.builderShare : 0;
  const collected = Number.isFinite(stats.builderCollected) ? stats.builderCollected : 0;
  const pending = Number.isFinite(stats.builderPending) ? stats.builderPending : 0;
  const fullyPaid = !loading && unsold > 0 && builderShare > 0.001 && pending <= 0.001;
  const partiallyPaid = !loading && collected > 0.001 && pending > 0.001;
  const years = useMemo(() => {
    const set = new Set(stats.years.length ? stats.years : [year]);
    set.add(year);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [stats.years, year, now]);

  const flatsStatusText = !hasMonthlyUnsoldFlats
    ? "Unsold Flats not set for this month"
    : fullyPaid
      ? "બધાનું પેમેન્ટ મળી ગયું"
      : partiallyPaid
        ? "આંશિક પેમેન્ટ મળ્યું"
        : builderShare > 0.001
          ? "પેમેન્ટ બાકી છે"
          : "આ મહિને કોઈ શેર નથી";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-navy">Builder Receipt</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Unsold flats ની મેન્ટેનન્સ રકમ — Builder પાસેથી મળેલી રસીદ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={formSelectFilter}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={formSelectFilter}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <article className="overflow-hidden rounded-[22px] bg-[#0f2744] p-4 text-white shadow-[0_12px_32px_rgba(15,40,80,0.28)] ring-1 ring-white/10 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
            <ReceiptIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold tracking-tight text-amber-300 sm:text-base">
              {monthStartDMY} થી {monthEndDMY}
            </div>
            <p className="mt-1 text-[12px] leading-snug text-slate-300">
              રસીદ: &quot;Builder Maintenance - {monthLabel} {year}&quot;.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-500/10 px-3 py-3 ring-1 ring-emerald-400/20">
            <div className="text-2xl font-extrabold tabular-nums text-emerald-300">
              {loading ? "…" : hasMonthlyUnsoldFlats ? unsold : "—"}
            </div>
            <div className="mt-1 text-[11px] font-medium leading-snug text-emerald-100/90">
              ફ્લેટ્સ — {loading ? "…" : flatsStatusText}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 px-3 py-3 ring-1 ring-emerald-400/20">
            <div className="text-2xl font-extrabold tabular-nums text-emerald-300">
              {loading ? "…" : inr(collected)}
            </div>
            <div className="mt-1 text-[11px] font-medium leading-snug text-emerald-100/90">
              કુલ મળ્યું
              {!loading && perFlat > 0 ? ` (@ ${inr(perFlat)}/ફ્લેટ)` : ""}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-[12px] text-slate-400">Loading receipt…</p>
        ) : fullyPaid ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 ring-1 ring-emerald-400/25">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-[#0f2744]">
              ✓
            </span>
            <p className="text-[12px] font-medium leading-relaxed text-emerald-200">
              {monthStartDMY} થી {monthEndDMY} ના {unsold} Unsold ફ્લેટ્સની આખી મેન્ટેનન્સ રકમ
              Builder પાસેથી મળી ગઈ છે. કોઈ પણ રસીદ બાકી નથી.
            </p>
          </div>
        ) : partiallyPaid ? (
          <div className="mt-4 rounded-xl bg-amber-400/10 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-amber-200 ring-1 ring-amber-300/25">
            Builder Share {inr(builderShare)} માંથી {inr(collected)} મળ્યા. બાકી Pending:{" "}
            {inr(pending)}.
          </div>
        ) : builderShare > 0.001 ? (
          <div className="mt-4 rounded-xl bg-rose-400/10 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-rose-200 ring-1 ring-rose-300/25">
            {monthStartDMY} થી {monthEndDMY} ના {unsold} Unsold ફ્લેટ્સની મેન્ટેનન્સ રકમ{" "}
            {inr(builderShare)} હજુ Builder પાસેથી બાકી છે.
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-white/5 px-3 py-2.5 text-[12px] leading-relaxed text-slate-300 ring-1 ring-white/10">
            આ મહિને common expense / builder share નથી — રસીદ બનાવવા માટે ખર્ચ અને unsold flats
            જરૂરી છે.
          </div>
        )}
      </article>
    </div>
  );
}
