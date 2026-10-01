import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useApiData } from "../../lib/useApiData";
import { AsyncState } from "../../components/AsyncState";
import { FormField, TextInput } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { LevelLadderEditor } from "../../components/LevelLadderEditor";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ORG_TEMPLATES } from "../../lib/orgTemplates";
import { useToast } from "../../components/ToastContext";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
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

interface StructureData {
  levels: OrgLevel[];
  units: OrgUnit[];
  /** For teachers: the groups where they teach a subject (null = no restriction). */
  teachingUnitIds: string[] | null;
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
  useDocumentTitle("Structure");
  const { identity } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";
  const showToast = useToast();

  const isTeacher = identity?.kind === "STAFF" && identity.role === "TEACHER";

  const { data, loading, error: loadError, reload } = useApiData<StructureData>(async () => {
    const [levels, units, courses] = await Promise.all([
      api.get<OrgLevel[]>("/api/structure/levels"),
      api.get<OrgUnit[]>("/api/structure/units"),
      // A teacher can only open the groups where they teach, so the tree is
      // trimmed to those (the API scopes /courses to the signed-in teacher).
      isTeacher ? api.get<{ orgUnit: { id: string } }[]>("/api/courses") : Promise.resolve(null),
    ]);
    return { levels, units, teachingUnitIds: courses ? [...new Set(courses.map((c) => c.orgUnit.id))] : null };
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<OrgUnit | null | undefined>(undefined);
  const [renameTarget, setRenameTarget] = useState<OrgUnit | null>(null);
  const [editingLevels, setEditingLevels] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<OrgUnit | null>(null);
  const [archiving, setArchiving] = useState(false);
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

  async function handleArchiveConfirmed() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const name = archiveTarget.name;
      await api.delete(`/api/structure/units/${archiveTarget.id}`);
      setArchiveTarget(null);
      reload();
      showToast(`${name} archived.`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not archive.");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <AsyncState loading={loading} error={loadError} data={data} onRetry={reload}>
      {({ levels, units: allUnits, teachingUnitIds }) => {
        // Teachers see only the groups they teach in (plus the parents above
        // them, for context). Everyone else sees the whole tree.
        const teachingPaths = teachingUnitIds
          ? allUnits.filter((u) => teachingUnitIds.includes(u.id)).map((u) => u.path)
          : null;
        const isOpenable = (u: OrgUnit) =>
          !teachingUnitIds || teachingUnitIds.some((t) => u.path.includes(`/${t}/`));
        const units = teachingPaths ? allUnits.filter((u) => isOpenable(u) || teachingPaths.some((p) => p.includes(`/${u.id}/`))) : allUnits;
        const roots = units.filter((u) => !u.parentId);
        const parentIds = units.filter((u) => units.some((c) => c.parentId === u.id)).map((u) => u.id);
        const ladder = levels.map((l) => l.name).join(" › ") || "No levels defined";
        const allCollapsed = parentIds.length > 0 && parentIds.every((id) => collapsed.has(id));
        const archiveRollup = archiveTarget ? rollUp(units, archiveTarget) : null;
        const archiveHasChildren = archiveTarget ? units.some((u) => u.parentId === archiveTarget.id) : false;

        return (
          <div>
            <PageHeader
              title="Structure"
              subtitle={
                <>
                  How your organization is arranged: <strong>{ladder}</strong>.
                </>
              }
              actions={
                <>
                  {parentIds.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => persistCollapsed(allCollapsed ? new Set() : new Set(parentIds))}
                    >
                      {allCollapsed ? "Expand all" : "Collapse all"}
                    </button>
                  )}
                  {isOwner && (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => setEditingLevels(true)}>
                        Edit levels
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => setAddingUnder(null)}>
                        <PlusIcon size={15} /> Add {levels[0]?.name ?? "group"}
                      </button>
                    </>
                  )}
                </>
              }
            />

            <p className="text-muted" style={{ fontSize: 13, margin: "0 0 18px" }}>
              {isTeacher
                ? "You're seeing the groups where you teach. "
                : !isOwner
                  ? "You can browse the structure; only the owner can change it. "
                  : ""}
              Students enrolled in a group also count towards everything above it, and a subject added to a group is taught to
              everything inside it.
            </p>

            {actionError && <p className="form-error" role="alert">{actionError}</p>}

            {roots.length === 0 ? (
              <EmptyState
                title={
                  isTeacher
                    ? "You haven't been assigned to teach in any group yet."
                    : isOwner
                      ? `Nothing set up yet. Add your first ${levels[0]?.name?.toLowerCase() ?? "group"} to get started.`
                      : "Nothing has been set up yet."
                }
                action={
                  isOwner && (
                    <button type="button" className="btn btn-primary" onClick={() => setAddingUnder(null)}>
                      <PlusIcon size={15} /> Add {levels[0]?.name ?? "group"}
                    </button>
                  )
                }
              />
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {roots.map((root) => (
                  <UnitNode
                    key={root.id}
                    unit={root}
                    units={units}
                    levels={levels}
                    collapsed={collapsed}
                    canManage={isOwner}
                    canOpen={isOpenable}
                    onToggle={toggle}
                    onAddChild={setAddingUnder}
                    onRename={setRenameTarget}
                    onArchive={setArchiveTarget}
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
                  reload();
                }}
              />
            )}

            {renameTarget && (
              <RenameUnitModal
                unit={renameTarget}
                levelName={renameTarget.level?.name ?? "Group"}
                onClose={() => setRenameTarget(null)}
                onRenamed={() => {
                  setRenameTarget(null);
                  reload();
                }}
              />
            )}

            {editingLevels && (
              <EditLevelsModal
                levels={levels}
                onClose={() => setEditingLevels(false)}
                onSaved={() => {
                  setEditingLevels(false);
                  reload();
                }}
              />
            )}

            {archiveTarget && (
              <ConfirmModal
                title={`Archive "${archiveTarget.name}"?`}
                confirmLabel="Archive"
                variant="danger"
                busy={archiving}
                onClose={() => setArchiveTarget(null)}
                onConfirm={handleArchiveConfirmed}
                body={
                  <>
                    {archiveHasChildren && <p style={{ margin: "0 0 8px" }}>This will also archive everything inside it.</p>}
                    {!archiveHasChildren && (!archiveRollup || archiveRollup.students === 0) && (
                      <p style={{ margin: 0 }}>It will disappear from the structure.</p>
                    )}
                    {archiveRollup && archiveRollup.students > 0 && (
                      <p style={{ margin: 0 }}>
                        {archiveRollup.students} student{archiveRollup.students === 1 ? "" : "s"} enrolled here will lose this group
                        from their record.
                      </p>
                    )}
                  </>
                }
              />
            )}
          </div>
        );
      }}
    </AsyncState>
  );
}

