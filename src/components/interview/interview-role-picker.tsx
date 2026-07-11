'use client';

/** @deprecated KAZI-134 — role cards removed; intake is conversational via HubAgentShell. */
import { useTranslations } from 'next-intl';

import { INTERVIEW_ROLES } from '@/lib/interview-roles';

interface InterviewRolePickerProps {
  onSelect: (targetRole: string) => void;
  disabled?: boolean;
}

export function InterviewRolePicker({ onSelect, disabled }: InterviewRolePickerProps) {
  const t = useTranslations('interview');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-bold text-kazi-navy">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-2">{t('subtitle')}</p>
        <p className="text-xs text-gray-400 mt-1">{t('languageHint')}</p>
      </div>
      <div className="w-full max-w-md flex flex-col gap-3">
        {INTERVIEW_ROLES.map((role) => (
          <button
            key={role.targetRole}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(role.targetRole)}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white text-left hover:border-kazi-orange hover:bg-orange-50/50 transition-colors disabled:opacity-50"
          >
            <span className="text-2xl shrink-0">{role.icon}</span>
            <span>
              <span className="block font-semibold text-kazi-navy text-sm">
                {t(role.titleKey)}
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">{t(role.descKey)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
