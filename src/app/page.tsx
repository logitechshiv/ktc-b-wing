"use client";
import Link from "next/link";
import { stats, expenses, notices } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import ExpenseRow from "@/components/ExpenseRow";
import SummaryTile from "@/components/SummaryTile";
import NoticeCard from "@/components/NoticeCard";
import CommonExpenseSplit from "@/components/CommonExpenseSplit";

export default function Dashboard() {
  const s = stats();
  const pending = s.dues.filter((d) => d.pending > 0);
  const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const latestNotices = [...notices]
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.date.localeCompare(a.date);
    })
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:p-5">
        <h2 className="mb-4 text-[17px] font-bold tracking-tight text-navy">Fund Summary</h2>

        <div className="space-y-3">
          <SummaryTile value={inr(s.balance)} label="Total Balance" icon="⚖️" tone="violet" wide />

          <div className="grid grid-cols-2 gap-3">
            <SummaryTile value={inr(s.totalCollected)} label="Collected" icon="📥" tone="green" />
            <SummaryTile value={inr(s.totalExpense)} label="Expense" icon="📤" tone="rose" />
            <SummaryTile value={inr(s.cash)} label="Cash in Hand" icon="💵" tone="amber" />
            <SummaryTile value={inr(s.bank)} label="Bank Balance" icon="🏦" tone="sky" />
          </div>
        </div>

        {/* Flats — one compact row (not separate boxes) */}
        <div className="mt-4 rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Flats</span>
            <Link href="/flats" className="text-[11px] font-medium text-brand">
              View →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-extrabold tabular-nums text-navy">{s.total}</div>
              <div className="text-[11px] text-slate-500">Total</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tabular-nums text-emerald-600">{s.sold}</div>
              <div className="text-[11px] text-slate-500">Sold</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tabular-nums text-orange-600">{s.unsold}</div>
              <div className="text-[11px] text-slate-500">Unsold</div>
            </div>
          </div>
        </div>

        {/* Vehicles — one compact row */}
        <div className="mt-3 rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Vehicles</span>
            <Link href="/vehicles" className="text-[11px] font-medium text-brand">
              View →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-lg font-extrabold tabular-nums text-pink-600">{s.fourWheelers}</div>
              <div className="text-[11px] text-slate-500">4-Wheelers</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tabular-nums text-teal-700">{s.twoWheelers}</div>
              <div className="text-[11px] text-slate-500">2-Wheelers</div>
            </div>
          </div>
        </div>

        {s.pendingFlats > 0 && (
          <Link
            href="/dues"
            className="mt-3 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-3"
          >
            <div>
              <div className="text-sm font-semibold text-amber-800">
                {s.pendingFlats} flats pending · {inr(s.pendingAmount)}
              </div>
              <div className="text-[11px] text-amber-700/80">
                {s.zeroCollection > 0 ? `${s.zeroCollection} with zero collection · ` : ""}
                See dues list below
              </div>
            </div>
            <span className="text-sm font-medium text-amber-700">→</span>
          </Link>
        )}

        <div className="mt-4 rounded-xl bg-slate-50/80 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
          <p>રોકડ હાથમાં = રોકડ જમા − રોકડ ખર્ચ − ફંડ ટ્રાન્સફર.</p>
          <p className="mt-1">બેંક બેલેન્સ = બેંક જમા − બેંક ખર્ચ + ફંડ ટ્રાન્સફર.</p>
        </div>
      </section>

      <CommonExpenseSplit />

      <section>
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <div>
            <h2 className="font-semibold text-navy">Latest notices</h2>
            <p className="text-[11px] text-slate-400">Pinned & recent announcements</p>
          </div>
          <Link href="/notices" className="text-xs font-medium text-brand">
            View all →
          </Link>
        </div>
        <div className="space-y-2.5">
          {latestNotices.map((n) => (
            <NoticeCard key={n.id} notice={n} compact />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-navy">Pending dues</h2>
          <Link href="/dues" className="text-xs font-medium text-brand">
            View all →
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {pending.slice(0, 5).map((d) => (
            <li key={d.flat.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="font-medium text-slate-800">{d.flat.flatNo}</div>
                <div className="text-xs text-slate-400">{d.flat.ownerName}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums text-amber-600">{inr(d.pending)}</span>
                <a
                  href={"https://wa.me/91" + d.flat.ownerPhone}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white"
                >
                  Remind
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-semibold text-navy">Recent expenses</h2>
            <p className="text-[11px] text-slate-400">Category · name · amount</p>
          </div>
          <Link href="/expenses" className="text-xs font-medium text-brand">
            View all →
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {recentExpenses.map((e) => (
            <ExpenseRow key={e.id} expense={e} compact />
          ))}
        </ul>
      </section>
    </div>
  );
}
