import { ApiError } from "./api";

/**
 * Turns a failed code check into something a person can act on. The API
 * distinguishes a wrong code (with tries left), an expired one, and a
 * locked-out one; "Invalid or expired code" for all three left people
 * guessing whether to retype or to ask for a new code.
 */
export function describeOtpError(err: unknown): { message: string; needsNewCode: boolean } {
  if (!(err instanceof ApiError)) return { message: "Something went wrong. Please try again.", needsNewCode: false };
  if (err.isNetworkError) return { message: err.message, needsNewCode: false };

  const reason = err.data?.reason;
  if (reason === "wrong") {
    const left = typeof err.data?.attemptsLeft === "number" ? err.data.attemptsLeft : null;
    return {
      message:
        left === null
          ? "That code isn't right. Check it and try again."
          : left === 0
            ? "That code isn't right, and you're out of tries. Send yourself a new code."
            : `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`,
      needsNewCode: left === 0,
    };
  }
  if (reason === "expired") return { message: "That code has expired or was replaced by a newer one. Send a new code.", needsNewCode: true };
  if (reason === "locked") return { message: "Too many wrong tries. Send yourself a new code.", needsNewCode: true };
  return { message: err.message, needsNewCode: false };
}