function UnitNode({
  unit,
  units,
  levels,
  collapsed,
  canManage,
  canOpen,
  onToggle,
  onAddChild,
  onRename,
  onArchive,
}: {
  unit: OrgUnit;
  units: OrgUnit[];
  levels: OrgLevel[];
  collapsed: Set<string>;
  canManage: boolean;
  /** False for groups the signed-in teacher has no access to (shown as plain text). */
  canOpen: (u: OrgUnit) => boolean;
  onToggle: (id: string) => void;
  onAddChild: (u: OrgUnit) => void;
  onRename: (u: OrgUnit) => void;
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
          {canOpen(unit) ? (
            <Link to={`/dashboard/structure/${unit.id}`} className="tree-name">
              {unit.name}
            </Link>
          ) : (
            <span className="tree-name">{unit.name}</span>
          )}
          <span className="tree-meta">
            {students} student{students === 1 ? "" : "s"} · {courses} subject{courses === 1 ? "" : "s"}
            {/* Collapsing shouldn't hide that anything is in there. */}
            {childLabel && !isOpen ? ` · ${childLabel}` : ""}
          </span>
        </div>

        {unit.level && <span className="tag tag-level">{unit.level.name}</span>}

        {canManage && (
          <div className="tree-actions">
            {childLevel && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Add ${childLevel.name} inside ${unit.name}`}
                onClick={() => onAddChild(unit)}
              >
                Add {childLevel.name}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Rename ${unit.name}`} onClick={() => onRename(unit)}>
              Rename
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-ghost-danger"
              aria-label={`Archive ${unit.name}`}
              onClick={() => onArchive(unit)}
            >
              Archive
            </button>
          </div>
        )}
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
              canManage={canManage}
              canOpen={canOpen}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onRename={onRename}
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
  const showToast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      const trimmed = name.trim();
      await api.post("/api/structure/units", { name: trimmed, parentId: parent?.id });
      onCreated();
      showToast(`${trimmed} added.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={parent ? `Add ${levelName} to ${parent.name}` : `Add ${levelName}`}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="add-unit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </button>
      }
    >
      <form id="add-unit" onSubmit={handleSubmit}>
        <FormField label={`${levelName} name`} required error={fields.name}>
          <TextInput autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function RenameUnitModal({
  unit,
  levelName,
  onClose,
  onRenamed,
}: {
  unit: OrgUnit;
  levelName: string;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const showToast = useToast();
  const [name, setName] = useState(unit.name);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trimmed === unit.name) return onClose();
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.patch(`/api/structure/units/${unit.id}`, { name: trimmed });
      onRenamed();
      showToast(`Renamed to ${trimmed}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Rename ${unit.name}`}
      onClose={onClose}
      busy={busy}
      actions={
        <button type="submit" form="rename-unit" className="btn btn-primary" disabled={busy || !trimmed || trimmed === unit.name}>
          {busy ? "Saving…" : "Rename"}
        </button>
      }
    >
      <form id="rename-unit" onSubmit={handleSubmit}>
        <FormField label={`${levelName} name`} required error={fields.name}>
          <TextInput autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
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
  const showToast = useToast();
  const [names, setNames] = useState<string[]>(levels.map((l) => l.name));
  const [templateHint, setTemplateHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/structure/levels", {
        levels: names.map((n) => n.trim()).filter(Boolean).map((name) => ({ name })),
      });
      onSaved();
      showToast("Levels saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save levels.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Structure levels"
      onClose={onClose}
      busy={busy}
      actions={
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Name each level from the outside in — insert, remove, or rename below, or start from a template.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="chips" style={{ marginBottom: 12 }}>
        {ORG_TEMPLATES.map((t) => (
          <button
            key={t.type}
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setNames(t.levels);
              setTemplateHint(t.description);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {templateHint && (
        <p className="sd-help" style={{ margin: "0 0 14px" }}>
          {templateHint}
        </p>
      )}

      <LevelLadderEditor
        levels={names}
        onChange={(next) => {
          setNames(next);
          setTemplateHint(null);
        }}
      />
    </Modal>
  );
}
