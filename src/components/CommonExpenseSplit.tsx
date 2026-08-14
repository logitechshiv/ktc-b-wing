"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { inr, fmtDateDMY } from "@/lib/format";
import { formSelectFilter } from "@/lib/form-styles";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import { readCurrentUser } from "@/lib/auth-client";
import {
  COMMON_EXPENSE_TOTAL_FLATS,
  emptyCommonExpenseSplit,
  readCommonExpenseSplit,
  type CommonExpenseSplitStats,
} from "@/lib/common-expense-split-api";
import {
  deleteBuilderCommonCollectionClient,
  readBuilderCommonCollections,
  updateBuilderCommonCollectionClient,
  createBuilderCommonCollectionClient,
  type BuilderCommonCollectionRecord,
} from "@/lib/builder-common-collections-api";
import BuilderCommonCollectionModal, {
  type BuilderCommonCollectionFormData,
} from "@/components/collections/BuilderCommonCollectionModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [builderRows, setBuilderRows] = useState<BuilderCommonCollectionRecord[]>([]);
  const [builderRowsLoading, setBuilderRowsLoading] = useState(false);

  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [builderModalMode, setBuilderModalMode] = useState<"add" | "edit">("add");
  const [editingBuilder, setEditingBuilder] = useState<BuilderCommonCollectionRecord | null>(null);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderModalError, setBuilderModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BuilderCommonCollectionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (selectedMonth: number, selectedYear: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await readCommonExpenseSplit(selectedMonth, selectedYear, { force: true });
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load common expense split");
      setStats(emptyCommonExpenseSplit(selectedMonth, selectedYear));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBuilderRows = useCallback(async (selectedMonth: number, selectedYear: number) => {
    setBuilderRowsLoading(true);
    try {
      const rows = await readBuilderCommonCollections({
        month: selectedMonth,
        year: selectedYear,
        force: true,
      });
      setBuilderRows(rows);
    } catch {
      setBuilderRows([]);
    } finally {
      setBuilderRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    void readCurrentUser()
      .then((u) => setIsSuperAdmin(u?.role === "super_admin"))
      .catch(() => setIsSuperAdmin(false));
  }, []);

  useEffect(() => {
    void load(month, year);
    void loadBuilderRows(month, year);
  }, [load, loadBuilderRows, month, year]);

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
        void loadBuilderRows(month, year);
      }, 200);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [load, loadBuilderRows, month, year]);

  const totalFlats = COMMON_EXPENSE_TOTAL_FLATS;
  const monthTotal = Number.isFinite(stats.totalCommonExpense) ? stats.totalCommonExpense : 0;
  const perFlat = Number.isFinite(stats.perFlatShare) ? stats.perFlatShare : 0;
  const sold = Number.isFinite(stats.soldFlats) ? stats.soldFlats : 0;
  const unsold = Number.isFinite(stats.unsoldFlats) ? stats.unsoldFlats : 0;
  const soldTotal = Number.isFinite(stats.memberShare)
    ? stats.memberShare
    : perFlat * sold;
  const unsoldTotal = Number.isFinite(stats.builderShare)
    ? stats.builderShare
    : perFlat * unsold;
  const builderCollected = Number.isFinite(stats.builderCollected) ? stats.builderCollected : 0;
  const builderPending = Number.isFinite(stats.builderPending) ? stats.builderPending : 0;
  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? "";

  const years = useMemo(() => {
    const set = new Set(stats.years.length ? stats.years : [year]);
    set.add(year);
    set.add(now.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [stats.years, year, now]);

  function openEditBuilder(row: BuilderCommonCollectionRecord) {
    setBuilderModalMode("edit");
    setEditingBuilder(row);
    setBuilderModalError(null);
    setBuilderModalOpen(true);
  }

  function openAddBuilder() {
    setBuilderModalMode("add");
    setEditingBuilder(null);
    setBuilderModalError(null);
    setBuilderModalOpen(true);
  }

  function closeBuilderModal() {
    if (builderSaving) return;
    setBuilderModalOpen(false);
    setEditingBuilder(null);
    setBuilderModalError(null);
  }

  async function handleBuilderSave(data: BuilderCommonCollectionFormData) {
    setBuilderSaving(true);
    setBuilderModalError(null);
    try {
      if (builderModalMode === "edit" && editingBuilder) {
        await updateBuilderCommonCollectionClient(editingBuilder.id, data);
      } else {
        await createBuilderCommonCollectionClient(data);
      }
      setBuilderModalOpen(false);
      setEditingBuilder(null);
      notifyDataChanged("payment");
      await Promise.all([load(month, year), loadBuilderRows(month, year)]);
    } catch (e) {
      setBuilderModalError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBuilderSaving(false);
    }
  }

  async function handleBuilderDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBuilderCommonCollectionClient(deleteTarget.id);
      setDeleteTarget(null);
      notifyDataChanged("payment");
      await Promise.all([load(month, year), loadBuilderRows(month, year)]);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

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
            : "None (mark categories in Expenses → Manage Categories)"}
        .
        <span className="mt-0.5 block">
          <span className="font-medium text-slate-600">Excluded:</span>{" "}
          {loading
            ? "Loading…"
            : stats.excludedCategories.length
              ? stats.excludedCategories.join(", ")
              : "None"}
          .
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

        <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-orange-800">
              Builder collection
            </div>
            {isSuperAdmin && builderPending > 0 ? (
              <button
                type="button"
                onClick={openAddBuilder}
                className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-orange-800 hover:bg-orange-50"
              >
                + Add
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Builder Share
              </div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-navy">
                {loading ? "…" : inr(Math.round(unsoldTotal))}
              </div>
            </div>
            <div className="rounded-xl bg-white px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/70">
                Collected
              </div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-emerald-800">
                {loading ? "…" : inr(Math.round(builderCollected))}
              </div>
            </div>
            <div className="rounded-xl bg-white px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-amber-700/70">
                Pending
              </div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-amber-900">
                {loading ? "…" : inr(Math.round(builderPending))}
              </div>
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="mt-3 space-y-2">
              {builderRowsLoading ? (
                <p className="px-0.5 text-[11px] text-slate-400">Loading builder payments…</p>
              ) : builderRows.length === 0 ? (
                <p className="px-0.5 text-[11px] text-slate-400">
                  No builder payments recorded for this month.
                </p>
              ) : (
                <ul className="divide-y divide-orange-100 overflow-hidden rounded-xl border border-orange-100 bg-white">
                  {builderRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold tabular-nums text-navy">
                          {inr(Math.round(row.amount))}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {fmtDateDMY(row.paymentDate)} ·{" "}
                          <span className="capitalize">{row.paymentMode}</span>
                          {row.referenceNumber ? ` · ${row.referenceNumber}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditBuilder(row)}
                          className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(row);
                          }}
                          className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">
        Formula: Common total ÷ {totalFlats} = per flat. Sold share = per flat × {sold}. Builder share = per flat ×{" "}
        {unsold}. Builder payments do not reduce the common expense total.
      </p>

      <BuilderCommonCollectionModal
        open={builderModalOpen && isSuperAdmin}
        mode={builderModalMode}
        initial={editingBuilder}
        saving={builderSaving}
        error={builderModalError}
        onClose={closeBuilderModal}
        onSubmit={handleBuilderSave}
      />

      <ConfirmDeleteModal
        open={!!deleteTarget && isSuperAdmin}
        title="Delete Builder Collection?"
        itemName={deleteTarget ? inr(Math.round(deleteTarget.amount)) : undefined}
        quoteItemName={false}
        message="Are you sure you want to delete this builder payment of"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleBuilderDelete()}
      />
    </section>
  );
}
