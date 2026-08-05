"use client";
import { useMemo, useState } from "react";
import { expenses } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import ExpenseRow from "@/components/ExpenseRow";

export default function ExpensesPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const set = new Set(expenses.map((e) => e.category));
    return ["all", ...Array.from(set).sort()];
  }, []);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...expenses]
      .filter((e) => (category === "all" ? true : e.category === category))
      .filter(
        (e) =>
          !query ||
          e.name.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query) ||
          (e.note || "").toLowerCase().includes(query)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [q, category]);

  const total = list.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-navy">Expenses</h1>
          <p className="mt-0.5 text-xs text-slate-500">Category · name · share to WhatsApp group</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Shown total</div>
          <div className="text-base font-bold tabular-nums text-rose-500">{inr(total)}</div>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search expense name or category"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

      <div className="flex gap-2 overflow-x-auto pb-0.5 text-xs">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={
              "shrink-0 rounded-full border px-3 py-1 font-medium transition " +
              (category === c
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-500")
            }
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {list.map((e) => (
            <ExpenseRow key={e.id} expense={e} />
          ))}
        </ul>
        {list.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No expenses match your filters.</p>
        )}
      </section>
    </div>
  );
}
