import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { FormField, TextInput } from "../../components/FormField";
import { Modal } from "../../components/Modal";

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

export function StructurePage() {
  const [levels, setLevels] = useState<OrgLevel[] | null>(null);
  const [units, setUnits] = useState<OrgUnit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<OrgUnit | null | undefined>(undefined);
  const [editingLevels, setEditingLevels] = useState(false);

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
  const ladder = levels.map((l) => l.name).join(" › ") || "No levels defined";

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Structure</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 6 }}>
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
      <p style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)", fontSize: 13, marginBottom: 24 }}>
        Students enrolled in a group also count towards everything above it, and a subject added to a
        group is taught to everything inside it.
      </p>

      {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}

      <button type="button" className="btn btn-primary" style={{ marginBottom: 18 }} onClick={() => setAddingUnder(null)}>
        Add {levels[0]?.name ?? "group"}
      </button>

      {roots.length === 0 ? (
        <p style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          Nothing set up yet — add your first {levels[0]?.name?.toLowerCase() ?? "group"} to get started.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {roots.map((root) => (
            <UnitNode
              key={root.id}
              unit={root}
              units={units}
              levels={levels}
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
  onAddChild,
  onArchive,
}: {
  unit: OrgUnit;
  units: OrgUnit[];
  levels: OrgLevel[];
  onAddChild: (u: OrgUnit) => void;
  onArchive: (u: OrgUnit) => void;
}) {
  const children = units.filter((u) => u.parentId === unit.id);
  const { students, courses } = rollUp(units, unit);
  const childLevel = levels.find((l) => l.depth === unit.depth + 1);

  return (
    <div style={{ marginLeft: unit.depth === 0 ? 0 : 22 }}>
      <div
        className="card"
        style={{
          padding: "12px 16px",
          display: "flex",
          // .card is a column flex container by default; these rows need to run across.
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          borderLeft: unit.depth > 0 ? "3px solid var(--color-divider)" : undefined,
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <Link to={`/dashboard/structure/${unit.id}`} style={{ fontWeight: 600 }}>
            {unit.name}
          </Link>
          <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
            {unit.level?.name ?? `Level ${unit.depth + 1}`} · {students} student{students === 1 ? "" : "s"} ·{" "}
            {courses} subject{courses === 1 ? "" : "s"}
          </div>
        </div>
        {childLevel && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => onAddChild(unit)}>
            Add {childLevel.name}
          </button>
        )}
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => onArchive(unit)}>
          Archive
        </button>
      </div>

      {children.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {children.map((child) => (
            <UnitNode
              key={child.id}
              unit={child}
              units={units}
              levels={levels}
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
