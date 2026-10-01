import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Clazzo <onboarding@resend.dev>";

// None of these emails used to link anywhere — they just said "enter your
// email on the Clazzo login page," leaving the recipient to find the app
// themselves. FRONTEND_ORIGIN may be a comma-separated list (see index.ts);
// the first entry is the canonical one to link to.
const frontendUrl = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")[0]
  .trim()
  .replace(/\/$/, "");

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Sends an email via Resend. If RESEND_API_KEY isn't configured (local dev
 * without a Resend account), logs the content instead of failing — so the
 * OTP/invite flows stay usable without real email credentials.
 */
async function sendEmail(options: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email:dev-fallback] RESEND_API_KEY not set — would have sent to ${options.to}:`);
    console.warn(`  Subject: ${options.subject}`);
    console.warn(`  ${options.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
    return;
  }

  const { error } = await resend.emails.send({ from: fromAddress, ...options });
  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }
}

export async function sendOtpEmail(to: string, code: string) {
  await sendEmail({
    to,
    subject: `${code} is your Clazzo login code`,
    html: `
      <p>Your Clazzo login code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      <p><a href="${frontendUrl}/login?email=${encodeURIComponent(to)}">Open Clazzo</a></p>
    `,
  });
}

export async function sendStaffWelcomeEmail(to: string, name: string, instituteName: string) {
  const loginUrl = `${frontendUrl}/login?email=${encodeURIComponent(to)}`;
  await sendEmail({
    to,
    subject: `You've been added to ${instituteName} on Clazzo`,
    html: `
      <p>Hi ${name},</p>
      <p>You've been given staff access to ${instituteName} on Clazzo.</p>
      <p>To log in, enter your email (${to}) on the Clazzo login page — we'll send you a one-time code, no password needed.</p>
      <p><a href="${loginUrl}">Log in to Clazzo</a></p>
    `,
  });
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendConsentEmail(
  to: string,
  code: string,
  students: { name: string; instituteName: string }[]
) {
  const confirmUrl = `${frontendUrl}/consent/confirm?email=${encodeURIComponent(to)}`;
  const list = students
    .map((s) => `<li><strong>${escapeHtml(s.name)}</strong> at ${escapeHtml(s.instituteName)}</li>`)
    .join("");
  const subject =
    students.length === 1
      ? `Confirm ${students[0].name}'s Clazzo access at ${students[0].instituteName}`
      : `Confirm your children's Clazzo access`;

  await sendEmail({
    to,
    subject,
    html: `
      <p>You're listed as the guardian for:</p>
      <ul>${list}</ul>
      <p>Their school or coaching centre has set up Clazzo access so the student can see their own attendance, class schedule and fee status. Because you're their guardian, we need your confirmation before that access goes live.</p>
      <p>Enter this code where prompted:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>The code works for 48 hours. If you weren't expecting this, ignore this email and the access stays switched off.</p>
      <p><a href="${confirmUrl}">Confirm access</a></p>
      <p style="font-size:12px;color:#555">You can withdraw consent at any time from the same page, and request a new code if this one expires. See our <a href="${frontendUrl}/privacy">privacy notice</a> for what is shared and with whom.</p>
    `,
  });
}

export async function sendInviteEmail(to: string, studentName: string, instituteName: string) {
  const loginUrl = `${frontendUrl}/login?email=${encodeURIComponent(to)}`;
  await sendEmail({
    to,
    subject: `${instituteName} invited you to Clazzo`,
    html: `
      <p>Hi ${studentName},</p>
      <p>${instituteName} has set you up with access to Clazzo, where you can check your attendance, class schedule and fee status.</p>
      <p>To log in, just enter your email (${to}) on the Clazzo login page — we'll send you a one-time code, no password needed.</p>
      <p><a href="${loginUrl}">Log in to Clazzo</a></p>
    `,
  });
}
