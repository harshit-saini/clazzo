import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { DataTable } from "../../components/DataTable";
import { FormField, TextInput } from "../../components/FormField";

interface Grade {
  id: string;
  name: string;
  createdAt: string;
}

export function GradesPage() {
  const [grades, setGrades] = useState<Grade[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Grade[]>("/api/grades").then(setGrades);
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/grades", { name: name.trim() });
      setName("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add grade.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/grades/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete grade.");
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Grades</h1>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, marginBottom: 20, maxWidth: 400 }}>
        <FormField label="">
          <TextInput
            placeholder='e.g. "Class 7"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FormField>
        <button type="submit" className="btn btn-primary" style={{ height: 36 }}>
          Add
        </button>
      </form>
      {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}

      {grades && (
        <DataTable
          rows={grades}
          rowKey={(g) => g.id}
          emptyMessage="No grades yet."
          columns={[
            { header: "Name", render: (g) => g.name },
            {
              header: "",
              render: (g) => (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }} onClick={() => handleDelete(g.id)}>
                  Delete
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
