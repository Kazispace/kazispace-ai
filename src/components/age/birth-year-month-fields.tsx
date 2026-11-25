'use client';

import { useTranslations } from 'next-intl';

import { birthYearOptions } from '@/lib/birth-year-month';

/** KAZI-1436: year + month selects. `""` = not chosen. Used by the pop-up and by the profile page. */
export function BirthYearMonthFields({
  year,
  month,
  onChange,
  idPrefix,
  disabled = false,
}: {
  year: string;
  month: string;
  onChange: (next: { year: string; month: string }) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const t = useTranslations('profile');
  const selectClass = 'w-full h-10 px-3 rounded-md border border-input bg-background';
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${idPrefix}-year`} className="text-xs text-gray-600 mb-1 block">
          {t('birthYearLabel')}
        </label>
        <select
          id={`${idPrefix}-year`}
          data-testid={`${idPrefix}-year`}
          className={selectClass}
          value={year}
          disabled={disabled}
          onChange={(e) => onChange({ year: e.target.value, month })}
        >
          <option value="">{t('birthUnset')}</option>
          {birthYearOptions().map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-month`} className="text-xs text-gray-600 mb-1 block">
          {t('birthMonthLabel')}
        </label>
        <select
          id={`${idPrefix}-month`}
          data-testid={`${idPrefix}-month`}
          className={selectClass}
          value={month}
          disabled={disabled}
          onChange={(e) => onChange({ year, month: e.target.value })}
        >
          <option value="">{t('birthUnset')}</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={String(m)}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
