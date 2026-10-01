import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useUnits } from "../lib/useUnits";

interface Result {
  key: string;
  kind: "Student" | "Group" | "Subject";
  label: string;
  hint?: string;
  to: string;
}

interface CourseRow {
  id: string;
  name: string;
  orgUnit: { name: string };
}

/**
 * Ctrl/⌘+K palette: one box that finds a student, group or subject and jumps
 * straight to it, instead of walking Students → search → row. Groups and
 * subjects are filtered locally; students are searched on the server.
 */
export function GlobalSearch({ onClose, canBrowseStructure }: { onClose: () => void; canBrowseStructure: boolean }) {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Result[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [active, setActive] = useState(0);
  const { units } = useUnits();

  useEffect(() => {
    inputRef.current?.focus();
    if (!canBrowseStructure) return;
    api.get<CourseRow[]>("/api/courses").then(setCourses).catch(() => setCourses([]));
  }, [canBrowseStructure]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get<{ items: { id: string; name: string; guardianName: string | null }[] }>(`/api/students?search=${encodeURIComponent(q)}&take=6`)
        .then((res) => {
          if (cancelled) return;
          setStudents(
            res.items.map((s) => ({
              key: `s-${s.id}`,
              kind: "Student" as const,
              label: s.name,
              hint: s.guardianName ? `Guardian: ${s.guardianName}` : undefined,
              to: `/dashboard/students/${s.id}`,
            }))
          );
        })
        .catch(() => !cancelled && setStudents([]));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const groups: Result[] = canBrowseStructure
      ? units
          .filter((u) => u.label.toLowerCase().includes(q))
          .slice(0, 5)
          .map((u) => ({ key: `g-${u.id}`, kind: "Group" as const, label: u.label, to: `/dashboard/structure/${u.id}` }))
      : [];
    const subjects: Result[] = courses
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({ key: `c-${c.id}`, kind: "Subject" as const, label: c.name, hint: c.orgUnit.name, to: `/dashboard/courses/${c.id}` }));
    return [...students, ...groups, ...subjects];
  }, [query, students, units, courses, canBrowseStructure]);

  useEffect(() => setActive(0), [results.length]);

  function go(r: Result) {
    onClose();
    navigate(r.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  }

  return (
    <div className="dialog-backdrop search-backdrop" onClick={onClose}>
      <div className="dialog search-dialog" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          className="input"
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          aria-label={canBrowseStructure ? "Search students, groups and subjects" : "Search students"}
          placeholder={canBrowseStructure ? "Search students, groups, subjects…" : "Search students…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul id={listId} role="listbox" className="search-results">
          {results.map((r, i) => (
            <li
              key={r.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "search-option search-option-active" : "search-option"}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
            >
              <span className="tag tag-outline">{r.kind}</span>
              <span>
                {r.label}
                {r.hint && <span className="text-muted"> · {r.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
        {query.trim().length >= 2 && results.length === 0 && (
          <p className="text-muted" role="status" style={{ margin: "10px 4px 0", fontSize: 13 }}>
            No matches yet.
          </p>
        )}
        {query.trim().length < 2 && (
          <p className="text-muted" style={{ margin: "10px 4px 0", fontSize: 13 }}>
            Type at least 2 letters. ↑ ↓ to move, Enter to open, Esc to close.
          </p>
        )}
      </div>
    </div>
  );
}
