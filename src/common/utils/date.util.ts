/**
 * Returns the UTC offset in milliseconds for a given timezone at the specified UTC date.
 * Positive = timezone is behind UTC (e.g., UTC-7 returns +25200000).
 * Negative = timezone is ahead of UTC (e.g., UTC+5 returns -18000000).
 */
export function getUtcOffsetMs(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const h = get('hour');
  const localMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    h === 24 ? 0 : h,
    get('minute'),
    get('second'),
  );
  return date.getTime() - localMs;
}

/**
 * Returns the calendar date string (YYYY-MM-DD) for a UTC timestamp in the given IANA timezone.
 */
export function toLocalDateString(timestamp: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

/**
 * Converts a date-only string (YYYY-MM-DD) to a UTC Date representing the
 * start (00:00:00) or end (23:59:59.999) of that calendar day in the given IANA timezone.
 * Uses noon UTC as a DST-safe reference to compute the day's UTC offset.
 */
export function toTzAwareDateBound(
  dateStr: string,
  timezone: string,
  endOfDay: boolean,
): Date {
  if (dateStr.includes('T')) return new Date(dateStr);
  const [y, m, d] = dateStr.split('-').map(Number);
  const noonRef = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offsetMs = getUtcOffsetMs(noonRef, timezone);
  return endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offsetMs)
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs);
}

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
