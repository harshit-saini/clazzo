import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { FormField, TextInput } from "../../components/FormField";

export function RegisterInstitutePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ instituteName: "", ownerName: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/register", { ...form, email: form.email.trim().toLowerCase() });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: "min(400px, 100%)", padding: 36, gap: 18 }}>
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
