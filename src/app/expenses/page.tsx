"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { inr } from "@/lib/format";
import type { SafeUser } from "@/lib/auth-client";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expense-constants";
import { displayExpenseTitle } from "@/lib/expense-utils";
import {
  createExpense,
  deleteExpense,
  markExpenseWhatsappShared,
  readExpenses,
  reorderExpenses,
  updateExpense,
  type ExpenseInput,
  type ExpenseRecord,
} from "@/lib/expenses-api";
import { readPurposes, type PurposeRecord } from "@/lib/payment-purposes-api";
import { notifyDataChanged } from "@/lib/data-sync";
import ExpenseRow from "@/components/ExpenseRow";
import ExpenseModal from "@/components/expenses/ExpenseModal";
import DeleteExpenseDialog from "@/components/expenses/DeleteExpenseDialog";

function toRow(e: ExpenseRecord) {
  return {
    id: e.id,
    category: e.category,
    name: displayExpenseTitle(e.expenseTitle, e.expenseTitleGujarati),
    amount: e.amount,
    date: e.expenseDate,
    note: e.notes || undefined,
    paymentMethod: e.paymentMethod,
    expenseMethod: e.expenseMethod,
    purposeName: e.collectionPurposeName || undefined,
    hasBill: !!e.billImage,
    billUrl: e.billImage || undefined,
    sharedToGroup: e.whatsappShared,
    displayOrder: e.displayOrder,
  };
}

export default function ExpensesPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [shownTotal, setShownTotal] = useState(0);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const [purposes, setPurposes] = useState<PurposeRecord[]>([]);

  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtersActive = q.trim() !== "" || category !== "all";
  const canReorder = isSuperAdmin && !filtersActive && !reordering;

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data.user ?? null);
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    readPurposes(true)
      .then((data) => setPurposes(data.purposes))
      .catch(() => setPurposes([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readExpenses({ q, category });
      setExpenses(data.expenses);
      setShownTotal(data.shownTotal);
      setSummaryTotal(data.summary.totalAmount);
      setDbCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load expenses");
      setExpenses([]);
      setShownTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>([...DEFAULT_EXPENSE_CATEGORIES, ...dbCategories]);
    return ["all", ...Array.from(set)];
  }, [dbCategories]);

  function openAdd() {
    setModalMode("add");
    setEditing(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(e: ExpenseRecord) {
    setModalMode("edit");
    setEditing(e);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSave(input: ExpenseInput) {
    setSaving(true);
    setModalError(null);
    setSuccess(null);
    try {
      if (modalMode === "edit" && editing) {
        await updateExpense(editing.id, input);
        setSuccess("Expense updated");
      } else {
        await createExpense(input);
        setSuccess("Expense added");
      }
      setModalOpen(false);
      setEditing(null);
      await load();
      notifyDataChanged("expense");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Unable to save expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess("Expense deleted");
      await load();
      notifyDataChanged("expense");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete expense");
    } finally {
      setDeleting(false);
    }
  }

  async function handleWhatsappShare(e: ExpenseRecord) {
    if (!isSuperAdmin || e.whatsappShared) return;
    try {
      const updated = await markExpenseWhatsappShared(e.id);
      setExpenses((list) => list.map((x) => (x.id === e.id ? updated : x)));
    } catch {
      /* ignore mark failures */
    }
  }

  function onDragStart(id: string, e: DragEvent<HTMLLIElement>) {
    if (!canReorder) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOver(id: string, e: DragEvent<HTMLLIElement>) {
    if (!canReorder || !dragId || dragId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverId(id);
  }

  function onDragLeave(id: string) {
    setOverId((cur) => (cur === id ? null : cur));
  }

  async function persistOrder(next: ExpenseRecord[]) {
    const payload = next.map((item, index) => ({
      id: item.id,
      displayOrder: index + 1,
    }));
    const withOrder = next.map((item, index) => ({
      ...item,
      displayOrder: index + 1,
    }));
    setExpenses(withOrder);
    setReordering(true);
    setError(null);
    try {
      await reorderExpenses(payload);
      notifyDataChanged("expense");
      setSuccess("Order updated");
      window.setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save order");
      await load();
    } finally {
      setReordering(false);
    }
  }

  async function onDrop(targetId: string, e: DragEvent<HTMLLIElement>) {
    e.preventDefault();
    if (!canReorder || !dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }

    const from = expenses.findIndex((x) => x.id === dragId);
    const to = expenses.findIndex((x) => x.id === targetId);
    setDragId(null);
    setOverId(null);
    if (from < 0 || to < 0 || from === to) return;

    const next = [...expenses];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await persistOrder(next);
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  const displayTotal = filtersActive ? shownTotal : summaryTotal || shownTotal;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-navy">Expenses</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {isSuperAdmin
              ? "Drag cards to reorder · share to WhatsApp group"
              : "Category · name · share to WhatsApp group"}
          </p>
        </div>
        <div className="flex items-end gap-3">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={openAdd}
              className="rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-900"
            >
              + Add Expense
            </button>
          )}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">કુલ ખર્ચ</div>
            <div className="text-base font-bold tabular-nums text-rose-500">{inr(displayTotal)}</div>
          </div>
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

      {isSuperAdmin && filtersActive && (
        <p className="text-[11px] text-amber-600">Clear search & filters to drag and reorder expenses.</p>
      )}
      {reordering && <p className="text-[11px] text-slate-400">Saving order…</p>}

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading expenses…</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <ExpenseRow
                  key={e.id}
                  expense={toRow(e)}
                  isSuperAdmin={isSuperAdmin}
                  canReorder={canReorder}
                  isDragging={dragId === e.id}
                  isDragOver={overId === e.id}
                  onEdit={() => openEdit(e)}
                  onDelete={() => setDeleteTarget(e)}
                  onWhatsappShare={() => void handleWhatsappShare(e)}
                  onDragStart={(ev) => onDragStart(e.id, ev)}
                  onDragOver={(ev) => onDragOver(e.id, ev)}
                  onDragLeave={() => onDragLeave(e.id)}
                  onDrop={(ev) => void onDrop(e.id, ev)}
                  onDragEnd={onDragEnd}
                />
              ))}
            </ul>
            {expenses.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">No expenses match your filters.</p>
            )}
          </>
        )}
      </section>

      <ExpenseModal
        open={modalOpen}
        mode={modalMode}
        initial={editing}
        purposes={purposes}
        saving={saving}
        error={modalError}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setModalError(null);
        }}
        onSubmit={handleSave}
      />

      <DeleteExpenseDialog
        open={!!deleteTarget}
        title={
          deleteTarget
            ? displayExpenseTitle(deleteTarget.expenseTitle, deleteTarget.expenseTitleGujarati)
            : undefined
        }
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
