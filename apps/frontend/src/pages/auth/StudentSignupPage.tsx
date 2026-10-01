import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { FormField, TextInput } from "../../components/FormField";
import { Steps } from "../../components/Steps";

export function StudentSignupPage() {
  useDocumentTitle("Student sign up");
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", isMinor: false, guardianEmail: "" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    setAlreadyRegistered(false);
    setBusy(true);
    try {
      await api.post("/api/auth/student/signup", {
        name: form.name,
        email: form.email.trim().toLowerCase(),
        isMinor: form.isMinor,
        ...(form.isMinor ? { guardianEmail: form.guardianEmail.trim().toLowerCase() } : {}),
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

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: "min(400px, 100%)", padding: 36, gap: 18 }}>
        <Link to="/" className="nav-brand" style={{ marginRight: 0 }}>
          Clazzo
        </Link>
        <Steps steps={["Create account", "Enter code", "See your classes"]} current={done ? 1 : 0} />
        <h1 className="auth-title">Student sign up</h1>
        <p style={{ fontSize: 14, margin: 0, color: "var(--color-text-muted)" }}>
          Create your account, then ask your school or coaching centre to add you — everything they enrol you in will
          show up here automatically.
        </p>

        <div aria-live="polite">
          {done ? (
            <>
              <p style={{ fontSize: 14 }}>
                We sent a login code to <strong>{form.email}</strong>.
                {form.isMinor && (
                  <>
                    {" "}
                    Because you're under 18, your school will also need <strong>{form.guardianEmail}</strong> to confirm
                    your access.
                  </>
                )}
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
              <FormField label="Your name" required error={fields.name}>
                <TextInput required autoFocus autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, marginBottom: 14, minHeight: 44 }}>
                <input
                  type="checkbox"
                  checked={form.isMinor}
                  onChange={(e) => setForm({ ...form, isMinor: e.target.checked })}
                  style={{ width: 20, height: 20 }}
                />
                I'm under 18
              </label>

              {form.isMinor && (
                <FormField label="Parent or guardian's email" required error={fields.guardianEmail}>
                  <TextInput
                    type="email"
                    required
                    value={form.guardianEmail}
                    onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
                  />
                </FormField>
              )}
              {form.isMinor && (
                <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6 }}>
                  We'll ask them to approve your access before any school can show you your attendance and fees.{" "}
                  <Link to="/privacy">How we handle this</Link>
                </p>
              )}

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
                {busy ? "Creating…" : "Create account"}
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
