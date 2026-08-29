'use client';

import { useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X } from 'lucide-react';

import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';
import { useSpaceTemplates } from '@/hooks/use-space-templates';
import { TEMPLATE_EMOJI } from '@/lib/spaces/constants';
import { resolveTemplateLabel } from '@/lib/spaces/template-label';
import type { SpaceTemplateItem } from '@/types/spaces';
import { cn } from '@/lib/utils';

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
        'w-full rounded-lg border border-workspace-border px-4 py-3 text-left transition-colors',
        'hover:border-primary hover:bg-[#FFF9F5] disabled:opacity-50'
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-workspace-text">
        <span aria-hidden>{emoji}</span>
        {title}
      </span>
      {desc ? (
        <span className="mt-0.5 block pl-7 text-xs text-workspace-muted">{desc}</span>
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

  useDialogFocusTrap({
    open,
    onClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop — click outside dialog closes (review P1-1). */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t('closePicker')}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-template-picker-title"
        className="relative z-10 w-[min(400px,92vw)] rounded-xl bg-white p-4 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="space-template-picker-title" className="text-base font-semibold text-workspace-text">
            {t('pickerTitle')}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded p-1 text-workspace-muted hover:bg-workspace-hover"
            aria-label={t('closePicker')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <p className="py-4 text-center text-sm text-workspace-muted">{t('loadingTemplates')}</p>
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
          <div className="mt-4 border-t border-workspace-border pt-3">
            <p className="mb-2 text-xs font-medium text-workspace-muted">{t('comingSoonSection')}</p>
            <ul className="space-y-2 opacity-60">
              {comingSoon.map((template) => (
                <li key={template.template_id}>
                  <TemplateButton template={template} disabled onSelect={() => {}} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-workspace-muted">{t('browseMoreComingSoon')}</p>
        )}
      </div>
    </div>
  );
}
