"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Device", icon: Monitor },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const ActiveIcon = OPTIONS.find((o) => o.value === theme)?.icon || Monitor;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="Theme settings"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Theme"
      >
        <ActiveIcon className="h-4 w-4" strokeWidth={2.25} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-slate-800 shadow-[0_12px_32px_rgba(15,40,80,0.18)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        >
          <div className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Theme
          </div>
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-semibold transition " +
                  (active
                    ? "bg-brand/15 text-brand dark:bg-brand/20 dark:text-[#7dd3fc]"
                    : "text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800")
                }
              >
                <Icon
                  className={
                    "h-4 w-4 shrink-0 " +
                    (active ? "text-brand dark:text-[#7dd3fc]" : "text-slate-600 dark:text-slate-300")
                  }
                  strokeWidth={2.25}
                />
                <span>{label}</span>
                {active && (
                  <span className="ml-auto text-[12px] font-bold text-brand dark:text-[#7dd3fc]">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
