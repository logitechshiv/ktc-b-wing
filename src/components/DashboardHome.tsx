"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stats as mockStats } from "@/lib/mock-data";
import { inr } from "@/lib/format";
import { displayExpenseTitle } from "@/lib/expense-utils";
import {
  EMPTY_DASHBOARD,
  readDashboard,
  type DashboardRecentExpense,
  type DashboardStats,
} from "@/lib/dashboard-api";
import { readNotices, type NoticeRecord } from "@/lib/notices-api";
import { subscribeDataChanged } from "@/lib/data-sync";
import { CacheKeys, peekCache } from "@/lib/data-cache";
import ExpenseRow from "@/components/ExpenseRow";
import SummaryTile from "@/components/SummaryTile";
import NoticeCard from "@/components/NoticeCard";
import CommonExpenseSplit from "@/components/CommonExpenseSplit";
import Kiran3CommonCard from "@/components/Kiran3CommonCard";

function toExpenseRow(e: DashboardRecentExpense) {
  const billUrls =
    e.billImages?.length > 0 ? e.billImages : e.billImage ? [e.billImage] : [];
  return {
    id: e.id,
    category: e.category,
    name: displayExpenseTitle(e.expenseTitleGujarati),
    amount: e.amount,
    date: e.expenseDate,
    note: e.notes || undefined,
    paymentMethod: e.paymentMethod,
    hasBill: billUrls.length > 0,
    billUrl: billUrls[0],
    billUrls,
    sharedToGroup: e.whatsappShared,
    displayOrder: e.displayOrder,
  };
}

