import { prisma } from "../db.js";
import { sendConsentEmail, sendOtpEmail } from "../email/resend.js";
import { OTP_TTL_MS, generateOtpCode, hashOtpCode } from "./otp.js";

/** Invalidates any outstanding codes for the email and stores a fresh one. Returns the plaintext code to send. */
async function issueCode(email: string): Promise<string> {
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

  return code;
}

/** Issues a login code and emails it. */
export async function issueOtpForEmail(email: string): Promise<void> {
  const code = await issueCode(email);
  await sendOtpEmail(email, code);
}

/** Issues a code for a guardian to confirm consent (POST /api/consent/confirm), sharing the same OtpCode table. */
export async function issueConsentOtpForEmail(guardianEmail: string, studentName: string, instituteName: string): Promise<void> {
  const code = await issueCode(guardianEmail);
  await sendConsentEmail(guardianEmail, code, studentName, instituteName);
}
