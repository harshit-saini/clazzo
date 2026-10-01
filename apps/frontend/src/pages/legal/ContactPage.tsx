import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "../../data";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { LegalLayout } from "./LegalLayout";

export function ContactPage() {
  useDocumentTitle("Contact");

  return (
    <LegalLayout>
      <h1>Contact us</h1>
      <p>Questions, feedback, or a request about your information? Email us and we will get back to you.</p>
      <p>
        <a className="btn btn-primary btn-lg" href={`mailto:${SUPPORT_EMAIL}`}>
          Email {SUPPORT_EMAIL}
        </a>
      </p>

      <h2>What to include</h2>
      <ul>
        <li>The email address you use to log in to Clazzo.</li>
        <li>The name of the institute, if your question is about one.</li>
        <li>For a correction or deletion request, which record you mean and what you would like changed.</li>
      </ul>

      <h2>Guardians</h2>
      <p>
        To approve or withdraw a child&rsquo;s access you do not need to contact us: use the{" "}
        <Link to="/consent/confirm">consent page</Link>, or{" "}
        <Link to="/consent/confirm?mode=withdraw">withdraw consent</Link> directly.
      </p>

      <h2>More</h2>
      <p>
        Read the <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalLayout>
  );
}
