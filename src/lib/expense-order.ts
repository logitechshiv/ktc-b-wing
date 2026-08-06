import Expense from "@/models/Expense";

export async function getNextDisplayOrder() {
  const last = await Expense.findOne({ displayOrder: { $gt: 0 } })
    .sort({ displayOrder: -1 })
    .select({ displayOrder: 1 })
    .lean();
  const max = Number(last?.displayOrder) || 0;
  return max + 1;
}
