export interface ExpenseByCategory {
  category: string;
  amount: number;
}

export interface DashboardRecentExpense {
  id: string;
  category: string;
  expenseTitleGujarati: string;
  amount: number;
  displayOrder: number;
  paymentMethod: string;
  expenseDate: string;
  billImage: string;
  notes: string;
  whatsappShared: boolean;
}

export interface DashboardStats {
  totalBalance: number;
  totalCollection: number;
  totalExpense: number;
  cashInHand: number;
  bankBalance: number;
  flats: {
    total: number;
    sold: number;
    available: number;
  };
  vehicles: {
    fourWheelers: number;
    twoWheelers: number;
    threeWheelers: number;
  };
  expensesByCategory: ExpenseByCategory[];
  recentExpenses: DashboardRecentExpense[];
}

export const EMPTY_DASHBOARD: DashboardStats = {
  totalBalance: 0,
  totalCollection: 0,
  totalExpense: 0,
  cashInHand: 0,
  bankBalance: 0,
  flats: { total: 0, sold: 0, available: 0 },
  vehicles: { fourWheelers: 0, twoWheelers: 0, threeWheelers: 0 },
  expensesByCategory: [],
  recentExpenses: [],
};

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function readDashboard(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard", { cache: "no-store" });
  const data = await parseJson(res);
  return {
    totalBalance: Number(data.totalBalance) || 0,
    totalCollection: Number(data.totalCollection) || 0,
    totalExpense: Number(data.totalExpense) || 0,
    cashInHand: Math.max(0, Number(data.cashInHand) || 0),
    bankBalance: Number(data.bankBalance) || 0,
    flats: {
      total: Number(data.flats?.total) || 0,
      sold: Number(data.flats?.sold) || 0,
      available: Number(data.flats?.available) || 0,
    },
    vehicles: {
      fourWheelers: Number(data.vehicles?.fourWheelers) || 0,
      twoWheelers: Number(data.vehicles?.twoWheelers) || 0,
      threeWheelers: Number(data.vehicles?.threeWheelers) || 0,
    },
    expensesByCategory: Array.isArray(data.expensesByCategory)
      ? (data.expensesByCategory as ExpenseByCategory[]).map((row) => ({
          category: String(row.category || ""),
          amount: Number(row.amount) || 0,
        }))
      : [],
    recentExpenses: Array.isArray(data.recentExpenses)
      ? (data.recentExpenses as DashboardRecentExpense[]).map((row) => ({
          id: String(row.id || ""),
          category: String(row.category || ""),
          expenseTitleGujarati:
            String(row.expenseTitleGujarati || "").trim() ||
            String((row as { expenseTitle?: string }).expenseTitle || "").trim(),
          amount: Number(row.amount) || 0,
          displayOrder: Number(row.displayOrder) || 0,
          paymentMethod: String(row.paymentMethod || ""),
          expenseDate: String(row.expenseDate || "").slice(0, 10),
          billImage: String(row.billImage || ""),
          notes: String(row.notes || ""),
          whatsappShared: !!row.whatsappShared,
        }))
      : [],
  };
}
