import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error";
interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

const DURATIONS: Record<ToastVariant, number> = { success: 3500, error: 6000 };

/**
 * App-wide toast/snackbar. Before this, every create/update/delete flow
 * just closed its modal and silently reloaded — the only "confirmation"
 * was a table changing a moment later, and a failed request often had no
 * visible feedback at all. Mount once at the root; call useToast()
 * anywhere to surface a success or error message.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURATIONS[variant]);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.variant}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns a `showToast(message, variant?)` function; variant defaults to "success". */
export function useToast() {
  const ctx = useContext(ToastContext);
  return useMemo(() => ctx ?? (() => {}), [ctx]);
}
