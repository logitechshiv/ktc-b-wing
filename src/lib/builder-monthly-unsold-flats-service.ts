import { connectDB } from "@/lib/mongodb";
import BuilderMonthlyUnsoldFlats from "@/models/BuilderMonthlyUnsoldFlats";
import { COMMON_EXPENSE_TOTAL_FLATS } from "@/lib/common-expense-constants";

export async function getMonthlyUnsoldFlats(month: number, year: number): Promise<number | null> {
  await connectDB();
  const row = await BuilderMonthlyUnsoldFlats.findOne({ month, year })
    .select({ unsoldFlats: 1 })
    .lean()
    .exec();
  return row ? Number(row.unsoldFlats) : null;
}

export async function setMonthlyUnsoldFlats(month: number, year: number, unsoldFlats: number) {
  await connectDB();
  return BuilderMonthlyUnsoldFlats.findOneAndUpdate(
    { month, year },
    { $set: { unsoldFlats } },
    { new: true, upsert: true, runValidators: true }
  ).exec();
}

export function parseMonthlyUnsoldFlats(value: unknown): number | null {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0 || count > COMMON_EXPENSE_TOTAL_FLATS) {
    return null;
  }
  return count;
}
