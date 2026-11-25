'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { BirthYearMonthFields } from '@/components/age/birth-year-month-fields';
import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';
import { patchMe } from '@/lib/api-client';
import { setUserInfo } from '@/lib/auth';
import {
  agePromptDismissed,
  birthYearMonthPatch,
  browserTimeZone,
  dismissAgePrompt,
  isAcceptableBirthYearMonth,
} from '@/lib/birth-year-month';
import { useAuthStore, useUIStore } from '@/lib/store';

/**
 * KAZI-1436 (unified user system v1.7.4 §5.1.1 ⑤): while `/me` says `needs_age`, the web asks for the
 * birth year-month once — right after OTP for a new user, after login for an existing one. 「Later」 closes it
 * for this user on this browser; Escape only closes it for this page load. 「我的」 › profile
 * stays open for it any time. Login is never blocked (⑤).
 *
 * Also (⑧, #310 review 🟡1): an account that has a birth year-month but no stored zone — e.g. it answered in
 * the Telegram chat (KAZI-1437) — gets the browser's IANA zone sent once, silently, so its day and night window
 * follow local time instead of the region's audience zone.
 */
export function AgePrompt() {
  const t = useTranslations('profile');
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const updateUser = useAuthStore((s) => s.updateUser);
  const showToast = useUIStore((s) => s.showToast);
  const [dismissed, setDismissed] = useState(true);
  const [value, setValue] = useState({ year: '', month: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  const userId = user?.id ?? '';
  useEffect(() => {
    // Read once the user is known (storage is per user and only in the browser).
    setDismissed(userId ? agePromptDismissed(userId) : true);
  }, [userId]);

  // ⑧ zone backfill: only for an account the backend already knows the age of (`birthYearMonth` is set, so this
  // is a backend with the KAZI-1436 fields) and holds no zone for. One try per user per page load.
  const zoneTried = useRef<string | null>(null);
  const hasAge = Boolean(user?.birthYearMonth);
  const hasZone = Boolean(user?.timeZone);
  useEffect(() => {
    if (!isLoggedIn || !userId || !hasAge || hasZone || zoneTried.current === userId) return;
    const zone = browserTimeZone();
    if (!zone) return;
    zoneTried.current = userId;
    void patchMe({ time_zone: zone }).then((res) => {
      if (res.success && res.data) updateUser({ timeZone: res.data.timeZone ?? zone });
    });
  }, [isLoggedIn, userId, hasAge, hasZone, updateUser]);

  const open = Boolean(isLoggedIn && user && user.needsAge && !dismissed);

  const later = () => {
    if (userId) dismissAgePrompt(userId);
    setDismissed(true);
  };

  // Escape (#310 review 🟡2) closes it for this page load only: an accidental key press does not stop the ask.
  useDialogFocusTrap({ open, onClose: () => setDismissed(true), dialogRef, initialFocusRef: yearRef });

  if (!open || typeof document === 'undefined') return null;

  const save = async () => {
    const year = Number(value.year);
    const month = Number(value.month);
    if (!value.year || !value.month || !isAcceptableBirthYearMonth(year, month)) {
      setError(t('birthInvalid'));
      return;
    }
    setSaving(true);
    setError('');
    const res = await patchMe(birthYearMonthPatch(year, month));
    setSaving(false);
    if (!res.success || !res.data) {
      setError(res.error ?? t('saveFailed'));
      return;
    }
    updateUser(res.data);
    setUserInfo({ ...user!, ...res.data });
    showToast(t('birthSaved'), 'info');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-prompt-title"
        aria-describedby="age-prompt-why"
        data-testid="age-prompt"
      >
        <h2 id="age-prompt-title" className="text-lg font-semibold text-workspace-text">
          {t('birthPromptTitle')}
        </h2>
        <p id="age-prompt-why" className="mt-2 text-sm text-workspace-muted leading-relaxed">
          {t('birthWhy')}
        </p>
        <div ref={yearRef} tabIndex={-1} className="mt-4 outline-none">
          <BirthYearMonthFields
            idPrefix="age-prompt"
            year={value.year}
            month={value.month}
            disabled={saving}
            onChange={(next) => {
              setValue(next);
              setError('');
            }}
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">{t('birthEditAnytime')}</p>
        <div className="mt-5 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={later} disabled={saving}>
            {t('birthLater')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => void save()}
            disabled={saving}
            data-testid="age-prompt-save"
          >
            {saving ? t('saving') : t('birthSave')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
