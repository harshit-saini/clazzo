import type { ReactNode } from "react";
import { Modal } from "./Modal";

/** Shared confirmation step for destructive actions — deactivating staff,
 * removing an enrollment, archiving a group, etc. — so none of them fire
 * on a single click with no way to back out. */
export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      }
    >
      {typeof body === "string" ? <p style={{ margin: 0, fontSize: 14 }}>{body}</p> : body}
    </Modal>
  );
}
