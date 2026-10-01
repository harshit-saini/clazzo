import { useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  /** Marks the row's identifier (a name): heavier weight, and exposed to
   * screen readers as the row header so each cell is announced with it. */
  primary?: boolean;
  /** Makes the column sortable (client-side, on the rows given). */
  sortValue?: (row: T) => string | number;
  /** What a screen reader hears for a column with an empty `header`. */
  srHeader?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "Nothing here yet.",
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: ReactNode;
  /** Names the table for screen readers (visually hidden). */
  caption?: string;
}) {
  const [sort, setSort] = useState<{ index: number; dir: "asc" | "desc" } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns[sort.index];
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, sort]);

  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  function toggleSort(index: number) {
    setSort((prev) => (prev?.index === index ? (prev.dir === "asc" ? { index, dir: "desc" } : null) : { index, dir: "asc" }));
  }

  return (
    <div className="table-scroll">
      <p className="table-scroll-hint">Swipe sideways to see more →</p>
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col, i) => {
              const sortable = Boolean(col.sortValue);
              const active = sort?.index === i ? sort.dir : null;
              return (
                <th
                  key={`${col.header}-${i}`}
                  scope="col"
                  style={{ width: col.width }}
                  aria-sort={sortable ? (active === "asc" ? "ascending" : active === "desc" ? "descending" : "none") : undefined}
                >
                  {col.header === "" ? (
                    <span className="sr-only">{col.srHeader ?? "Actions"}</span>
                  ) : sortable ? (
                    <button type="button" className="sort-btn" onClick={() => toggleSort(i)}>
                      {col.header}
                      <span aria-hidden="true">{active === "asc" ? "▲" : active === "desc" ? "▼" : "↕"}</span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col, i) =>
                col.primary ? (
                  <th key={`${col.header}-${i}`} scope="row">
                    {col.render(row)}
                  </th>
                ) : (
                  <td key={`${col.header}-${i}`}>{col.render(row)}</td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
