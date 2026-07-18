'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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
      <div className="bg-gray-bg px-3 pb-1.5 pt-1">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => setCollapsedPersist(false)}
          className={cn(
            'group flex w-full items-center justify-between gap-2 rounded-2xl',
            'border border-[#E5E6EB]/80 bg-gradient-to-b from-white/70 to-white/35',
            'px-3.5 py-2 text-left text-[12px] text-[#4E5969]',
            'shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] backdrop-blur-sm',
            'transition-all duration-200',
            'hover:border-kazi-orange/35 hover:text-[#1D2129]',
            'disabled:opacity-50'
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles
              className="h-3.5 w-3.5 text-kazi-orange/70 transition-colors group-hover:text-kazi-orange"
              aria-hidden
            />
            {t('starter.tryThese')}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-bg px-3 pb-1.5 pt-1">
      <div
        id={panelId}
        role="region"
        aria-label={t('starter.regionLabel')}
        className={cn(
          'rounded-2xl border border-[#E5E6EB]/70',
          'bg-gradient-to-b from-white/75 via-white/45 to-white/25',
          'p-2.5 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset] backdrop-blur-sm'
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-[#86909C]">
            <span
              className="h-1 w-1 rounded-full bg-kazi-orange/80"
              aria-hidden
            />
            {t('starter.capabilitiesHeading')}
          </p>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={true}
            aria-controls={panelId}
            onClick={() => setCollapsedPersist(true)}
            className="inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] text-[#86909C] transition-colors hover:bg-white/50 hover:text-[#1D2129] disabled:opacity-50"
          >
            {t('starter.collapse')}
            <ChevronUp className="h-3 w-3" aria-hidden />
          </button>
        </div>

        {cfg.capabilities.length > 0 ? (
          <div
            className={cn(
              'flex w-full gap-1.5',
              cfg.examples.length > 0 ? 'mb-2' : null
            )}
          >
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
                  'min-w-0 flex-1 rounded-xl border border-transparent',
                  'bg-white/55 px-2 py-1.5 text-center text-[11px] leading-tight text-[#1D2129]',
                  'ring-1 ring-inset ring-[#1D2129]/[0.06]',
                  'transition-all duration-200',
                  'hover:-translate-y-px hover:bg-[#FFF4EC]/90 hover:text-kazi-orange',
                  'hover:ring-kazi-orange/25',
                  'active:translate-y-0',
                  'disabled:opacity-50 disabled:hover:translate-y-0'
                )}
              >
                <span className="block truncate">{t(cap.labelKey)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {cfg.examples.length > 0 ? (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {cfg.examples.map((ex) => (
              <li key={ex.id} className="min-w-0">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSendExample(t(ex.promptKey))}
                  className={cn(
                    'group relative h-full w-full overflow-hidden rounded-xl',
                    'border border-[#E5E6EB]/60 bg-white/40 px-2.5 py-2',
                    'text-left text-[11px] leading-snug text-[#4E5969]',
                    'transition-all duration-200',
                    'hover:border-kazi-orange/30 hover:bg-[#FFF4EC]/55 hover:text-[#1D2129]',
                    'hover:shadow-[0_6px_16px_-10px_rgba(244,121,32,0.45)]',
                    'disabled:opacity-50'
                  )}
                >
                  <span
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-kazi-orange/0 transition-colors group-hover:bg-kazi-orange/70"
                    aria-hidden
                  />
                  <span className="line-clamp-2 pl-1.5">{t(ex.promptKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
