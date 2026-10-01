import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError, api, fieldErrors } from "../lib/api";
import { useApiData } from "../lib/useApiData";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { FormField, TextInput } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/ToastContext";
import { CodeInput } from "../components/CodeInput";

interface Institute {
  id: string;
  name: string;
  type: string;
}

/** Account settings for both the staff dashboard and the student portal. */
export function SettingsPage() {
  useDocumentTitle("Settings");
  const { identity, refresh } = useAuth();
  const isOwner = identity?.kind === "STAFF" && identity.role === "OWNER";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your account details." />
      <div className="stack-lg" style={{ maxWidth: 520 }}>
        <ProfileCard onSaved={refresh} />
        <EmailCard onChanged={refresh} />
        {isOwner && <InstituteCard />}
      </div>
    </div>
  );
}

function ProfileCard({ onSaved }: { onSaved: () => Promise<void> }) {
  const { identity } = useAuth();
  const showToast = useToast();
  const [name, setName] = useState(identity?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.patch("/api/auth/me", { name });
      await onSaved();
      showToast("Name updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
      if (err instanceof ApiError) setFields(fieldErrors(err.issues));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-md" onSubmit={handleSubmit}>
      <h2 className="section-title">Your name</h2>
      <FormField label="Name" required error={fields.name}>
        <TextInput required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || name.trim() === identity?.name}>
          {busy ? "Saving…" : "Save name"}
        </button>
      </div>
    </form>
  );
}

function EmailCard({ onChanged }: { onChanged: () => Promise<void> }) {
  const { identity } = useAuth();
  const showToast = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/me/email/request", { newEmail: newEmail.trim().toLowerCase() });
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/me/email/confirm", { newEmail: newEmail.trim().toLowerCase(), code });
      await onChanged();
      showToast("Login email changed.");
      setStep("email");
      setNewEmail("");
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change your email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-md">
      <h2 className="section-title">Login email</h2>
      <p className="text-muted" style={{ margin: 0 }}>
        You log in with codes sent to <strong>{identity?.email}</strong>. To change it we'll send a code to the new
        address to make sure it's yours.
      </p>
      {step === "email" ? (
        <form onSubmit={requestCode}>
          <FormField label="New email address" required>
            <TextInput type="email" required autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </FormField>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm}>
          <p style={{ marginTop: 0 }}>
            We sent a 6-digit code to <strong>{newEmail}</strong>.
          </p>
          <FormField label="Code" required>
            <CodeInput value={code} onChange={setCode} />
          </FormField>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Confirm change"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("email")}>
              Use a different address
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function InstituteCard() {
  const showToast = useToast();
  const { data, reload } = useApiData<Institute>(() => api.get<Institute>("/api/institute"));
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = name ?? data?.name ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch("/api/institute", { name: current });
      reload();
      setName(null);
      showToast("Institute name updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card card-md" onSubmit={handleSubmit}>
      <h2 className="section-title">Your institute</h2>
      <p className="text-muted" style={{ margin: 0 }}>
        This name appears on invites and on the emails parents receive.
      </p>
      <FormField label="Institute name" required>
        <TextInput required autoComplete="organization" value={current} onChange={(e) => setName(e.target.value)} />
      </FormField>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || !data || current.trim() === data.name}>
          {busy ? "Saving…" : "Save name"}
        </button>
      </div>
    </form>
  );
}
