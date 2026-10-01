import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Every dialog has the same footer: Cancel first, primary action last, on
 * the right. Form dialogs put their submit button in `actions` with a
 * `form="…"` attribute pointing at the form's id, rather than a full-width
 * button inside the body with a lone "Close" stranded underneath.
 */
export function Modal({ title, onClose, children, actions, busy, cancelLabel = "Cancel", wide }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** While true, the dialog can't be dismissed via backdrop click or Escape
   * — a request is in flight and closing now would hide its outcome. */
  busy?: boolean;
  /** "Close" for dialogs with nothing to cancel; "Cancel" otherwise. */
  cancelLabel?: string;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // Prefer the first field over the header controls when there is one.
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? dialog)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!busy) onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  return (
    <div className="dialog-backdrop" onClick={() => !busy && onClose()}>
      <div
        ref={dialogRef}
        className={`dialog${wide ? " dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title" id={titleId}>{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          {actions}
        </div>
      </div>
    </div>
  );
}
