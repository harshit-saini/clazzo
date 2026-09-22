import { prisma } from "../db.js";
import { MAX_OTP_ATTEMPTS, hashOtpCode } from "./otp.js";

export type OtpVerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Checks a submitted code against the latest outstanding OtpCode for an
 * email, consuming it on success (or bumping attempts / expiring it on
 * failure). Shared by login (/api/auth/otp/verify) and guardian consent
 * (/api/consent/confirm) — same table, same rules, different post-action.
 */
export async function verifyOtpCode(email: string, code: string): Promise<OtpVerifyResult> {
  const otp = await prisma.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.expiresAt < new Date()) {
    return { ok: false, error: "Invalid or expired code" };
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  if (otp.codeHash !== hashOtpCode(code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Invalid or expired code" };
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
