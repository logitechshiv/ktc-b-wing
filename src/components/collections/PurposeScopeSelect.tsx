"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, Home } from "lucide-react";
import type { PurposeRecord } from "@/lib/payment-purposes-api";
import {
  collectionScopeShortLabel,
  normalizeCollectionScope,
  type CollectionScope,
} from "@/lib/collection-scope";

function ScopeIcon({
  scope,
  className = "h-4 w-4 shrink-0 text-slate-400",
}: {
  scope: CollectionScope;
  className?: string;
}) {
  if (scope === "all") {
    return <Building2 className={className} strokeWidth={2.25} aria-hidden />;
  }
  return <Home className={className} strokeWidth={2.25} aria-hidden />;
}

interface Props {
  purposes: PurposeRecord[];
  value: string;
  disabled?: boolean;
  onChange: (purposeId: string) => void;
}

export default function PurposeScopeSelect({
  purposes,
  value,
  disabled = false,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(
    () =>
      [...purposes].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta - tb;
      }),
    [purposes]
  );

  const selected = sorted.find((p) => p.id === value) || null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || sorted.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand dark:focus:ring-brand/30 " +
          (open ? "border-brand" : "")
        }
      >
        {selected ? (
          <>
            <ScopeIcon
              scope={normalizeCollectionScope(selected.collectionScope)}
              className="h-4 w-4 shrink-0 text-brand"
            />
            <span className="min-w-0 flex-1 truncate font-medium">{selected.title}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-slate-400">
            {sorted.length === 0 ? "No Purpose available" : "Select purpose…"}
          </span>
        )}
        <ChevronDown
          className={"h-4 w-4 shrink-0 text-slate-400 transition " + (open ? "rotate-180" : "")}
          strokeWidth={2.25}
          aria-hidden
        />
      </button>

      {open && sorted.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {sorted.map((p) => {
            const scope = normalizeCollectionScope(p.collectionScope);
            const isSelected = p.id === value;
            return (
              <li key={p.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={
                    "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-brand/5 " +
                    (isSelected ? "bg-brand/5" : "")
                  }
                >
                  <ScopeIcon
                    scope={scope}
                    className={
                      "mt-0.5 h-4 w-4 shrink-0 " +
                      (isSelected ? "text-brand" : "text-slate-400")
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        "block truncate text-sm font-medium " +
                        (isSelected ? "text-brand" : "text-navy dark:text-slate-100")
                      }
                    >
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                      {collectionScopeShortLabel(scope)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
