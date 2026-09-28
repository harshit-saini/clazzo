import { prisma } from "../db.js";
import { sendConsentEmail, sendOtpEmail } from "../email/resend.js";
import { OTP_TTL_MS, generateOtpCode, hashOtpCode } from "./otp.js";

/**
 * Stores a fresh code and only invalidates the previous one(s) after the
 * new code's email has actually been sent — `send` runs before the old
 * codes are touched, so a failed send (Resend down, bad API key) leaves
 * the user's still-working old code intact instead of locking them out
 * with neither the old code nor a delivered new one.
 */
async function issueCode(email: string, send: (code: string) => Promise<void>): Promise<void> {
  const code = generateOtpCode();
  const created = await prisma.otpCode.create({
    data: {
      email,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
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
    where: { email, consumedAt: null, id: { not: created.id } },
    data: { consumedAt: new Date() },
  });
}

/** Issues a login code and emails it. */
export async function issueOtpForEmail(email: string): Promise<void> {
  await issueCode(email, (code) => sendOtpEmail(email, code));
}

/** Issues a code for a guardian to confirm consent (POST /api/consent/confirm), sharing the same OtpCode table. */
export async function issueConsentOtpForEmail(guardianEmail: string, studentName: string, instituteName: string): Promise<void> {
  await issueCode(guardianEmail, (code) => sendConsentEmail(guardianEmail, code, studentName, instituteName));
}
