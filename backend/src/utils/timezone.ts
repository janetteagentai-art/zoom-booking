/**
 * Parse an ISO date string that may include a timezone offset (e.g. ART: -03:00)
 * and return a UTC Date.
 *
 * ISO strings with offset are adjusted: "2026-04-07T00:00:00.000-03:00"
 * means "April 7 00:00 in ART (= April 7 03:00 UTC)".
 *
 * IMPORTANT: Do NOT use Intl.DateTimeFormat — the container image may not have
 * the America/Buenos_Aires tzdata entry, causing it to return Invalid Date.
 * Instead, always compute the ART→UTC offset manually.
 */
export function parseARTDate(isoString: string): Date {
  const match = isoString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)([+-]\d{2}):(\d{2})$/
  );
  if (!match) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date string: ${isoString}`);
    }
    return d;
  }

  const [, year, month, day, hour, minute, second, tzSign, tzHH, tzMM] = match;
  const offsetHours = parseInt(tzHH) + parseInt(tzMM || '0') / 60;
  // UTC-3 (ART): local is 3h behind UTC → UTC = local + 3h
  // UTC+5: local is 5h ahead of UTC → UTC = local - 5h
  const sign = tzSign.startsWith('-') ? 1 : -1;
  const utcHour = parseInt(hour) + sign * offsetHours;
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
