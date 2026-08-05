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
        <h2 className="mb-4 text-[17px] font-bold tracking-tight text-navy">Summary</h2>

        <div className="space-y-3">
          {/* Hero: Total Balance — full width so amount isn’t cramped */}
          <SummaryTile value={inr(s.balance)} label="Total Balance" icon="⚖️" tone="violet" wide />

          {/* Always 2 columns on mobile — never 3 */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryTile value={inr(s.totalCollected)} label="Collected" icon="📥" tone="green" />
            <SummaryTile value={inr(s.totalExpense)} label="Expense" icon="📤" tone="rose" />
            <SummaryTile value={inr(s.cash)} label="Cash in Hand" icon="💵" tone="amber" />
            <SummaryTile value={inr(s.bank)} label="Bank Balance" icon="🏦" tone="sky" />
            <SummaryTile value={String(s.total)} label="Total Flats" icon="🏢" tone="cyan" />
            <SummaryTile value={String(s.unsold)} label="Unsold Flats" icon="🔑" tone="orange" />
            <SummaryTile value={String(s.zeroCollection)} label="Zero Collection" icon="🚫" tone="rose" />
            <SummaryTile value={String(s.pendingFlats)} label="Pending Flats" icon="📌" tone="amber" />
            <SummaryTile value={String(s.fourWheelers)} label="4-Wheelers" icon="🚙" tone="pink" />
            <SummaryTile value={String(s.twoWheelers)} label="2-Wheelers" icon="🏍️" tone="teal" />
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
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
