import type { ReactNode } from "react";

export function Modal({ title, onClose, children, actions }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          {actions}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
