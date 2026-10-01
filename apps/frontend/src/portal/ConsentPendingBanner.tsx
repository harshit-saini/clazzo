/** Shown instead of empty states/errors when a guardian hasn't confirmed (or has withdrawn) access to an institute. */
export function ConsentPendingBanner({ revoked, maskedEmail }: { revoked: boolean; maskedEmail?: string | null }) {
  return (
    <div className="banner banner-warning" role="status" style={{ marginBottom: 20, flexDirection: "column", gap: 4 }}>
      <strong>{revoked ? "Your guardian has withdrawn access" : "Waiting for your guardian to confirm"}</strong>
      <span>
        {revoked
          ? "Classes, attendance and fees at this institute are hidden until a guardian confirms again."
          : "Classes, attendance and fees will appear here as soon as a guardian confirms."}
        {maskedEmail ? ` We emailed a code to ${maskedEmail}.` : ""} Ask them to check their inbox, or ask the school to resend the code.
      </span>
    </div>
  );
}
