import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../lib/api";
import { FormField, TextInput } from "../../components/FormField";

export function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestOtp(email.trim().toLowerCase());
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const identity = await verifyOtp(email.trim().toLowerCase(), code.trim());
      navigate(identity.kind === "STAFF" ? "/dashboard" : "/portal", { replace: true });
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
        <h1 style={{ fontSize: 22, margin: 0 }}>Log in</h1>

        {step === "email" ? (
          <form onSubmit={handleRequestCode}>
            <FormField label="Email address">
              <TextInput
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </FormField>
            {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Sending…" : "Send login code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={{ fontSize: 14, margin: "0 0 14px", color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
              We sent a 6-digit code to <strong>{email}</strong>.
            </p>
            <FormField label="Code">
              <TextInput
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </FormField>
            {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Verifying…" : "Verify & log in"}
            </button>
            <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setStep("email")}>
              Use a different email
            </button>
          </form>
        )}

        <div style={{ fontSize: 13, textAlign: "center", marginTop: 4 }}>
          <Link to="/register">Register your institute</Link> ·{" "}
          <Link to="/student/signup">Student sign up</Link>
        </div>
      </div>
    </div>
  );
}
