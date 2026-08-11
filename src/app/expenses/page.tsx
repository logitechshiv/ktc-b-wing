"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { inr } from "@/lib/format";
import { readCurrentUser, type SafeUser } from "@/lib/auth-client";
import { displayExpenseTitle } from "@/lib/expense-utils";
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  markExpenseWhatsappShared,
  readExpenseCategories,
  readExpenses,
  reorderExpenses,
  updateExpense,
  updateExpenseCategory,
  type ExpenseCategoryRecord,
  type ExpenseInput,
  type ExpenseRecord,
} from "@/lib/expenses-api";
import { CacheKeys, peekCache } from "@/lib/data-cache";
import { notifyDataChanged, subscribeDataChanged } from "@/lib/data-sync";
import ExpenseRow from "@/components/ExpenseRow";
import ExpenseModal from "@/components/expenses/ExpenseModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

type ExpensesCachePayload = {
  expenses: ExpenseRecord[];
  shownTotal: number;
  categories: string[];
  nextDisplayOrder: number;
  summary: { totalExpenses: number; totalAmount: number };
};

function expensesCacheKey(q: string, category: string) {
  return CacheKeys.expenses(q.trim(), category || "all");
}

function toRow(e: ExpenseRecord) {
  return {
    id: e.id,
    category: e.category,
    name: displayExpenseTitle(e.expenseTitleGujarati),
    amount: e.amount,
    date: e.expenseDate,
    note: e.notes?.trim() || undefined,
    paymentMethod: e.paymentMethod,
    hasBill: (e.billImages?.length ?? 0) > 0 || !!e.billImage?.trim(),
    billUrl: e.billImages?.[0]?.trim() || e.billImage?.trim() || undefined,
    billUrls:
      e.billImages?.length > 0
        ? e.billImages
        : e.billImage?.trim()
          ? [e.billImage.trim()]
          : undefined,
    sharedToGroup: e.whatsappShared,
    displayOrder: e.displayOrder,
  };
}

