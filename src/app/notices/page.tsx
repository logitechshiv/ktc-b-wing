"use client";
import { useMemo, useState } from "react";
import { notices } from "@/lib/mock-data";
import NoticeCard, { noticeCategoryMeta } from "@/components/NoticeCard";
import type { NoticeCategory } from "@/lib/types";

const FILTERS: Array<"all" | NoticeCategory> = [
  "all",
  "urgent",
  "payment",
  "maintenance",
  "event",
  "general",
];

export default function NoticesPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | NoticeCategory>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...notices]
      .filter((n) => (filter === "all" ? true : n.category === filter))
      .filter(
        (n) =>
          !query ||
          n.title.toLowerCase().includes(query) ||
          n.body.toLowerCase().includes(query) ||
          n.category.includes(query)
      )
      .sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return b.date.localeCompare(a.date);
      });
  }, [q, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-navy">Notices</h1>
        <p className="mt-0.5 text-xs text-slate-500">B-Wing announcements · pinned first</p>
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
          placeholder="Search notices"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5 text-xs">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              "shrink-0 rounded-full border px-3 py-1 font-medium transition " +
              (filter === f
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-500")
            }
          >
            {f === "all" ? "All" : noticeCategoryMeta(f).label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((n) => (
          <NoticeCard
            key={n.id}
            notice={n}
            expanded={openId === n.id}
            onToggle={() => setOpenId((cur) => (cur === n.id ? null : n.id))}
          />
        ))}
        {list.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No notices match your search.</p>
        )}
      </div>
    </div>
  );
}
