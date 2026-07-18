'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  readStarterCollapsed,
  resolveStarterCollapsed,
  resolveStarterConfig,
  writeStarterCollapsed,
} from '@/lib/spaces/starter-prompts/config';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export interface StarterPromptsBarProps {
  spaceId: string;
  templateId: string;
  hasUserMessage: boolean;
  disabled?: boolean;
  onSendExample: (text: string) => void;
}

/**
 * Capability discovery above Space composer (KAZI-238).
 * Chips → replace-fill composer; examples → send turn.
 */
export function StarterPromptsBar({
  spaceId,
  templateId,
  hasUserMessage,
  disabled = false,
  onSendExample,
}: StarterPromptsBarProps) {
  const t = useTranslations('spaces');
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);
  const panelId = useId();
  const cfg = useMemo(() => resolveStarterConfig(templateId), [templateId]);

  // Avoid SSR→client flash: wait for localStorage read before painting (PR #130 P3).
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = readStarterCollapsed(spaceId);
    const next = resolveStarterCollapsed({ hasUserMessage, stored });
    setCollapsed(next);
    // Persist first auto-fold (0→1) so refresh keeps scheme A default.
    // Also covers example-send path — single writer (no onClick duplicate).
    if (stored === null && hasUserMessage && next) {
      writeStarterCollapsed(spaceId, true);
    }
    setHydrated(true);
  }, [spaceId, hasUserMessage]);

  if (!cfg || !hydrated) return null;

  const setCollapsedPersist = (next: boolean) => {
    setCollapsed(next);
    writeStarterCollapsed(spaceId, next);
  };

  if (collapsed) {
    return (
      <div className="bg-gray-bg px-3 pb-0.5 pt-0.5">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => setCollapsedPersist(false)}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md border border-gray-200',
            'bg-white px-3 py-1.5 text-left text-[12px] text-[#4E5969]',
            'transition-colors hover:border-kazi-orange/40 hover:text-[#1D2129]',
            'disabled:opacity-50'
          )}
        >
          <span>{t('starter.tryThese')}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      id={panelId}
      role="region"
      aria-label={t('starter.regionLabel')}
      className="bg-gray-bg px-3 pb-1.5 pt-1"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-[#86909C]">
          {t('starter.capabilitiesHeading')}
        </p>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={true}
          aria-controls={panelId}
          onClick={() => setCollapsedPersist(true)}
          className="inline-flex items-center gap-0.5 text-[11px] text-[#86909C] hover:text-[#1D2129] disabled:opacity-50"
        >
          {t('starter.collapse')}
          <ChevronUp className="h-3 w-3" aria-hidden />
        </button>
      </div>

      {cfg.capabilities.length > 0 ? (
        <div className="mb-2.5 flex w-full gap-2">
          {cfg.capabilities.map((cap) => (
            <button
              key={cap.id}
              type="button"
              disabled={disabled}
              title={cap.descriptionKey ? t(cap.descriptionKey) : undefined}
              onClick={() =>
                requestComposerInsert(t(cap.insertTextKey), 'space', 'replace')
              }
              className={cn(
                'min-w-0 flex-1 rounded-md border border-gray-200/90 bg-white px-2 py-1.5',
                'text-center text-[11px] leading-tight text-[#1D2129] transition-colors',
                'hover:border-kazi-orange hover:text-kazi-orange',
                'disabled:opacity-50'
              )}
            >
              <span className="block truncate">{t(cap.labelKey)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {cfg.examples.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-[#86909C]">
            {t('starter.examplesHeading')}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {cfg.examples.map((ex) => (
              <li key={ex.id} className="min-w-0 flex-[1_1_14rem] max-w-full">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSendExample(t(ex.promptKey))}
                  className={cn(
                    'h-full w-full rounded-md border border-gray-200/90 bg-white px-2.5 py-1.5',
                    'text-left text-[11px] leading-snug text-[#4E5969]',
                    'transition-colors hover:border-kazi-orange/50 hover:text-[#1D2129]',
                    'disabled:opacity-50'
                  )}
                >
                  <span className="line-clamp-2">{t(ex.promptKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
