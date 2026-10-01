import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError, fieldErrors } from "../../lib/api";
import { describeOtpError } from "../../lib/otpErrors";
import { useCooldown } from "../../lib/useCooldown";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { FormField, TextInput } from "../../components/FormField";
import { CodeInput } from "../../components/CodeInput";

interface LocationState {
  email?: string;
  /** Start on the code step: a code was already emailed (e.g. by signup). */
  step?: "code";
  /** Where the user was headed when they were sent here. */
  from?: string;
  reason?: "expired";
}

/** Only follow a return path that belongs to the kind of account that just logged in. */
function safeReturnPath(from: string | undefined, kind: "STAFF" | "STUDENT") {
  if (!from) return null;
  const prefix = kind === "STAFF" ? "/dashboard" : "/portal";
  return from === prefix || from.startsWith(`${prefix}/`) || from.startsWith(`${prefix}?`) ? from : null;
}

export function LoginPage() {
  useDocumentTitle("Log in");
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? {};
  const [searchParams] = useSearchParams();

  const initialEmail = state.email ?? searchParams.get("email") ?? "";
  const [step, setStep] = useState<"email" | "code">(state.step === "code" && initialEmail ? "code" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, startCooldown] = useCooldown();

  async function sendCode() {
    setError(null);
    setFields({});
    setNotice(null);
    setBusy(true);
    try {
      await requestOtp(email.trim().toLowerCase());
      setStep("code");
      setCode("");
      setNeedsNewCode(false);
      setNotice(`We sent a new code to ${email.trim().toLowerCase()}.`);
      startCooldown(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      if (err instanceof ApiError) {
        setFields(fieldErrors(err.issues));
        if (err.status === 429) startCooldown(60);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter all 6 digits of the code.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const identity = await verifyOtp(email.trim().toLowerCase(), code);
      navigate(safeReturnPath(state.from, identity.kind) ?? (identity.kind === "STAFF" ? "/dashboard" : "/portal"), {
        replace: true,
      });
    } catch (err) {
      const described = describeOtpError(err);
      setError(described.message);
      setNeedsNewCode(described.needsNewCode);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: "min(380px, 100%)", padding: 36, gap: 18 }}>
        <Link to="/" className="nav-brand" style={{ marginRight: 0 }}>
          Clazzo
        </Link>
        <h1 className="auth-title">Log in</h1>

        {state.reason === "expired" && (
          <div className="banner banner-warning" role="status">
            Your session ended — log in again to pick up where you left off.
          </div>
        )}

        <div aria-live="polite">
          {step === "email" ? (
            <form onSubmit={handleRequestCode}>
              <FormField label="Email address" required error={fields.email}>
                <TextInput
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </FormField>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy || cooldown > 0}>
                {busy ? "Sending…" : cooldown > 0 ? `Wait ${cooldown}s to resend` : "Send login code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              <p style={{ fontSize: 14, margin: "0 0 14px", color: "var(--color-text-muted)" }}>
                We sent a 6-digit code to <strong>{email}</strong>. It works for 10 minutes.
              </p>
              {notice && <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>{notice}</p>}
              <FormField label="Code" required>
                <CodeInput autoFocus value={code} onChange={setCode} />
              </FormField>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : "Verify & log in"}
              </button>
              <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${needsNewCode ? "btn-primary" : "btn-ghost"}`}
                  onClick={sendCode}
                  disabled={busy || cooldown > 0}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setStep("email"); setError(null); setNotice(null); }}>
                  Use a different email
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ fontSize: 13, textAlign: "center", marginTop: 4 }}>
          <Link to="/register">Register your institute</Link> · <Link to="/student/signup">Student sign up</Link>
        </div>
      </div>
    </div>
  );
}
