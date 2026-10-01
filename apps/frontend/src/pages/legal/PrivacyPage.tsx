import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "../../data";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { LegalLayout } from "./LegalLayout";

/** DRAFT policy text. Must be reviewed by a lawyer before launch (see banner). */
export function PrivacyPage() {
  useDocumentTitle("Privacy Policy");

  return (
    <LegalLayout draft>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: 1 October 2026 (draft)</p>

      <p>
        Clazzo is a tool that schools, colleges, coaching centres and tutors (&ldquo;institutes&rdquo;) use to manage attendance, fees and a
        student portal. This page explains what information the service handles, who can see it, and what choices you have. Many of the
        people whose information is held are children, so we have tried to be specific.
      </p>

      <h2>1. What we collect</h2>
      <p>The information depends on who you are.</p>
      <ul>
        <li>
          <strong>Institute staff</strong> (owners, teachers, accountants): name, email address, role, and a record of important actions
          taken in the account (for example marking attendance or recording a payment).
        </li>
        <li>
          <strong>Students</strong>, as entered by an institute or by the student: name, email address, phone number, the groups and
          subjects they are enrolled in, attendance for each class (present, absent, late or excused), fee invoices and the payments
          recorded against them.
        </li>
        <li>
          <strong>Parents and guardians</strong>, as entered by the institute or the student: name, phone number and email address, and
          whether consent for the student&rsquo;s portal access has been given or withdrawn, and when.
        </li>
        <li>
          <strong>Technical data</strong>: one-time login and consent codes, and a login session token stored in your browser so you stay
          signed in.
        </li>
      </ul>
      <p>
        We do not ask for payment card or bank details. Clazzo does not process fee payments; institutes record the payments they receive.
      </p>

      <h2>2. Who can see it</h2>
      <ul>
        <li>
          <strong>Institute staff</strong>, according to their role. Broadly, an owner can see everything in their institute, teachers see
          the classes and attendance they work with, and accountants see fees. Staff of one institute cannot see another
          institute&rsquo;s records.
        </li>
        <li>
          <strong>Students</strong> see their own classes, attendance and fees, across every institute that has added their email address.
        </li>
        <li>
          <strong>Guardians</strong> do not have an account. They can confirm or withdraw consent using a code sent to their email address.
        </li>
        <li>
          <strong>Clazzo</strong> operates the service and may access data to keep it running, fix problems and respond to your requests.
          We do not sell personal information or use it for advertising.
        </li>
      </ul>

      <h2>3. Guardian consent for students under 18</h2>
      <p>
        When an institute adds a student with a guardian&rsquo;s email address, the guardian receives an email with a six-digit code. Until
        the guardian confirms it, the student cannot see the institute&rsquo;s information in their portal.
      </p>
      <ul>
        <li>The code is valid for 48 hours. A guardian can request a new one at any time on the consent page.</li>
        <li>
          A guardian can withdraw consent at any time at{" "}
          <Link to="/consent/confirm?mode=withdraw">/consent/confirm?mode=withdraw</Link>. After withdrawal the student can no longer see
          that institute in their portal until a guardian confirms again.
        </li>
        <li>
          Withdrawing portal access does not by itself delete records the institute keeps for its own administration. To ask for deletion,
          see section 5.
        </li>
      </ul>

      <h2>4. Children</h2>
      <p>
        Students under 18 can use Clazzo only through an institute, and with a guardian&rsquo;s confirmation. We aim to handle children&rsquo;s
        data in line with applicable law, including India&rsquo;s Digital Personal Data Protection Act, 2023. We do not use children&rsquo;s
        information for advertising or behavioural tracking.
      </p>

      <h2>5. Keeping and deleting information</h2>
      <p>
        Institutes decide what student information to enter and how long to keep it. Records stay in the account until the institute removes
        them or the account is closed. [Retention periods and account-closure handling to be confirmed in legal review.]
      </p>
      <p>
        To ask for your information to be corrected, exported or deleted, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on the account. For a student&rsquo;s record, the institute
        may need to be involved, because it is responsible for that record.
      </p>

      <h2>6. Service providers</h2>
      <p>
        We use <strong>Resend</strong> (resend.com) to send emails: login codes, guardian consent codes and invitations. Resend receives the
        recipient&rsquo;s email address and the content of the message, and acts as a processor on our behalf. We also use hosting and
        database providers to run the service. [Hosting provider names and data location to be added before launch.]
      </p>

      <h2>7. Security</h2>
      <p>
        Logins use one-time codes sent to your email, so there is no password to leak. We take reasonable steps to protect information, but
        no system is perfectly secure. Please tell us straight away if you think an account has been misused.
      </p>

      <h2>8. Changes and contact</h2>
      <p>
        If we change this policy in a meaningful way we will update the date above and, where we can, tell institutes by email. Questions or
        requests: <Link to="/contact">contact us</Link>.
      </p>
    </LegalLayout>
  );
}
