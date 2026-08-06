/** Shared form control styles — matches Vehicles “Vehicle Type” dropdown in light & dark. */
export const formField =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand dark:focus:ring-brand/30";

/** Native <select> — same look as Vehicle Type; options readable in both themes */
export const formSelect = formField + " form-select appearance-none";

export const formFieldReadonly =
  formField +
  " cursor-default bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300";

/** Page filter selects (no mt-1; parent label handles spacing) */
export const formSelectFilter =
  "form-select w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand dark:focus:ring-brand/30";
