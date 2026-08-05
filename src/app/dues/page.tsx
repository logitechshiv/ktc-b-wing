"use client";
import { useState } from "react";
import { computeDues } from "@/lib/mock-data";
import { inr } from "@/lib/format";

export default function DuesPage() {
  const [q, setQ] = useState("");
  const dues = computeDues();
  const totalPending = dues.reduce((s, d) => s + d.pending, 0);
  const filtered = dues.filter(
    (d) => d.flat.flatNo.toLowerCase().includes(q.toLowerCase()) || d.flat.ownerName.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-500">Total pending across B-Wing</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">{inr(totalPending)}</div>
      </section>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search flat no. or owner"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
      />

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
        {filtered.map((d) => (
          <div key={d.flat.id} className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-800">
                {d.flat.flatNo}
                <span className="ml-2 text-xs text-slate-400">{d.flat.ownerName}</span>
              </div>
              {d.pending > 0 ? (
                <span className="text-sm font-semibold tabular-nums text-amber-600">{inr(d.pending)}</span>
              ) : (
                <span className="text-xs font-medium text-emerald-600">Cleared</span>
              )}
            </div>
            <div className="mt-1 text-xs tabular-nums text-slate-400">
              Expected {inr(d.expected)} · Paid {inr(d.paid)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
