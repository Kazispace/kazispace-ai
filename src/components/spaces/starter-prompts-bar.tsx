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
import type { SpaceStarterConfig } from '@/lib/spaces/starter-prompts/types';
import { useUIStore, type ComposerInsertTarget } from '@/lib/store';
import { cn } from '@/lib/utils';

export interface StarterPromptsController {
  cfg: SpaceStarterConfig;
  hydrated: boolean;
  examplesCollapsed: boolean;
  setExamplesCollapsed: (next: boolean) => void;
  panelId: string;
}

/** Shared collapse state for examples strip (capabilities stay in composer). */
export function useStarterPromptsController(
  spaceId: string,
  templateId: string,
  hasUserMessage: boolean
): StarterPromptsController | null {
  const panelId = useId();
  const cfg = useMemo(() => resolveStarterConfig(templateId), [templateId]);
  const [hydrated, setHydrated] = useState(false);
  const [examplesCollapsed, setExamplesCollapsed] = useState(false);

  useEffect(() => {
    const stored = readStarterCollapsed(spaceId);
    const next = resolveStarterCollapsed({ hasUserMessage, stored });
    setExamplesCollapsed(next);
    if (stored === null && hasUserMessage && next) {
      writeStarterCollapsed(spaceId, true);
    }
    setHydrated(true);
  }, [spaceId, hasUserMessage]);

  if (!cfg) return null;

  return {
    cfg,
    hydrated,
    examplesCollapsed,
    setExamplesCollapsed: (next: boolean) => {
      setExamplesCollapsed(next);
      writeStarterCollapsed(spaceId, next);
    },
    panelId,
  };
}

export function StarterCapabilityToolbar({
  cfg,
  disabled,
  insertTarget = 'space',
  i18nNamespace = 'spaces',
}: {
  cfg: SpaceStarterConfig;
  disabled?: boolean;
  insertTarget?: ComposerInsertTarget;
  /** next-intl namespace — Space: `spaces`, Clinic: `clinic` */
  i18nNamespace?: 'spaces' | 'clinic';
}) {
  const t = useTranslations(i18nNamespace);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);

  if (cfg.capabilities.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {cfg.capabilities.map((cap) => (
        <button
          key={cap.id}
          type="button"
          disabled={disabled}
          title={cap.descriptionKey ? t(cap.descriptionKey) : undefined}
          onClick={() =>
            requestComposerInsert(t(cap.insertTextKey), insertTarget, 'replace')
          }
          className={cn(
            'shrink-0 rounded-full border border-[#E5E6EB]/90 bg-[#F7F8FA]/90',
            'px-2.5 py-1 text-[11px] leading-none text-[#4E5969]',
            'transition-colors hover:border-kazi-orange/40 hover:bg-[#FFF4EC] hover:text-kazi-orange',
            'disabled:opacity-50'
          )}
        >
          {t(cap.labelKey)}
        </button>
      ))}
    </div>
  );
}

export function StarterExampleStrip({
  cfg,
  panelId,
  collapsed,
  disabled,
  onToggleCollapsed,
  onSendExample,
  i18nNamespace = 'spaces',
}: {
  cfg: SpaceStarterConfig;
  panelId: string;
  collapsed: boolean;
  disabled?: boolean;
  onToggleCollapsed: (next: boolean) => void;
  onSendExample: (text: string) => void;
  i18nNamespace?: 'spaces' | 'clinic';
}) {
  const t = useTranslations(i18nNamespace);

  if (cfg.examples.length === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-expanded={false}
        aria-controls={panelId}
        onClick={() => onToggleCollapsed(false)}
        className={cn(
          'group flex w-full items-center justify-between gap-2 rounded-full',
          'border border-[#E5E6EB]/80 bg-white/70 px-3 py-1.5',
          'text-left text-[12px] text-[#4E5969]',
          'transition-colors hover:border-kazi-orange/35 hover:text-[#1D2129]',
          'disabled:opacity-50'
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <Sparkles
            className="h-3.5 w-3.5 text-kazi-orange/70 group-hover:text-kazi-orange"
            aria-hidden
          />
          {t('starter.tryThese')}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </button>
    );
  }

  return (
    <div
      id={panelId}
      role="region"
      aria-label={t('starter.regionLabel')}
      className="flex w-full min-w-0 items-start gap-2"
    >
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {cfg.examples.map((ex) => (
          <button
            key={ex.id}
            type="button"
            disabled={disabled}
            title={t(ex.promptKey)}
            onClick={() => onSendExample(t(ex.promptKey))}
            className={cn(
              'max-w-full truncate rounded-full border border-[#E5E6EB]/90 bg-white/80',
              'px-2.5 py-1 text-[11px] text-[#4E5969]',
              'transition-colors hover:border-kazi-orange/40 hover:bg-[#FFF4EC] hover:text-[#1D2129]',
              'disabled:opacity-50'
            )}
          >
            {t(ex.shortLabelKey ?? ex.promptKey)}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={true}
        aria-controls={panelId}
        onClick={() => onToggleCollapsed(true)}
        className="inline-flex shrink-0 items-center gap-0.5 pt-0.5 text-[11px] text-[#86909C] hover:text-[#1D2129] disabled:opacity-50"
      >
        {t('starter.collapse')}
        <ChevronUp className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}