export default function DashboardHome() {
  const cachedDash = peekCache<DashboardStats>(CacheKeys.dashboard());
  const cachedNotices = peekCache<NoticeRecord[]>(CacheKeys.notices("", 3));
  const [dash, setDash] = useState<DashboardStats>(cachedDash ?? EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(!cachedDash);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestNotices, setLatestNotices] = useState<NoticeRecord[]>(cachedNotices ?? []);
  const [noticesLoading, setNoticesLoading] = useState(!cachedNotices);
  const [openNoticeId, setOpenNoticeId] = useState<string | null>(null);

  const mock = mockStats();
  const pending = mock.dues.filter((d) => d.pending > 0);

  const load = useCallback(async () => {
    try {
      const stats = await readDashboard();
      setDash(stats);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Unable to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNotices = useCallback(async () => {
    try {
      const list = await readNotices({ limit: 3 });
      setLatestNotices(list);
    } catch {
      setLatestNotices([]);
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadNotices();
    let timer: number | undefined;
    const unsub = subscribeDataChanged((source) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void load();
        if (source === "notice" || source === "unknown") {
          void loadNotices();
        }
      }, 200);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [load, loadNotices]);

  const recentExpenses = dash.recentExpenses;

  return (
    <div className="space-y-5">
      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <div className="font-semibold">Dashboard data unavailable</div>
          <p className="mt-1 text-xs leading-relaxed text-rose-600/90">
            {loadError}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-rose-600/80">
            If this mentions MongoDB IP whitelist, open Atlas → Network Access →
            Allow Access from Anywhere (
            <code className="rounded bg-rose-100 px-1">0.0.0.0/0</code>) so
            Vercel can connect.
          </p>
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:p-5">
        <h2 className="mb-4 text-[17px] font-bold tracking-tight text-navy">
          Fund Summary
        </h2>

        <div className="space-y-3">
          <SummaryTile
            value={loading ? "…" : inr(dash.totalBalance)}
            label="Total Balance"
            icon="⚖️"
            tone="violet"
            wide
          />

          <div className="grid grid-cols-2 gap-3">
            <SummaryTile
              value={loading ? "…" : inr(dash.totalCollection)}
              label="Collected"
              icon="📥"
              tone="green"
            />
            <SummaryTile
              value={loading ? "…" : inr(dash.totalExpense)}
              label="Expense"
              icon="📤"
              tone="rose"
            />
            <SummaryTile
              value={loading ? "…" : inr(dash.cashInHand)}
              label="Cash in Hand"
              icon="💵"
              tone="amber"
            />
            <SummaryTile
              value={loading ? "…" : inr(dash.bankBalance)}
              label="Bank Balance"
              icon="🏦"
              tone="sky"
            />
          </div>
        </div>

        {/* Flats — one compact row (not separate boxes) */}
        <div className="mt-4 rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Flats
            </span>
            <Link href="/flats" className="text-[11px] font-medium text-brand">
              View →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-extrabold tabular-nums text-navy">
                {loading ? "…" : dash.flats.total}
              </div>
              <div className="text-[11px] text-slate-500">Total</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tabular-nums text-emerald-600">
                {loading ? "…" : dash.flats.sold}
              </div>
              <div className="text-[11px] text-slate-500">Sold</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tabular-nums text-orange-600">
                {loading ? "…" : dash.flats.available}
              </div>
              <div className="text-[11px] text-slate-500">Unsold</div>
            </div>
          </div>
        </div>

        {/* Vehicles — one compact row */}
        <div className="mt-3 rounded-2xl bg-slate-50 px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Vehicles
            </span>
            <Link
              href="/vehicles"
              className="text-[11px] font-medium text-brand"
            >
              View →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-extrabold tabular-nums text-pink-600">
                {loading ? "…" : dash.vehicles.fourWheelers}
              </div>
              <div className="text-[11px] text-slate-500">4-Wheelers</div>
            </div>

            <div>
              <div className="text-lg font-extrabold tabular-nums text-teal-700">
                {loading ? "…" : dash.vehicles.twoWheelers}
              </div>
              <div className="text-[11px] text-slate-500">2-Wheelers</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tabular-nums text-orange-600">
                {loading ? "…" : dash.vehicles.threeWheelers}
              </div>
              <div className="text-[11px] text-slate-500">
                Auto (3-Wheelers)
              </div>
            </div>
          </div>
        </div>

        {/* {mock.pendingFlats > 0 && (
          <Link
            href="/dues"
            className="mt-3 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-3"
          >
            <div>
              <div className="text-sm font-semibold text-amber-800">
                {mock.pendingFlats} flats pending · {inr(mock.pendingAmount)}
              </div>
              <div className="text-[11px] text-amber-700/80">
                {mock.zeroCollection > 0 ? `${mock.zeroCollection} with zero collection · ` : ""}
                See dues list below
              </div>
            </div>
            <span className="text-sm font-medium text-amber-700">→</span>
          </Link>
        )} */}

        <div className="mt-4 rounded-xl bg-slate-50/80 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
          <p>રોકડ હાથમાં = રોકડ જમા − રોકડ ખર્ચ.</p>
          <p className="mt-1">
            બેંક બેલેન્સ = બેંક / UPI / ચેક જમા − બેંક / UPI / ચેક ખર્ચ.
          </p>
        </div>
      </section>

      <Kiran3CommonCard />

      {/* By Payment Mode — collected vs spent per mode */}
      <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:p-5">
        <h2 className="mb-3 text-[17px] font-bold tracking-tight text-navy">
          By Payment Mode
        </h2>

        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-slate-100 px-1 pb-2 sm:gap-x-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Mode
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Collected
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Spent
          </span>
        </div>

        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-slate-400">
            Loading…
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dash.byPaymentMode.map((row) => (
              <li
                key={row.mode}
                className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 px-1 py-3.5 sm:gap-x-4"
              >
                <span className="min-w-0 break-words text-sm font-semibold text-navy">
                  {row.label}
                </span>
                <span className="text-sm font-bold tabular-nums text-emerald-600">
                  {inr(row.collected)}
                </span>
                <span className="text-sm font-bold tabular-nums text-rose-500">
                  {inr(row.spent)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Expense by Category — dynamic from MongoDB (before By Payment Mode) */}
      <section className="overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(15,40,80,0.06)] ring-1 ring-slate-100/80 sm:p-5">
        <h2 className="mb-3 text-[17px] font-bold tracking-tight text-navy">
          Expense by Category
        </h2>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-slate-100 px-1 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Category
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Amount
          </span>
        </div>

        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-slate-400">
            Loading…
          </p>
        ) : dash.expensesByCategory.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-slate-400">
            No expenses yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dash.expensesByCategory.map((row) => (
              <li
                key={row.category}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-1 py-3.5"
              >
                <span className="min-w-0 break-words text-sm font-semibold text-navy">
                  {row.category}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-rose-500">
                  {inr(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommonExpenseSplit />

      <section>
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <div>
            <h2 className="font-semibold text-navy">Latest notices</h2>
            <p className="text-[11px] text-slate-400">
              Pinned & recent announcements
            </p>
          </div>
          <Link href="/notices" className="text-xs font-medium text-brand">
            View all →
          </Link>
        </div>
        <div className="space-y-2.5">
          {noticesLoading ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
          ) : latestNotices.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              હાલમાં કોઈ નવી સૂચના નથી.
            </p>
          ) : (
            latestNotices.map((n) => (
              <NoticeCard
                key={n.id}
                notice={n}
                compact
                expanded={openNoticeId === n.id}
                onToggle={() =>
                  setOpenNoticeId((cur) => (cur === n.id ? null : n.id))
                }
              />
            ))
          )}
        </div>
      </section>

      {/* <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
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
      </section> */}

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="font-semibold text-navy">Recent Expenses</h2>
            <p className="text-[11px] text-slate-400">
              Sorted by display order
            </p>
          </div>
          <Link href="/expenses" className="text-xs font-medium text-brand">
            View all →
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {recentExpenses.map((e) => (
            <ExpenseRow key={e.id} expense={toExpenseRow(e)} compact />
          ))}
        </ul>
        {!loading && recentExpenses.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            No expenses yet.
          </p>
        )}
        {loading && recentExpenses.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        )}
      </section>
    </div>
  );
}
