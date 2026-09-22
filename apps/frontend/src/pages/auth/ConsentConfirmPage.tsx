import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { FormField, TextInput } from "../../components/FormField";

export function ConsentConfirmPage() {
  const [form, setForm] = useState({ email: "", code: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { confirmed } = await api.post<{ confirmed: unknown[] }>("/api/consent/confirm", {
        email: form.email.trim().toLowerCase(),
        code: form.code.trim(),
      });
      setConfirmedCount(confirmed.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: 380, padding: 36, gap: 18 }}>
        <span className="nav-brand">Clazzo</span>
        <h1 style={{ fontSize: 22, margin: 0 }}>Confirm guardian consent</h1>
        <p style={{ fontSize: 14, margin: 0, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
          Enter the code from the email you received to activate your child's Clazzo access.
        </p>

        {confirmedCount !== null ? (
          <p style={{ fontSize: 14 }}>Access confirmed for {confirmedCount} student{confirmedCount === 1 ? "" : "s"}.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <FormField label="Your email">
              <TextInput
                type="email"
                required
                autoFocus
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormField>
            <FormField label="Code">
              <TextInput
                inputMode="numeric"
                maxLength={6}
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="123456"
              />
            </FormField>
            {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Confirming…" : "Confirm"}
            </button>
          </form>
        )}

        <div style={{ fontSize: 13, textAlign: "center", marginTop: 4 }}>
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
