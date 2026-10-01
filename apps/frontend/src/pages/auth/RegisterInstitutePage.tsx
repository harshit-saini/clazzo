import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { FormField, Select, TextInput } from "../../components/FormField";
import { LevelLadderEditor } from "../../components/LevelLadderEditor";
import { ORG_TEMPLATES, templateFor, type OrgType } from "../../lib/orgTemplates";

export function RegisterInstitutePage() {
  useDocumentTitle("Register your institute");
  const navigate = useNavigate();
  const [form, setForm] = useState({ instituteName: "", ownerName: "", email: "", type: "COACHING" as OrgType });
  // Registration only asks for what's needed to create the account. The
  // structure starts as the chosen type's standard layout; editing it here
  // is optional (and everything can be changed later from Structure).
  const [customising, setCustomising] = useState(false);
  const [levels, setLevels] = useState<string[]>(templateFor(form.type).levels);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Changing what kind of organization this is changes what a sensible
  // structure looks like, so swap in that template's ladder. Any manual
  // customization of the previous type's ladder is intentionally discarded.
  useEffect(() => {
    setLevels(templateFor(form.type).levels);
    setCustomising(false);
  }, [form.type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setAlreadyRegistered(false);
    setBusy(true);
    try {
      await api.post("/api/auth/register", {
        ...form,
        email: form.email.trim().toLowerCase(),
        // Omit `levels` unless the user edited them: the backend then applies
        // the type's standard template itself.
        ...(customising ? { levels: levels.map((l) => l.trim()).filter(Boolean) } : {}),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      if (err instanceof ApiError) {
        setFields(fieldErrors(err.issues));
        setAlreadyRegistered(err.status === 409);
      }
    } finally {
      setBusy(false);
    }
  }

  const template = templateFor(form.type);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: "min(460px, 100%)", padding: 36, gap: 18 }}>
        <Link to="/" className="nav-brand" style={{ marginRight: 0 }}>
          Clazzo
        </Link>
        <h1 className="auth-title">Register your institute</h1>

        <div aria-live="polite">
          {done ? (
            <>
              <p style={{ fontSize: 14 }}>
                We sent a login code to <strong>{form.email}</strong>. Enter it on the next screen to get started.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => navigate("/login", { state: { email: form.email, step: "code" } })}
              >
                Enter my code
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
              <FormField label="Institute name" required error={fields.instituteName}>
                <TextInput
                  required
                  autoFocus
                  autoComplete="organization"
                  value={form.instituteName}
                  onChange={(e) => setForm({ ...form, instituteName: e.target.value })}
                />
              </FormField>
              <FormField label="Your name" required error={fields.ownerName}>
                <TextInput required autoComplete="name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </FormField>
              <FormField label="Email address" required error={fields.email}>
                <TextInput
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>

              <div style={{ margin: "4px 0 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>How your institute is organised</div>
                {customising ? (
                  <LevelLadderEditor levels={levels} onChange={setLevels} />
                ) : (
                  <p style={{ margin: 0, fontSize: 14 }}>
                    <strong>{template.levels.join(" › ")}</strong>{" "}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomising(true)}>
                      Customise
                    </button>
                  </p>
                )}
                <p style={{ fontSize: 12.5, margin: "10px 0 0", color: "var(--color-text-muted)" }}>
                  {template.description} You can change all of this later from Structure in your dashboard.
                </p>
              </div>

              {error && (
                <p className="form-error" role="alert">
                  {error}{" "}
                  {alreadyRegistered && (
                    <Link to="/login" state={{ email: form.email }}>
                      Log in instead
                    </Link>
                  )}
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? "Creating…" : "Create institute"}
              </button>
            </form>
          )}
        </div>

        <div style={{ fontSize: 13, textAlign: "center", marginTop: 4 }}>
          <Link to="/login">Already have an account? Log in</Link>
        </div>
      </div>
    </div>
  );
}
