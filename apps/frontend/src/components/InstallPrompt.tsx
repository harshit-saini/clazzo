import { useEffect, useState } from "react";

const DISMISSED_KEY = "clazzo_install_dismissed";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function recentlyDismissed() {
  const at = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
  return Date.now() - at < SNOOZE_MS;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * A phone-first app that most people never install, because the browser's
 * own prompt is easy to miss and iOS Safari has none at all. Android/Chrome
 * gets a real install button (via beforeinstallprompt); iOS gets the
 * "Share → Add to Home Screen" steps. Dismissal is remembered for 30 days.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) setShowIos(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDeferred(null);
    setShowIos(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!deferred && !showIos) return null;

  return (
    <div className="install-card" role="region" aria-label="Install Clazzo">
      <div className="install-card-text">
        {deferred ? (
          <>
            <strong>Install Clazzo</strong>
            <div className="text-muted">Opens like an app, from your home screen.</div>
          </>
        ) : (
          <>
            <strong>Add Clazzo to your Home Screen</strong>
            <div className="text-muted">Tap the Share button, then “Add to Home Screen”.</div>
          </>
        )}
      </div>
      {deferred && (
        <button type="button" className="btn btn-primary btn-sm" onClick={install}>
          Install
        </button>
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={dismiss}>
        Not now
      </button>
    </div>
  );
}
