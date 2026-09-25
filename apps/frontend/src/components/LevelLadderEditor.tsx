import { useState } from "react";
import { PlusIcon, XIcon } from "../icons";

interface LevelLadderEditorProps {
  levels: string[];
  onChange: (levels: string[]) => void;
  maxLevels?: number;
}

/// An editable, tree-like ladder of level names (e.g. Center > Class >
/// Section) — the shape is always linear (each level has exactly one
/// child level), so this renders as a connected vertical chain rather than
/// a branching tree. Supports renaming in place, removing a level, and
/// inserting a new one at any position, including before the first or
/// after the last.
export function LevelLadderEditor({ levels, onChange, maxLevels = 6 }: LevelLadderEditorProps) {
  // Index in `levels` a new entry would be spliced into (0..levels.length),
  // or null when no inserter is open. Only one insert slot is ever open at
  // a time, which keeps the state simple regardless of ladder length.
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const atCap = levels.length >= maxLevels;

  function openInsert(at: number) {
    setInsertAt(at);
    setDraft("");
  }
  function cancelInsert() {
    setInsertAt(null);
    setDraft("");
  }
  function commitInsert() {
    const name = draft.trim();
    if (name && insertAt !== null) {
      const next = [...levels];
      next.splice(insertAt, 0, name);
      onChange(next);
    }
    cancelInsert();
  }
  function rename(i: number, name: string) {
    onChange(levels.map((l, j) => (j === i ? name : l)));
  }
  function remove(i: number) {
    onChange(levels.filter((_, j) => j !== i));
    if (insertAt !== null && insertAt > i) setInsertAt(insertAt - 1);
  }

  return (
    <div className="ladder">
      {!atCap && (
        <InsertSlot
          active={insertAt === 0}
          draft={draft}
          onDraftChange={setDraft}
          onOpen={() => openInsert(0)}
          onCommit={commitInsert}
          onCancel={cancelInsert}
        />
      )}

      {levels.map((name, i) => (
        <div key={i} className="ladder-item">
          <div className="ladder-node">
            <span className="ladder-index">{i + 1}</span>
            <input
              className="ladder-input"
              value={name}
              placeholder="Level name"
              onChange={(e) => rename(i, e.target.value)}
              aria-label={`Level ${i + 1} name`}
            />
            <button
              type="button"
              className="ladder-remove"
              aria-label={`Remove ${name || "this level"}`}
              onClick={() => remove(i)}
            >
              <XIcon size={13} />
            </button>
          </div>

          {!atCap && (
            <InsertSlot
              active={insertAt === i + 1}
              draft={draft}
              onDraftChange={setDraft}
              onOpen={() => openInsert(i + 1)}
              onCommit={commitInsert}
              onCancel={cancelInsert}
            />
          )}
        </div>
      ))}

      {levels.length === 0 && (
        <p className="ladder-empty">No levels yet — add one above, or leave this for later.</p>
      )}
      {atCap && <p className="ladder-empty">Maximum {maxLevels} levels.</p>}
    </div>
  );
}

function InsertSlot({
  active,
  draft,
  onDraftChange,
  onOpen,
  onCommit,
  onCancel,
}: {
  active: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onOpen: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  if (active) {
    // A <form> here would nest inside the registration page's own <form>,
    // which is invalid HTML — a click on this "Add" button would submit
    // the outer form instead of this insert. Plain handlers + Enter/Escape
    // on the input avoid that entirely.
    return (
      <div className="ladder-insert ladder-insert-open">
        <input
          autoFocus
          placeholder="Level name"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <button type="button" className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={onCommit}>
          Add
        </button>
        <button type="button" className="btn btn-ghost" style={{ padding: "4px 6px", fontSize: 12 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button type="button" className="ladder-insert" onClick={onOpen}>
      <PlusIcon size={11} /> Add a level here
    </button>
  );
}
