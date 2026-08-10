"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { inr } from "@/lib/format";
import { formSelectFilter } from "@/lib/form-styles";
import { subscribeDataChanged } from "@/lib/data-sync";
import {
  COMMON_EXPENSE_TOTAL_FLATS,
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

function StatBox({
  value,
  label,
  hint,
  tone,
}: {
  value: string;
  label: string;
  hint?: string;
  tone: "rose" | "sky" | "green" | "orange" | "slate";
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-700",
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    slate: "bg-slate-50 text-navy",
  };
  return (
    <div className={"rounded-2xl px-3.5 py-3.5 " + tones[tone]}>
      <div className="text-xl font-extrabold tabular-nums leading-none sm:text-2xl">{value}</div>
      <div className="mt-2 text-[12px] font-semibold leading-snug text-slate-600">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</div>}
    </div>
  );
}

export default function CommonExpenseSplit() {
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
      const data = await readCommonExpenseSplit(selectedMonth, selectedYear);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load common expense split");
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
      if (source !== "expense" && source !== "flat" && source !== "unknown") return;
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

  const totalFlats = COMMON_EXPENSE_TOTAL_FLATS;
  const monthTotal = Number.isFinite(stats.totalCommonExpense) ? stats.totalCommonExpense : 0;
  const perFlat = Number.isFinite(stats.perFlatShare) ? stats.perFlatShare : 0;
  const sold = Number.isFinite(stats.soldFlats) ? stats.soldFlats : 0;
  const unsold = Number.isFinite(stats.unsoldFlats) ? stats.unsoldFlats : 0;
  const soldTotal = perFlat * sold;
  const unsoldTotal = perFlat * unsold;
  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? "";

  const years = useMemo(() => {
    const set = new Set(stats.years.length ? stats.years : [year]);
    set.add(year);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [stats.years, year, now]);

  return (
    <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:p-5">
      <h2 className="text-[17px] font-bold tracking-tight text-navy">Monthly Common Expense Split</h2>
      <p className="mt-1 text-xs text-slate-500">
        કોમન ખર્ચ ÷ {totalFlats} ફ્લેટ — sold માલિકો અને unsold (builder) વચ્ચે વહેંચણી
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
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

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        <span className="font-medium text-slate-600">Included:</span>{" "}
        {loading
          ? "Loading…"
          : stats.includedCategories.length
            ? stats.includedCategories.join(", ")
            : "None (mark categories in Expenses → Manage Categories)"}.
        <span className="mt-0.5 block">
          <span className="font-medium text-slate-600">Excluded:</span>{" "}
          {loading
            ? "Loading…"
            : stats.excludedCategories.length
              ? stats.excludedCategories.join(", ")
              : "None"}.
        </span>
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <StatBox
          value={loading ? "…" : inr(monthTotal)}
          label={`${monthLabel} ${year} — common total`}
          hint={
            loading
              ? "Loading…"
              : stats.expenseCount
                ? `${stats.expenseCount} expense entries in common categories`
                : "No common expenses in this month"
          }
          tone="rose"
        />
        <StatBox
          value={loading ? "…" : inr(Math.round(perFlat))}
          label={`Per flat (÷ ${totalFlats})`}
          hint="Same share for every flat in B-Wing"
          tone="sky"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="px-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Sold flats</div>
            <StatBox
              value={loading ? "…" : String(sold)}
              label="Flats"
              hint="Member-owned"
              tone="green"
            />
            <StatBox
              value={loading ? "…" : inr(Math.round(soldTotal))}
              label="Members’ share"
              hint={`${sold} × per flat`}
              tone="green"
            />
          </div>
          <div className="space-y-2">
            <div className="px-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">Unsold flats</div>
            <StatBox
              value={loading ? "…" : String(unsold)}
              label="Flats"
              hint="Builder"
              tone="orange"
            />
            <StatBox
              value={loading ? "…" : inr(Math.round(unsoldTotal))}
              label="Builder share"
              hint={`${unsold} × per flat`}
              tone="orange"
            />
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
        Formula: Common total ÷ {totalFlats} = per flat. Sold share = per flat × {sold}. Builder share = per flat ×{" "}
        {unsold}.
      </p>
    </section>
  );
}
