'use client';

import { useEffect, useId, useState } from 'react';
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
  const cfg = resolveStarterConfig(templateId);
  const [collapsed, setCollapsed] = useState(() =>
    resolveStarterCollapsed({
      hasUserMessage,
      stored: readStarterCollapsed(spaceId),
    })
  );

  // Sync when space changes or first user message arrives without preference.
  useEffect(() => {
    const stored = readStarterCollapsed(spaceId);
    const next = resolveStarterCollapsed({ hasUserMessage, stored });
    setCollapsed(next);
    // Persist first auto-fold (0→1) so refresh keeps scheme A default.
    if (stored === null && hasUserMessage && next) {
      writeStarterCollapsed(spaceId, true);
    }
  }, [spaceId, hasUserMessage]);

  if (!cfg) return null;

  const setCollapsedPersist = (next: boolean) => {
    setCollapsed(next);
    writeStarterCollapsed(spaceId, next);
  };

  if (collapsed) {
    return (
      <div className="bg-gray-bg px-3 pb-1.5 pt-1">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => setCollapsedPersist(false)}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md border border-gray-200',
            'bg-white px-3 py-2 text-left text-[12px] text-[#4E5969]',
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
        <div className="-mx-0.5 mb-2 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5">
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
                'shrink-0 rounded border border-gray-200 bg-white px-2.5 py-1',
                'text-[11px] text-[#1D2129] transition-colors',
                'hover:border-kazi-orange hover:bg-white hover:text-kazi-orange',
                'disabled:opacity-50'
              )}
            >
              {t(cap.labelKey)}
            </button>
          ))}
        </div>
      ) : null}

      {cfg.examples.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-[#86909C]">
            {t('starter.examplesHeading')}
          </p>
          <ul className="space-y-1">
            {cfg.examples.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    // First auto-fold if no preference yet (scheme A).
                    if (readStarterCollapsed(spaceId) === null) {
                      setCollapsedPersist(true);
                    }
                    onSendExample(t(ex.promptKey));
                  }}
                  className={cn(
                    'w-full rounded-md border border-transparent px-2 py-1.5 text-left',
                    'text-[12px] leading-snug text-[#4E5969]',
                    'transition-colors hover:border-gray-200 hover:bg-white hover:text-[#1D2129]',
                    'disabled:opacity-50'
                  )}
                >
                  <span className="line-clamp-2">“{t(ex.promptKey)}”</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
