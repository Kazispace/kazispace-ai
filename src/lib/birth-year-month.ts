/**
 * KAZI-1436 — the web side of the birth year-month (unified user system v1.7.4 §5.1.1 ④ ⑤ ⑧).
 *
 * The backend validates the same way (`PATCH /me` ⇒ 422 otherwise); these checks only keep the
 * form from offering what it would refuse.
 */

/** Oldest year `PATCH /me` accepts: this year minus 120. */
export const MAX_AGE_YEARS = 120;

/** `"YYYY-MM"` from a year and a 1–12 month. */
export function formatBirthYearMonth(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** `{ year, month }` from `"YYYY-MM"`, or `null`. */
export function parseBirthYearMonth(value: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Year choices, newest first: this year back to this year minus 120. */
export function birthYearOptions(today: Date = new Date()): number[] {
  const current = today.getFullYear();
  const out: number[] = [];
  for (let y = current; y >= current - MAX_AGE_YEARS; y -= 1) out.push(y);
  return out;
}

/** Not before this year minus 120, not after this month (the backend's rule). */
export function isAcceptableBirthYearMonth(year: number, month: number, today: Date = new Date()): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return false;
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  if (year < currentYear - MAX_AGE_YEARS) return false;
  if (year > currentYear) return false;
  if (year === currentYear && month > currentMonth) return false;
  return true;
}

/**
 * The profile form's check: the year-month (`""` = not chosen) changed but is not a whole, acceptable
 * one — both parts, not in the future. An unchanged value is never invalid.
 */
export function birthChangeInvalid(
  initial: { year: string; month: string },
  current: { year: string; month: string },
  today: Date = new Date()
): boolean {
  if (current.year === initial.year && current.month === initial.month) return false;
  if (!current.year || !current.month) return true;
  return !isAcceptableBirthYearMonth(Number(current.year), Number(current.month), today);
}

/** The browser's IANA zone, or `undefined` when the browser does not say (the backend then keeps the region's). */
export function browserTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.includes('/') ? zone : undefined;
  } catch {
    return undefined;
  }
}

/** The `PATCH /me` fields for one save: the year-month, plus the browser zone when known. */
export function birthYearMonthPatch(year: number, month: number): { birth_year_month: string; time_zone?: string } {
  const zone = browserTimeZone();
  return zone
    ? { birth_year_month: formatBirthYearMonth(year, month), time_zone: zone }
    : { birth_year_month: formatBirthYearMonth(year, month) };
}

const DISMISS_KEY_PREFIX = 'kazi.agePrompt.dismissed.';

/** The pop-up is shown once per user on this browser (§5.1.1 ⑤「弹一次」); 「我的」 stays open for it. */
export function agePromptDismissed(userId: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

export function dismissAgePrompt(userId: string): void {
  try {
    window.localStorage.setItem(DISMISS_KEY_PREFIX + userId, '1');
  } catch {
    // private mode / storage off: the pop-up may show again next visit, which is harmless
  }
}
