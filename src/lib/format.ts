/**
 * Format INR for display site-wide.
 * - Whole amounts (e.g. 11000) → ₹11,000 (no decimals)
 * - Fractional amounts (e.g. 11000.38) → ₹11,000.38 (exactly 2 decimals)
 */
export const inr = (n: number) => {
  const value = Number(n);
  if (!Number.isFinite(value)) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(0);
  }

  // Normalize to paise to avoid float noise (e.g. 10.999999999)
  const rounded2 = Math.round(value * 100) / 100;
  const isWhole = Math.abs(rounded2 - Math.round(rounded2)) < 1e-9;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(isWhole ? Math.round(rounded2) : rounded2);
};

/** Always show exactly 2 decimal places (e.g. ₹1,310.67 / ₹68,155.00). */
export const inr2 = (n: number) => {
  const value = Number(n);
  const amount = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** DD-MM-YYYY for expense lists */
export const fmtDateDMY = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
};
export const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone;
};

/** Format plate like GJ05HX 4595 */
export const formatPlate = (plate: string) => {
  const clean = plate.replace(/\s/g, "").toUpperCase();
  if (clean.length > 4) return `${clean.slice(0, -4)} ${clean.slice(-4)}`;
  return clean;
};