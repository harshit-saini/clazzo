import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { FormField, TextInput } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { ChevronRightIcon, PlusIcon } from "../../icons";

const COLLAPSED_KEY = "clazzo_structure_collapsed";

interface OrgLevel {
  id: string;
  name: string;
  depth: number;
}

interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  path: string;
  level: { id: string; name: string; depth: number } | null;
  directStudents: number;
  directCourses: number;
}

/// Students and subjects attached to descendants count towards a parent —
/// "Class 12" should read as the size of 12A + 12B, not zero.
function rollUp(units: OrgUnit[], unit: OrgUnit) {
  const subtree = units.filter((u) => u.path.startsWith(unit.path));
  return {
    students: subtree.reduce((n, u) => n + u.directStudents, 0),
    courses: subtree.reduce((n, u) => n + u.directCourses, 0),
  };
}

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function StructurePage() {
  const [levels, setLevels] = useState<OrgLevel[] | null>(null);
  const [units, setUnits] = useState<OrgUnit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<OrgUnit | null | undefined>(undefined);
  const [editingLevels, setEditingLevels] = useState(false);
  // Collapsed rather than expanded, so a brand-new group is open by default.
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);

  function persistCollapsed(next: Set<string>) {
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
  }

  function toggle(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistCollapsed(next);
  }

  function load() {
    api.get<OrgLevel[]>("/api/structure/levels").then(setLevels);
    api.get<OrgUnit[]>("/api/structure/units").then(setUnits);
  }

  useEffect(load, []);

  async function handleArchive(unit: OrgUnit) {
    const { students } = rollUp(units ?? [], unit);
    const hasChildren = (units ?? []).some((u) => u.parentId === unit.id);
    const warning = hasChildren
      ? `Archive "${unit.name}" and everything inside it?`
      : `Archive "${unit.name}"?`;
    if (!confirm(students > 0 ? `${warning} ${students} student(s) are enrolled here.` : warning)) return;

    try {
      await api.delete(`/api/structure/units/${unit.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive.");
    }
  }

  if (!levels || !units) return null;

  const roots = units.filter((u) => !u.parentId);
  const parentIds = units.filter((u) => units.some((c) => c.parentId === u.id)).map((u) => u.id);
  const ladder = levels.map((l) => l.name).join(" › ") || "No levels defined";
  const allCollapsed = parentIds.length > 0 && parentIds.every((id) => collapsed.has(id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Structure</h1>
          <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", margin: "0 0 6px" }}>
            How your organization is arranged: <strong>{ladder}</strong>.{" "}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 13, padding: 0 }}
              onClick={() => setEditingLevels(true)}
            >
              Edit levels
            </button>
          </p>
        </div>
        {parentIds.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
            onClick={() => persistCollapsed(allCollapsed ? new Set() : new Set(parentIds))}
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        )}
      </div>

      <p style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", fontSize: 13, marginBottom: 22 }}>
        Students enrolled in a group also count towards everything above it, and a subject added to a
        group is taught to everything inside it.
      </p>

      {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginBottom: 18, display: "inline-flex", alignItems: "center", gap: 7 }}
        onClick={() => setAddingUnder(null)}
      >
        <PlusIcon size={15} /> Add {levels[0]?.name ?? "group"}
      </button>

      {roots.length === 0 ? (
        <div
          className="card"
          style={{ padding: 28, alignItems: "center", textAlign: "center", color: "var(--color-neutral-600)" }}
        >
          Nothing set up yet — add your first {levels[0]?.name?.toLowerCase() ?? "group"} to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {roots.map((root) => (
            <UnitNode
              key={root.id}
              unit={root}
              units={units}
              levels={levels}
              collapsed={collapsed}
              onToggle={toggle}
              onAddChild={setAddingUnder}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {addingUnder !== undefined && (
        <AddUnitModal
          parent={addingUnder}
          levels={levels}
          onClose={() => setAddingUnder(undefined)}
          onCreated={() => {
            setAddingUnder(undefined);
            load();
          }}
        />
      )}

      {editingLevels && (
        <EditLevelsModal
          levels={levels}
          onClose={() => setEditingLevels(false)}
          onSaved={() => {
            setEditingLevels(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function UnitNode({
  unit,
  units,
  levels,
  collapsed,
  onToggle,
  onAddChild,
  onArchive,
}: {
  unit: OrgUnit;
  units: OrgUnit[];
  levels: OrgLevel[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (u: OrgUnit) => void;
  onArchive: (u: OrgUnit) => void;
}) {
  const children = units.filter((u) => u.parentId === unit.id);
  const { students, courses } = rollUp(units, unit);
  const childLevel = levels.find((l) => l.depth === unit.depth + 1);
  const isOpen = children.length > 0 && !collapsed.has(unit.id);

  const childLabel = children.length
    ? `${children.length} ${(childLevel?.name ?? "group").toLowerCase()}${children.length === 1 ? "" : "s"}`
    : null;

  return (
    <div>
      <div className={`tree-row${unit.depth > 0 ? " tree-row-nested" : ""}`}>
        <button
          type="button"
          className={`tree-toggle${isOpen ? " tree-toggle-open" : ""}${children.length === 0 ? " tree-toggle-leaf" : ""}`}
          aria-label={isOpen ? `Collapse ${unit.name}` : `Expand ${unit.name}`}
          aria-expanded={children.length > 0 ? isOpen : undefined}
          onClick={() => onToggle(unit.id)}
        >
          <ChevronRightIcon size={15} />
        </button>

        <div className="tree-main">
          <Link to={`/dashboard/structure/${unit.id}`} className="tree-name">
            {unit.name}
          </Link>
          <span className="tree-meta">
            {students} student{students === 1 ? "" : "s"} · {courses} subject{courses === 1 ? "" : "s"}
            {/* Collapsing shouldn't hide that anything is in there. */}
            {childLabel && !isOpen ? ` · ${childLabel}` : ""}
          </span>
        </div>

        {unit.level && <span className="tree-level-pill">{unit.level.name}</span>}

        <div className="tree-actions">
          {childLevel && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => onAddChild(unit)}>
              Add {childLevel.name}
            </button>
          )}
          <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => onArchive(unit)}>
            Archive
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="tree-children">
          {children.map((child) => (
            <UnitNode
              key={child.id}
              unit={child}
              units={units}
              levels={levels}
              collapsed={collapsed}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onArchive={onArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddUnitModal({
  parent,
  levels,
  onClose,
  onCreated,
}: {
  parent: OrgUnit | null;
  levels: OrgLevel[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const depth = parent ? parent.depth + 1 : 0;
  const levelName = levels.find((l) => l.depth === depth)?.name ?? "Group";
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/structure/units", { name: name.trim(), parentId: parent?.id });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={parent ? `Add ${levelName} to ${parent.name}` : `Add ${levelName}`}
      onClose={onClose}
      actions={
        <button type="submit" form="add-unit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </button>
      }
    >
      <form id="add-unit" onSubmit={handleSubmit}>
        <FormField label={`${levelName} name`}>
          <TextInput autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
      </form>
    </Modal>
  );
}

function EditLevelsModal({
  levels,
  onClose,
  onSaved,
}: {
  levels: OrgLevel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [names, setNames] = useState<string[]>(levels.map((l) => l.name));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await api.put("/api/structure/levels", {
        levels: names.map((n) => n.trim()).filter(Boolean).map((name) => ({ name })),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Structure levels"
      onClose={onClose}
      actions={
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <p style={{ fontSize: 13, marginTop: 0, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
        Name each level from the outside in — a school might use Class then Section, a college Batch then
        Stream, a coaching center just Batch.
      </p>
      {names.map((name, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <FormField label={`Level ${i + 1}`}>
            <TextInput
              value={name}
              onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
            />
          </FormField>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 13, height: 36 }}
            onClick={() => setNames(names.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      {names.length < 6 && (
        <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setNames([...names, ""])}>
          Add a level
        </button>
      )}
    </Modal>
  );
}
