import type { ReactNode } from "react";

/** A consistent "nothing here yet" card with room for an action — extracted
 * from a pattern StructurePage had that nowhere else reused, leaving every
 * other empty list (students, staff, subjects, fees) as a bare, actionless
 * line of muted text. */
export function EmptyState({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="card" style={{ padding: 28, alignItems: "center", textAlign: "center", gap: 12, color: "var(--color-neutral-600)" }}>
      <p style={{ margin: 0 }}>{title}</p>
      {action}
    </div>
  );
}
