import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.RESEND_FROM_EMAIL ?? "Clazzo <onboarding@resend.dev>";

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
    `,
  });
}

export async function sendStaffWelcomeEmail(to: string, name: string, instituteName: string) {
  await sendEmail({
    to,
    subject: `You've been added to ${instituteName} on Clazzo`,
    html: `
      <p>Hi ${name},</p>
      <p>You've been given staff access to ${instituteName} on Clazzo.</p>
      <p>To log in, enter your email (${to}) on the Clazzo login page — we'll send you a one-time code, no password needed.</p>
    `,
  });
}

export async function sendConsentEmail(to: string, code: string, studentName: string, instituteName: string) {
  await sendEmail({
    to,
    subject: `Confirm ${studentName}'s Clazzo access at ${instituteName}`,
    html: `
      <p>${instituteName} has invited ${studentName} to Clazzo, where they can check attendance, class schedule and fee status.</p>
      <p>Because you're listed as their guardian, we need your confirmation before this access goes live. Enter this code where prompted:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
      <p>This code expires in 10 minutes. If you weren't expecting this, you can ignore this email and the access will stay inactive.</p>
    `,
  });
}

export async function sendInviteEmail(to: string, studentName: string, instituteName: string) {
  await sendEmail({
    to,
    subject: `${instituteName} invited you to Clazzo`,
    html: `
      <p>Hi ${studentName},</p>
      <p>${instituteName} has set you up with access to Clazzo, where you can check your attendance, class schedule and fee status.</p>
      <p>To log in, just enter your email (${to}) on the Clazzo login page — we'll send you a one-time code, no password needed.</p>
    `,
  });
}
