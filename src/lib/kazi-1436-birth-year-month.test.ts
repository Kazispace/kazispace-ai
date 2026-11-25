/**
 * @vitest-environment jsdom
 *
 * KAZI-1436 — the web side of the birth year-month (unified user system v1.7.4 §5.1.1 ④ ⑤ ⑧).
 * The form offers only what `PATCH /me` accepts; one save carries the browser zone; the pop-up's
 * "once" is per user on this browser; the mapper never asks against a backend without the fields.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_AGE_YEARS,
  agePromptDismissed,
  birthChangeInvalid,
  birthYearMonthPatch,
  birthYearOptions,
  dismissAgePrompt,
  formatBirthYearMonth,
  isAcceptableBirthYearMonth,
  parseBirthYearMonth,
} from '@/lib/birth-year-month';
import { mapUserFromApi } from '@/lib/api-mappers';

const TODAY = new Date(2026, 10, 24); // 2026-11-24, local

describe('format / parse', () => {
  it('round-trips YYYY-MM', () => {
    expect(formatBirthYearMonth(2008, 5)).toBe('2008-05');
    expect(parseBirthYearMonth('2008-05')).toEqual({ year: 2008, month: 5 });
  });
  it.each(['', '2008', '2008-5', '2008-13', '2008-00', 'x', null, undefined])('refuses %s', (v) => {
    expect(parseBirthYearMonth(v as string | null | undefined)).toBeNull();
  });
});

describe('the backend rule: not before this year minus 120, not after this month', () => {
  it('offers this year back to this year minus 120', () => {
    const years = birthYearOptions(TODAY);
    expect(years[0]).toBe(2026);
    expect(years[years.length - 1]).toBe(2026 - MAX_AGE_YEARS);
    expect(years).toHaveLength(MAX_AGE_YEARS + 1);
  });
  it.each([
    [2026 - 120, 1, true],
    [2026 - 121, 12, false],
    [2026, 11, true],
    [2026, 12, false],
    [2027, 1, false],
    [2008, 0, false],
    [2008, 13, false],
  ])('%i-%i ⇒ %s', (y, m, ok) => {
    expect(isAcceptableBirthYearMonth(y, m, TODAY)).toBe(ok);
  });
});

describe('the profile form check', () => {
  const empty = { year: '', month: '' };
  it('an unchanged value is never invalid, filled or not', () => {
    expect(birthChangeInvalid(empty, empty, TODAY)).toBe(false);
    expect(birthChangeInvalid({ year: '1990', month: '3' }, { year: '1990', month: '3' }, TODAY)).toBe(false);
  });
  it('half a year-month, or a future one, is invalid', () => {
    expect(birthChangeInvalid(empty, { year: '2008', month: '' }, TODAY)).toBe(true);
    expect(birthChangeInvalid(empty, { year: '', month: '5' }, TODAY)).toBe(true);
    expect(birthChangeInvalid(empty, { year: '2026', month: '12' }, TODAY)).toBe(true);
    // ⛔ back to not filled in: the backend refuses null
    expect(birthChangeInvalid({ year: '1990', month: '3' }, empty, TODAY)).toBe(true);
  });
  it('a whole, past one is fine', () => {
    expect(birthChangeInvalid(empty, { year: '2008', month: '5' }, TODAY)).toBe(false);
  });
});

describe('one save carries the browser zone (§5.1.1 ⑧)', () => {
  afterEach(() => vi.restoreAllMocks());
  it('sends the IANA zone with the year-month', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Almaty',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(birthYearMonthPatch(2008, 5)).toEqual({ birth_year_month: '2008-05', time_zone: 'Asia/Almaty' });
  });
  it('leaves the zone out when the browser has no IANA name (the backend keeps the region zone)', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'UTC',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(birthYearMonthPatch(2008, 5)).toEqual({ birth_year_month: '2008-05' });
  });
});

describe('the pop-up is shown once per user on this browser', () => {
  afterEach(() => window.localStorage.clear());
  it('is per user', () => {
    expect(agePromptDismissed('7')).toBe(false);
    dismissAgePrompt('7');
    expect(agePromptDismissed('7')).toBe(true);
    expect(agePromptDismissed('8')).toBe(false);
  });
});

describe('the /me mapper', () => {
  it('maps the four fields', () => {
    const u = mapUserFromApi({
      user_id: 1,
      birth_year_month: '2008-05',
      age_band: '14_17',
      needs_age: false,
      time_zone: 'Asia/Shanghai',
    });
    expect(u).toMatchObject({ birthYearMonth: '2008-05', ageBand: '14_17', needsAge: false, timeZone: 'Asia/Shanghai' });
  });
  it('an empty account asks', () => {
    expect(mapUserFromApi({ user_id: 1, birth_year_month: null, age_band: null, needs_age: true }).needsAge).toBe(true);
  });
  it('a backend without the fields never asks', () => {
    const u = mapUserFromApi({ user_id: 1 });
    expect(u.needsAge).toBe(false);
    expect(u.ageBand).toBeNull();
    expect(u.birthYearMonth).toBeNull();
  });
  it('an unknown band reads as null', () => {
    expect(mapUserFromApi({ user_id: 1, age_band: 'unknown' }).ageBand).toBeNull();
  });
});
