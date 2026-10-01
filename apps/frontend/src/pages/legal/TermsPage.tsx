import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "../../data";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { LegalLayout } from "./LegalLayout";

/** DRAFT terms. Must be reviewed by a lawyer before launch (see banner). */
export function TermsPage() {
  useDocumentTitle("Terms of Service");

  return (
    <LegalLayout draft>
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated: 1 October 2026 (draft)</p>

      <p>
        These terms cover your use of Clazzo, a service for schools, colleges, coaching centres and tutors to manage attendance, fees and a
        student portal. By creating an account or logging in, you agree to them. Please read them alongside our{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. Who can use Clazzo</h2>
      <ul>
        <li>
          <strong>Institutes</strong> register an account and invite their own staff. The person who registers confirms they are authorised
          to act for the institute.
        </li>
        <li>
          <strong>Students</strong> can sign up with their email address and see the institutes that have added them. Students under 18
          need a parent or guardian&rsquo;s confirmation before they can see an institute&rsquo;s information.
        </li>
        <li>
          <strong>Guardians</strong> use the consent page to confirm or withdraw access for a child.
        </li>
      </ul>

      <h2>2. Institute responsibilities</h2>
      <p>If you run an institute on Clazzo, you are responsible for:</p>
      <ul>
        <li>having the right to collect and enter the student and guardian information you add, and keeping it accurate;</li>
        <li>giving staff access only to the roles they need, and removing staff who leave;</li>
        <li>telling students and guardians how your institute uses their information;</li>
        <li>responding to requests from students and guardians about records your institute holds.</li>
      </ul>

      <h2>3. Your account</h2>
      <p>
        Logins use a one-time code sent to your email address. Keep your email account secure and do not share codes. You are responsible
        for activity under your login.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        Do not use Clazzo to break the law, to access data that is not yours, to send unwanted messages, to interfere with the service, or to
        enter information you do not have the right to share.
      </p>

      <h2>5. Fees and payments</h2>
      <p>
        Clazzo is currently free during early access. We may introduce paid plans later and will give notice before any charge applies.
        Clazzo records invoices and payments that an institute enters; it does not collect or transfer money between students and
        institutes, and is not responsible for fee disputes between them.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        Clazzo is an early-access service. It is provided &ldquo;as is&rdquo;, and features may change, be unavailable at times, or be
        removed. Please keep your own copies of anything critical. [Liability and warranty wording to be completed in legal review.]
      </p>

      <h2>7. Ending your use</h2>
      <p>
        You can stop using Clazzo at any time and may ask us to close an account or delete information (see the Privacy Policy). We may
        suspend access that breaks these terms or puts others at risk.
      </p>

      <h2>8. Governing law</h2>
      <p>[Governing law and jurisdiction to be added in legal review.]</p>

      <h2>9. Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or the <Link to="/contact">contact page</Link>.
      </p>
    </LegalLayout>
  );
}
