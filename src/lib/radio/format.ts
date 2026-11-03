/** Display helpers for the personal radio (KAZI-1209). */

/** "上次收听" date: month, day and time in the interface language; the raw value if it cannot be read. */
export function formatRadioDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Whole minutes, at least 1, for a duration in milliseconds (`radio.home.minutes`). */
export function radioMinutes(ms: number | null | undefined): number {
  return Math.max(1, Math.round((ms ?? 0) / 60_000));
}
