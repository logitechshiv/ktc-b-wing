"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  getDeferredInstallPrompt,
  initPwaInstallCapture,
  isIosSafari,
  isPwaMarkedInstalled,
  promptPwaInstall,
  subscribePwaInstall,
} from "@/lib/pwa-install";

/**
 * Header Install App control — uses real beforeinstallprompt when available.
 * Hidden when already installed or when install is unavailable (except iOS Safari hint).
 */
export default function InstallAppButton() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initPwaInstallCapture();

    const sync = () => {
      setInstalled(isPwaMarkedInstalled());
      setCanPrompt(!!getDeferredInstallPrompt());
      setIosSafari(isIosSafari());
      setReady(true);
    };

    sync();
    return subscribePwaInstall(sync);
  }, []);

  useEffect(() => {
    if (!showIosHelp) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setShowIosHelp(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowIosHelp(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showIosHelp]);

  if (!ready || installed) return null;

  const showChromeInstall = canPrompt;
  const showIosInstall = !canPrompt && iosSafari;

  if (!showChromeInstall && !showIosInstall) return null;

  async function handleInstallClick() {
    if (showIosInstall) {
      setShowIosHelp((v) => !v);
      return;
    }
    if (!canPrompt || busy) return;
    setBusy(true);
    try {
      await promptPwaInstall();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        disabled={busy}
        className="inline-flex h-9 max-w-[7.5rem] items-center justify-center gap-1 rounded-xl bg-white/15 px-2.5 text-[11px] font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-70 sm:max-w-none sm:gap-1.5 sm:px-3 sm:text-[12px]"
        aria-label="Install App"
        aria-expanded={showIosInstall ? showIosHelp : undefined}
        aria-haspopup={showIosInstall ? "dialog" : undefined}
        title="Install App"
      >
        <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="truncate">
          <span className="sm:hidden">Install</span>
          <span className="hidden sm:inline">Install App</span>
        </span>
      </button>

      {showIosInstall && showIosHelp && (
        <div
          role="dialog"
          aria-label="How to install on iPhone"
          className="absolute right-0 z-50 mt-2 w-[min(16.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-slate-800 shadow-[0_12px_32px_rgba(15,40,80,0.18)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          <p className="text-[12px] font-semibold leading-snug text-navy dark:text-slate-100">
            Install on iPhone / iPad
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Safari → Share → Add to Home Screen
          </p>
        </div>
      )}
    </div>
  );
}
