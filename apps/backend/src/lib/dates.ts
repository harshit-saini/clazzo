/** Normalizes a Date to midnight UTC so it can be used as a calendar-date key. */
export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Every calendar date in [from, to] (inclusive), as date-only UTC dates. */
export function eachDateInRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = toDateOnly(from);
  const end = toDateOnly(to);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
