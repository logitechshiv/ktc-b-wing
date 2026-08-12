/**
 * Early capture of beforeinstallprompt so the deferred event
 * is not lost before the header Install button mounts.
 */

export interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEventLike | null = null;
let installedFlag = false;
let captureStarted = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/** iPhone/iPad Safari (not Chrome/Firefox/Edge on iOS). */
export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  const isWebKit = /WebKit/i.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
  return isWebKit && !isOtherBrowser;
}

export function initPwaInstallCapture(): void {
  if (typeof window === "undefined" || captureStarted) return;
  captureStarted = true;

  if (isPwaStandalone()) {
    installedFlag = true;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEventLike;
    installedFlag = false;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedFlag = true;
    notify();
  });

  const mq = window.matchMedia("(display-mode: standalone)");
  const onDisplayMode = () => {
    if (isPwaStandalone()) {
      installedFlag = true;
      deferredPrompt = null;
      notify();
    }
  };
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onDisplayMode);
  } else {
    mq.addListener(onDisplayMode);
  }
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEventLike | null {
  return deferredPrompt;
}

export function isPwaMarkedInstalled(): boolean {
  return installedFlag || isPwaStandalone();
}

export function subscribePwaInstall(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const promptEvent = deferredPrompt;
  if (!promptEvent) return "unavailable";
  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") {
      installedFlag = true;
    }
    notify();
    return outcome;
  } catch {
    deferredPrompt = null;
    notify();
    return "unavailable";
  }
}
