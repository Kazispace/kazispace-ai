'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { MVP_SPACE_TEMPLATE_IDS } from '@/lib/spaces/constants';
import { cn } from '@/lib/utils';

interface SpaceTemplatePickerProps {
  open: boolean;
  isCreating?: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

const TEMPLATE_KEYS: Record<string, string> = {
  blank_conversation: 'templateBlank',
  job_sprint: 'templateJobSprint',
  ielts_prep: 'templateIelts',
};

export function SpaceTemplatePicker({
  open,
  isCreating = false,
  onClose,
  onSelect,
}: SpaceTemplatePickerProps) {
  const t = useTranslations('spaces');

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/40"
        aria-label={t('closePicker')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-template-picker-title"
        className="fixed left-1/2 top-1/2 z-50 w-[min(400px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="space-template-picker-title" className="text-base font-semibold text-[#1D2129]">
            {t('pickerTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#86909C] hover:bg-[#F2F3F5]"
            aria-label={t('closePicker')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="space-y-2">
          {MVP_SPACE_TEMPLATE_IDS.map((templateId) => {
            const key = TEMPLATE_KEYS[templateId] ?? templateId;
            return (
              <li key={templateId}>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => onSelect(templateId)}
                  className={cn(
                    'w-full rounded-lg border border-[#E5E6EB] px-4 py-3 text-left transition-colors',
                    'hover:border-kazi-orange hover:bg-[#FFF9F5] disabled:opacity-50'
                  )}
                >
                  <span className="block text-sm font-medium text-[#1D2129]">
                    {t(key)}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#86909C]">
                    {t(`${key}Desc`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-center text-xs text-[#86909C]">{t('browseMoreComingSoon')}</p>
      </div>
    </>
  );
}
