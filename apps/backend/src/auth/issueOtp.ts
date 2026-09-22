import { prisma } from "../db.js";
import { sendOtpEmail } from "../email/resend.js";
import { OTP_TTL_MS, generateOtpCode, hashOtpCode } from "./otp.js";

/** Invalidates any outstanding codes for the email, issues a fresh one, and sends it. */
export async function issueOtpForEmail(email: string): Promise<void> {
  await prisma.otpCode.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateOtpCode();
  await prisma.otpCode.create({
    data: {
      email,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendOtpEmail(email, code);
}
