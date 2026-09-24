import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

interface Membership {
  institute: { id: string; name: string; type: string };
  groups: { id: string; name: string }[];
  activeCourseCount: number;
  consentStatus: "NOT_REQUIRED" | "PENDING" | "CONFIRMED";
}

export function PortalHome() {
  const [memberships, setMemberships] = useState<Membership[] | null>(null);

  useEffect(() => {
    api.get<Membership[]>("/api/student/institutes").then(setMemberships);
  }, []);

  if (!memberships) return null;

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>My institutes</h1>
      <p style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginBottom: 24 }}>
        Every school and coaching center you're enrolled in.
      </p>

      {memberships.length === 0 && (
        <p>You're not enrolled anywhere yet — ask your school or coaching center to add you by this email.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {memberships.map((m) => (
          <Link
            key={m.institute.id}
            to={m.consentStatus === "PENDING" ? "#" : `/portal/institutes/${m.institute.id}`}
            className="card elev-sm"
            style={{ padding: 22, gap: 8, textDecoration: "none", color: "inherit", cursor: m.consentStatus === "PENDING" ? "default" : "pointer" }}
          >
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>{m.institute.name}</div>
            {m.groups.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {m.groups.map((g) => (
                  <span key={g.id} className="tag tag-accent">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
            {m.consentStatus === "PENDING" ? (
              <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--color-accent-700)" }}>
                Waiting on your guardian to confirm access
              </p>
            ) : (
              <p style={{ fontSize: 13, margin: "8px 0 0", color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
                {m.activeCourseCount} subject{m.activeCourseCount === 1 ? "" : "s"}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
