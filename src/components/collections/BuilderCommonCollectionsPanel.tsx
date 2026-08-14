"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteBuilderCommonCollectionClient,
  readBuilderCommonCollections,
  type BuilderCommonCollectionRecord,
} from "@/lib/builder-common-collections-api";
import {
  readCommonExpenseSplit,
  type CommonExpenseSplitStats,
} from "@/lib/common-expense-split-api";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Props = {
  isSuperAdmin: boolean;
  onEdit: (row: BuilderCommonCollectionRecord) => void;
  onAdd: () => void;
  refreshKey?: number;
};

export function BuilderCommonCollectionsPanel({
  isSuperAdmin,
  onEdit,
  onAdd,
  refreshKey = 0,
}: Props) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<BuilderCommonCollectionRecord[]>([]);
  const [split, setSplit] = useState<CommonExpenseSplitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuilderCommonCollectionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2, y + 1];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, splitData] = await Promise.all([
        readBuilderCommonCollections({ month, year, force: true }),
        readCommonExpenseSplit(month, year, { force: true }),
      ]);
      setRows(list);
      setSplit(splitData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load builder collections");
      setRows([]);
      setSplit(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, refreshKey, open]);

  useEffect(() => {
    return subscribeDataChanged((entity) => {
      if (!open) return;
      if (entity === "payment" || entity === "expense" || entity === "flat") {
        void load();
      }
    });
  }, [load, open]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBuilderCommonCollectionClient(deleteTarget.id);
      notifyDataChanged("payment");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-navy">Builder Common Collection</h2>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
              Builder
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Payments against monthly Common Expense Builder Share
          </p>
        </button>

        {/* {isSuperAdmin && open ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="mt-0.5 shrink-0 text-xs font-semibold text-brand hover:underline"
          >
            + Add
          </button>
        ) : null} */}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={
            "mt-0.5 shrink-0 px-0.5 text-slate-400 transition " + (open ? "rotate-180" : "")
          }
          aria-label={open ? "Collapse builder collections" : "Expand builder collections"}
          aria-expanded={open}
        >
          ▾
        </button>
      </div>

      {open && (
        <>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {split && (
            <div className="grid grid-cols-1 gap-2 border-t border-slate-50 px-4 py-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Builder Share
                </div>
                <div className="mt-0.5 text-sm font-bold text-navy">
                  ₹{Math.round(split.builderShare).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Collected
                </div>
                <div className="mt-0.5 text-sm font-bold text-navy">
                  ₹{Math.round(split.builderCollected).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Pending
                </div>
                <div className="mt-0.5 text-sm font-bold text-navy">
                  ₹{Math.round(split.builderPending).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-50 px-4 py-3">
            {loading && <p className="text-xs text-slate-400">Loading…</p>}
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {!loading && !error && rows.length === 0 && (
              <p className="text-xs text-slate-400">No builder collections for this month.</p>
            )}
            {!loading && rows.length > 0 && (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-navy">{row.expenseCategory}</span>
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                          Builder
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {MONTHS[row.month - 1]} {row.year} · {row.paymentDate} · {row.paymentMode}
                        {row.referenceNumber ? ` · ${row.referenceNumber}` : ""}
                      </p>
                      {row.notes ? (
                        <p className="mt-0.5 text-[11px] text-slate-400">{row.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold text-navy">
                        ₹{Math.round(row.amount).toLocaleString("en-IN")}
                      </span>
                      {isSuperAdmin && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-brand"
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteTarget(row);
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete Builder Collection?"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
      >
        <p>Are you sure you want to delete this builder collection?</p>
        {deleteTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">{deleteTarget.expenseCategory}</span>
            <br />
            ₹{Math.round(deleteTarget.amount).toLocaleString("en-IN")} · {MONTHS[deleteTarget.month - 1]}{" "}
            {deleteTarget.year}
          </p>
        ) : null}
      </ConfirmDeleteModal>
    </section>
  );
}
