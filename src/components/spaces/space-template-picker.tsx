'use client';

import { useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X } from 'lucide-react';

import { useSpaceTemplates } from '@/hooks/use-space-templates';
import { TEMPLATE_EMOJI } from '@/lib/spaces/constants';
import { resolveTemplateLabel } from '@/lib/spaces/template-label';
import type { SpaceTemplateItem } from '@/types/spaces';
import { cn } from '@/lib/utils';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface SpaceTemplatePickerProps {
  open: boolean;
  isCreating?: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

function TemplateButton({
  template,
  disabled,
  onSelect,
}: {
  template: SpaceTemplateItem;
  disabled?: boolean;
  onSelect: (templateId: string) => void;
}) {
  const t = useTranslations('spaces');
  const locale = useLocale();
  const { title, desc } = resolveTemplateLabel(template, locale, t);
  const emoji = TEMPLATE_EMOJI[template.template_id] ?? '✨';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(template.template_id)}
      className={cn(
        'w-full rounded-lg border border-[#E5E6EB] px-4 py-3 text-left transition-colors',
        'hover:border-kazi-orange hover:bg-[#FFF9F5] disabled:opacity-50'
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-[#1D2129]">
        <span aria-hidden>{emoji}</span>
        {title}
      </span>
      {desc ? (
        <span className="mt-0.5 block pl-7 text-xs text-[#86909C]">{desc}</span>
      ) : null}
    </button>
  );
}

export function SpaceTemplatePicker({
  open,
  isCreating = false,
  onClose,
  onSelect,
}: SpaceTemplatePickerProps) {
  const t = useTranslations('spaces');
  const { templates, comingSoon, isLoading } = useSpaceTemplates(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

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
        ref={dialogRef}
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
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#86909C] hover:bg-[#F2F3F5]"
            aria-label={t('closePicker')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <p className="py-4 text-center text-sm text-[#86909C]">{t('loadingTemplates')}</p>
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => (
              <li key={template.template_id}>
                <TemplateButton
                  template={template}
                  disabled={isCreating}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        )}

        {comingSoon.length > 0 ? (
          <div className="mt-4 border-t border-[#E5E6EB] pt-3">
            <p className="mb-2 text-xs font-medium text-[#86909C]">{t('comingSoonSection')}</p>
            <ul className="space-y-2 opacity-60">
              {comingSoon.map((template) => (
                <li key={template.template_id}>
                  <TemplateButton template={template} disabled onSelect={() => {}} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-[#86909C]">{t('browseMoreComingSoon')}</p>
        )}
      </div>
    </>
  );
}
