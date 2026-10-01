import type { OtpPurpose } from "@prisma/client";
import { prisma } from "../db.js";
import { sendConsentEmail, sendOtpEmail } from "../email/resend.js";
import { CONSENT_OTP_TTL_MS, OTP_TTL_MS, generateOtpCode, hashOtpCode } from "./otp.js";

/**
 * Stores a fresh code and only invalidates the previous one(s) after the
 * new code's email has actually been sent — `send` runs before the old
 * codes are touched, so a failed send (Resend down, bad API key) leaves
 * the user's still-working old code intact instead of locking them out
 * with neither the old code nor a delivered new one.
 *
 * Only codes with the same `purpose` are invalidated: logging in must not
 * silently cancel a guardian's pending consent code, and vice versa.
 */
async function issueCode(
  email: string,
  purpose: OtpPurpose,
  send: (code: string) => Promise<void>
): Promise<void> {
  const code = generateOtpCode();
  const ttl = purpose === "CONSENT" ? CONSENT_OTP_TTL_MS : OTP_TTL_MS;
  const created = await prisma.otpCode.create({
    data: {
      email,
      purpose,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + ttl),
    },
  });

  try {
    await send(code);
  } catch (error) {
    // The send failed — remove the code we just created rather than leaving
    // an OTP row nobody can ever redeem, and let the old code keep working.
    await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => {});
    throw error;
  }

  await prisma.otpCode.updateMany({
    where: { email, purpose, consumedAt: null, id: { not: created.id } },
    data: { consumedAt: new Date() },
  });
}

/** Issues a login code and emails it. */
export async function issueOtpForEmail(email: string): Promise<void> {
  await issueCode(email, "LOGIN", (code) => sendOtpEmail(email, code));
}

/**
 * Issues a code for a guardian to confirm consent (POST /api/consent/confirm).
 * `students` lists everyone this email is guardian for who is awaiting
 * confirmation — one code confirms them all, so the email names them all.
 */
export async function issueConsentOtpForEmail(
  guardianEmail: string,
  students: { name: string; instituteName: string }[]
): Promise<void> {
  await issueCode(guardianEmail, "CONSENT", (code) => sendConsentEmail(guardianEmail, code, students));
}
