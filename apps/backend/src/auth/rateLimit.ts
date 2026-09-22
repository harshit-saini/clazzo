/**
 * Minimal in-process rate limiter for OTP requests, keyed by normalized
 * email so the response is identical whether or not the email is
 * registered (avoids leaking account existence via rate-limit timing).
 *
 * Process-local: fine for a single backend instance. A multi-instance
 * deployment would need a shared store (e.g. Redis) instead.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const MIN_INTERVAL_MS = 60 * 1000;

const requestLog = new Map<string, number[]>();

export function isOtpRequestAllowed(email: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(email) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_PER_WINDOW) return false;
  if (timestamps.length > 0 && now - timestamps[timestamps.length - 1] < MIN_INTERVAL_MS) return false;

  timestamps.push(now);
  requestLog.set(email, timestamps);
  return true;
}
