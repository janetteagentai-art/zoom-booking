/**
 * Parse an ISO date string that may include a timezone offset (e.g. ART: -03:00)
 * and return a UTC Date.
 *
 * ISO strings with offset are adjusted: "2026-04-07T00:00:00.000-03:00"
 * means "April 7 00:00 in ART (= April 7 03:00 UTC)".
 */
export function parseARTDate(isoString: string): Date {
  const match = isoString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)([+-]\d{2}):(\d{2})$/
  );
  if (!match) {
    // fallback: let JS try (works for Z-calendar dates)
    return new Date(isoString);
  }

  const [, year, month, day, hour, minute, second, tzSign, tzHH, tzMM] = match;
  const tzOffsetHours = (tzSign === '+' ? 1 : -1) * (parseInt(tzHH) + parseInt(tzMM) / 60);

  const utcHour = parseInt(hour) - tzOffsetHours;
  const utcDate = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    utcHour,
    parseInt(minute),
    parseFloat(second)
  );

  return utcDate;
}
