import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { FormField, Select, TextInput } from "../../components/FormField";
import { LevelLadderEditor } from "../../components/LevelLadderEditor";
import { ORG_TEMPLATES, templateFor, type OrgType } from "../../lib/orgTemplates";

type StructureMode = "template" | "later";

export function RegisterInstitutePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ instituteName: "", ownerName: "", email: "", type: "COACHING" as OrgType });
  const [structureMode, setStructureMode] = useState<StructureMode>("template");
  const [levels, setLevels] = useState<string[]>(templateFor(form.type).levels);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Changing what kind of organization this is changes what a sensible
  // structure looks like, so swap in that template's ladder. Any manual
  // customization of the previous type's ladder is intentionally discarded.
  useEffect(() => {
    setLevels(templateFor(form.type).levels);
  }, [form.type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const cleanLevels = levels.map((l) => l.trim()).filter(Boolean);
      await api.post("/api/auth/register", {
        ...form,
        email: form.email.trim().toLowerCase(),
        levels: structureMode === "later" ? [] : cleanLevels,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const template = templateFor(form.type);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: "min(460px, 100%)", padding: 36, gap: 18 }}>
        <span className="nav-brand">Clazzo</span>
        <h1 style={{ fontSize: 22, margin: 0 }}>Register your institute</h1>

        {done ? (
          <>
            <p style={{ fontSize: 14 }}>
              Check <strong>{form.email}</strong> for a login code to get started.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate("/login")}>
              Go to login
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <FormField label="What are you running?">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as OrgType })}>
                {ORG_TEMPLATES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.optionLabel}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Institute name">
              <TextInput
                required
                autoFocus
                value={form.instituteName}
                onChange={(e) => setForm({ ...form, instituteName: e.target.value })}
              />
            </FormField>
            <FormField label="Your name">
              <TextInput required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            </FormField>
            <FormField label="Email address">
              <TextInput type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>

            <div style={{ margin: "4px 0 18px" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>Your structure</label>
              <div className="seg" style={{ marginBottom: 14 }}>
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="structureMode"
                    checked={structureMode === "template"}
                    onChange={() => setStructureMode("template")}
                  />
                  Use a template
                </label>
                <label className="seg-opt">
                  <input
                    type="radio"
                    name="structureMode"
                    checked={structureMode === "later"}
                    onChange={() => setStructureMode("later")}
                  />
                  Decide later
                </label>
              </div>

              {structureMode === "template" ? (
                <>
                  <LevelLadderEditor levels={levels} onChange={setLevels} />
                  <p style={{ fontSize: 12.5, margin: "10px 0 0", color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                    {template.description} You can rename, insert, or remove levels above, and change everything
                    later from Structure in your dashboard.
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 12.5, margin: 0, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                  No problem — you can set this up anytime from Structure in your dashboard, either by hand or
                  by applying one of these templates.
                </p>
              )}
            </div>

            {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Creating…" : "Create institute"}
            </button>
          </form>
        )}

        <div style={{ fontSize: 13, textAlign: "center", marginTop: 4 }}>
          <Link to="/login">Already have an account? Log in</Link>
        </div>
      </div>
    </div>
  );
}
