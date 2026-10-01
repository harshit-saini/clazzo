import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError, fieldErrors } from "../../lib/api";
import { describeOtpError } from "../../lib/otpErrors";
import { useCooldown } from "../../lib/useCooldown";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { FormField, TextInput } from "../../components/FormField";
import { CodeInput } from "../../components/CodeInput";
import { Steps } from "../../components/Steps";

type Mode = "confirm" | "withdraw";

interface Child {
  studentName: string;
  instituteName: string;
}

/**
 * The guardian's page. They have no account, so a code sent to their email is
 * their proof of identity — for approving a child's access, and for
 * withdrawing it again later. The code works for 48 hours and can be
 * re-requested here at any time.
 */
export function ConsentConfirmPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "withdraw" ? "withdraw" : "confirm");
  useDocumentTitle(mode === "confirm" ? "Confirm guardian consent" : "Withdraw consent");

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  // Arriving from the emailed link means a code is already in their inbox.
  const [codeSent, setCodeSent] = useState(Boolean(searchParams.get("email")));
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Child[] | null>(null);
  const [cooldown, startCooldown] = useCooldown();

  async function sendCode() {
    setError(null);
    setFields({});
    setBusy(true);
    try {
      await api.post("/api/consent/request", { email: email.trim().toLowerCase() });
      setCodeSent(true);
      setCode("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter all 6 digits of the code.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = { email: email.trim().toLowerCase(), code };
      if (mode === "confirm") {
        const { confirmed } = await api.post<{ confirmed: Child[] }>("/api/consent/confirm", body);
        setResult(confirmed);
      } else {
        const { revoked } = await api.post<{ revoked: Child[] }>("/api/consent/revoke", body);
        setResult(revoked);
      }
    } catch (err) {
      setError(describeOtpError(err).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Get a code", mode === "confirm" ? "Confirm" : "Withdraw", "Done"];

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card elev-md" style={{ width: "min(420px, 100%)", padding: 36, gap: 18 }}>
        <Link to="/" className="nav-brand" style={{ marginRight: 0 }}>
          Clazzo
        </Link>
        <Steps steps={steps} current={result ? 2 : codeSent ? 1 : 0} />
        <h1 className="auth-title">{mode === "confirm" ? "Confirm guardian consent" : "Withdraw consent"}</h1>

        <div aria-live="polite">
          {result ? (
            <>
              {mode === "confirm" ? (
                <>
                  <p style={{ marginTop: 0 }}>Thank you — access is now switched on for:</p>
                  <ul style={{ paddingLeft: 20 }}>
                    {result.map((c, i) => (
                      <li key={i}>
                        <strong>{c.studentName}</strong> at {c.instituteName}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    The student can now log in with their own email to see their attendance, class schedule and fees. You
                    can withdraw this at any time from this page.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0 }}>Access has been switched off for:</p>
                  <ul style={{ paddingLeft: 20 }}>
                    {result.map((c, i) => (
                      <li key={i}>
                        <strong>{c.studentName}</strong> at {c.instituteName}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    The school still keeps its own records. You can switch access back on any time from this page.
                  </p>
                </>
              )}
              <Link to="/" className="btn btn-secondary btn-block">
                Back to Clazzo
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ fontSize: 14, marginTop: 0, color: "var(--color-text-muted)" }}>
                {mode === "confirm"
                  ? "Your child's school or coaching centre has set up Clazzo so they can see their own attendance, schedule and fees. We need your approval first."
                  : "Enter the email the school has for you and we'll send a code to prove it's you."}
              </p>

              <FormField label="Your email" required error={fields.email}>
                <TextInput
                  type="email"
                  required
                  autoFocus={!email}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setCodeSent(false);
                  }}
                />
              </FormField>

              {!codeSent ? (
                <button type="button" className="btn btn-secondary btn-block" onClick={sendCode} disabled={busy || cooldown > 0 || !email}>
                  {busy ? "Sending…" : cooldown > 0 ? `Wait ${cooldown}s` : "Email me a code"}
                </button>
              ) : (
                <>
                  <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
                    If that email is on file, a code is on its way. It works for 48 hours.
                  </p>
                  <FormField label="Code" required>
                    <CodeInput autoFocus value={code} onChange={setCode} />
                  </FormField>
                </>
              )}

              {error && <p className="form-error" role="alert">{error}</p>}

              {codeSent && (
                <>
                  <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
                    {busy ? "Checking…" : mode === "confirm" ? "Confirm access" : "Withdraw consent"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={sendCode} disabled={busy || cooldown > 0}>
                    {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send me a new code"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>

        {!result && (
          <div style={{ fontSize: 13, textAlign: "center" }}>
            {mode === "confirm" ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode("withdraw"); setCodeSent(false); setError(null); }}>
                Withdraw a previous consent
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode("confirm"); setCodeSent(false); setError(null); }}>
                Confirm access instead
              </button>
            )}
            <div style={{ marginTop: 8 }}>
              <Link to="/privacy">What we collect and who sees it</Link>
            </div>
            <div className="text-muted" style={{ marginTop: 8 }}>
              Students log in <Link to="/login">here</Link>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