export default function ExpensesPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const initialExpenses = peekCache<ExpensesCachePayload>(expensesCacheKey("", "all"));
  const initialCategories = peekCache<ExpenseCategoryRecord[]>(CacheKeys.expenseCategories());

  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses?.expenses ?? []);
  const [managedCategories, setManagedCategories] = useState<ExpenseCategoryRecord[]>(
    initialCategories ?? []
  );
  const [expenseCategories, setExpenseCategories] = useState<string[]>(
    initialExpenses?.categories ?? []
  );
  const [shownTotal, setShownTotal] = useState(initialExpenses?.shownTotal ?? 0);
  const [summaryTotal, setSummaryTotal] = useState(initialExpenses?.summary.totalAmount ?? 0);
  const [loading, setLoading] = useState(!initialExpenses);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const [user, setUser] = useState<SafeUser | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<ExpenseCategoryRecord | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIncludeCommon, setNewCategoryIncludeCommon] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryIncludeCommon, setEditingCategoryIncludeCommon] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);

  const filtersActive = q.trim() !== "" || category !== "all";
  /** List order is fixed by createdAt DESC (newest first) — drag reorder disabled. */
  const canReorder = false;

  useEffect(() => {
    void readCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  const loadCategories = useCallback(async (opts?: { force?: boolean }) => {
    try {
      const list = await readExpenseCategories({ force: opts?.force });
      setManagedCategories(list);
    } catch {
      if (opts?.force) setManagedCategories([]);
    }
  }, []);

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    if (!force) {
      const cached = peekCache<ExpensesCachePayload>(expensesCacheKey(q, category));
      if (cached) {
        setExpenses(cached.expenses);
        setShownTotal(cached.shownTotal);
        setSummaryTotal(cached.summary.totalAmount);
        setExpenseCategories(cached.categories || []);
        setError(null);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const data = await readExpenses({ q, category, force });
      setExpenses(data.expenses);
      setShownTotal(data.shownTotal);
      setSummaryTotal(data.summary.totalAmount);
      setExpenseCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load expenses");
      setExpenses([]);
      setShownTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  useEffect(() => {
    if (peekCache(CacheKeys.expenseCategories())) {
      void loadCategories();
      return;
    }
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (peekCache(expensesCacheKey(q, category))) {
      void load();
      return;
    }
    const t = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(t);
  }, [load, q, category]);

  // Live refresh when expenses change elsewhere (dashboard, another tab)
  useEffect(() => {
    return subscribeDataChanged((source) => {
      if (source === "expense" || source === "unknown") {
        void load({ force: true });
        void loadCategories({ force: true });
      }
    });
  }, [load, loadCategories]);

  const filterCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of managedCategories) {
      if (c.name.trim()) set.add(c.name.trim());
    }
    for (const c of expenseCategories) {
      if (c.trim()) set.add(c.trim());
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [managedCategories, expenseCategories]);

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
      if (modalMode === "edit") {
        if (!editing?.id) {
          throw new Error("Missing expense id — cannot update. Re-open Edit and try again.");
        }
        await updateExpense(editing.id, {
          ...input,
          whatsappShared: editing.whatsappShared,
        });
        setSuccess("Expense updated");
      } else {
        await createExpense(input);
        setSuccess("Expense added");
      }
      setModalOpen(false);
      setModalMode("add");
      setEditing(null);
      notifyDataChanged("expense");
      await load({ force: true });
      await loadCategories({ force: true });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Unable to save expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    setError(null);
    try {
      await deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess("Expense deleted");
      notifyDataChanged("expense");
      await load({ force: true });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete this record. Please try again."
      );
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

  async function handleAddCategory() {
    if (editingCategoryId) {
      setError("Finish or cancel category edit before adding a new one");
      return;
    }
    const name = newCategoryName.trim();
    if (!name) return;
    setCategorySaving(true);
    setError(null);
    try {
      await createExpenseCategory(name, newCategoryIncludeCommon);
      setNewCategoryName("");
      setNewCategoryIncludeCommon(false);
      setSuccess("Category added");
      notifyDataChanged("expense");
      await loadCategories({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add category");
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleSaveCategory() {
    const id = editingCategoryId?.trim();
    if (!id) {
      setError("No category selected for edit");
      return;
    }
    const name = editingCategoryName.trim();
    if (!name) return;
    setCategorySaving(true);
    setError(null);
    try {
      const updated = await updateExpenseCategory(id, name, editingCategoryIncludeCommon);
      // Update in place by id — never append a duplicate row
      setManagedCategories((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      cancelCategoryEdit();
      setSuccess("Category updated");
      notifyDataChanged("expense");
      await loadCategories({ force: true });
      await load({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update category");
    } finally {
      setCategorySaving(false);
    }
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryIncludeCommon(false);
    setNewCategoryName("");
    setNewCategoryIncludeCommon(false);
    setError(null);
  }

  async function handleDeleteCategory() {
    if (!deleteCategoryTarget || deletingCategory) return;
    const id = deleteCategoryTarget.id;
    setDeletingCategory(true);
    setDeleteCategoryError(null);
    setError(null);
    try {
      await deleteExpenseCategory(id);
      if (editingCategoryId === id) {
        setEditingCategoryId(null);
        setEditingCategoryName("");
      }
      setDeleteCategoryTarget(null);
      setSuccess("Category deleted");
      notifyDataChanged("expense");
      await loadCategories({ force: true });
    } catch (err) {
      setDeleteCategoryError(
        err instanceof Error ? err.message : "Unable to delete this record. Please try again."
      );
    } finally {
      setDeletingCategory(false);
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
      await load({ force: true });
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
          <p className="mt-0.5 text-xs text-slate-500">Category · name · share to WhatsApp group</p>
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
        {filterCategories.map((c) => (
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

      {isSuperAdmin && (
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Manage Categories
          </div>
          <div className="space-y-3 p-4">
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!editingCategoryId) void handleAddCategory();
                    }
                  }}
                  placeholder="New category name"
                  disabled={!!editingCategoryId || categorySaving}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={
                    !!editingCategoryId || categorySaving || !newCategoryName.trim()
                  }
                  onClick={() => void handleAddCategory()}
                  className="shrink-0 rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  + Add Category
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={newCategoryIncludeCommon}
                  onChange={(e) => setNewCategoryIncludeCommon(e.target.checked)}
                  disabled={!!editingCategoryId || categorySaving}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand disabled:opacity-50"
                />
                Include in Common Expense
              </label>
              {editingCategoryId ? (
                <p className="text-[11px] text-amber-600">
                  Editing a category — Save or Cancel below before adding a new one.
                </p>
              ) : null}
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
              {managedCategories.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                  {editingCategoryId === c.id ? (
                    <>
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleSaveCategory();
                            }
                          }}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                        />
                        <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={editingCategoryIncludeCommon}
                            onChange={(e) => setEditingCategoryIncludeCommon(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand"
                          />
                          Include in Common Expense
                        </label>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={categorySaving}
                          onClick={() => void handleSaveCategory()}
                          className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelCategoryEdit}
                          className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-navy">{c.name}</div>
                        <div
                          className={
                            "mt-0.5 text-[11px] font-medium " +
                            (c.includeInCommonExpense ? "text-emerald-600" : "text-slate-400")
                          }
                        >
                          {c.includeInCommonExpense ? "✓ Included in Common Expense" : "✕ Excluded from Common Expense"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(c.id);
                            setEditingCategoryName(c.name);
                            setEditingCategoryIncludeCommon(!!c.includeInCommonExpense);
                            setNewCategoryName("");
                            setNewCategoryIncludeCommon(false);
                            setError(null);
                          }}
                          className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-semibold text-brand"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={categorySaving || deletingCategory}
                          onClick={() => {
                            setDeleteCategoryError(null);
                            setDeleteCategoryTarget(c);
                          }}
                          className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {managedCategories.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-400">
                  No categories yet. Add one above.
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      {isSuperAdmin && filtersActive && (
        <p className="text-[11px] text-amber-600">Showing filtered expenses. Clear search & filters to see the full list.</p>
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
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleteTarget(e);
                  }}
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
        categories={managedCategories}
        saving={saving}
        error={modalError}
        onClose={() => {
          setModalOpen(false);
          setModalMode("add");
          setEditing(null);
          setModalError(null);
        }}
        onSubmit={handleSave}
      />

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete Expense?"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleDelete()}
      >
        <p>Are you sure you want to delete this record?</p>
        {deleteTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">Expense:</span>{" "}
            <span className="font-bold">
              {displayExpenseTitle(deleteTarget.expenseTitleGujarati)}
            </span>
            <br />
            <span className="font-semibold">Category:</span> {deleteTarget.category}
            <br />
            <span className="font-semibold">Amount:</span> {inr(deleteTarget.amount)}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">This action cannot be undone.</p>
      </ConfirmDeleteModal>

      <ConfirmDeleteModal
        open={!!deleteCategoryTarget}
        title="Delete Expense Category?"
        loading={deletingCategory}
        error={deleteCategoryError}
        onCancel={() => {
          if (deletingCategory) return;
          setDeleteCategoryTarget(null);
          setDeleteCategoryError(null);
        }}
        onConfirm={() => void handleDeleteCategory()}
      >
        <p>Are you sure you want to delete this record?</p>
        {deleteCategoryTarget ? (
          <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-navy">
            <span className="font-semibold">Category:</span>{" "}
            <span className="font-bold">{deleteCategoryTarget.name}</span>
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">
          Existing expenses that use this category name will keep their category text. This action
          cannot be undone.
        </p>
      </ConfirmDeleteModal>
    </div>
  );
}
