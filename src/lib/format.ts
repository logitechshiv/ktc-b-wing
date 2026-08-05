export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

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