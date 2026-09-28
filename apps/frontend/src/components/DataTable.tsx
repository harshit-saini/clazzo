import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  /** Bumps this column's font-weight so the row's primary identifier (a
   * name) stands out — without this every column rendered at the same
   * weight, so a table read as a flat wall of same-weight text. */
  primary?: boolean;
}

export function DataTable<T>({ columns, rows, rowKey, emptyMessage = "Nothing here yet." }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: ReactNode;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="table-scroll">
      <p className="table-scroll-hint">Swipe sideways to see more →</p>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header} style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.header} style={col.primary ? { fontWeight: 600 } : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
