'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { getSpacePanelLabel } from '@/lib/spaces/panel-labels';
import type { SpacePanelConfig } from '@/types/spaces';

export type SpaceWorkspaceView = 'chat' | SpacePanelConfig['panel_id'];

interface SpacePanelTabsProps {
  panels: SpacePanelConfig[];
  /** Active tab on mobile (controls which column is visible). */
  active: SpaceWorkspaceView;
  /** Active tab on desktop — defaults to `active` when omitted. */
  desktopActive?: SpaceWorkspaceView;
  onChange: (view: SpaceWorkspaceView) => void;
  className?: string;
}

export function SpacePanelTabs({
  panels,
  active,
  desktopActive,
  onChange,
  className,
}: SpacePanelTabsProps) {
  const t = useTranslations('spaces');

  const panelLabel = useCallback(
    (panel: SpacePanelConfig) => getSpacePanelLabel(panel, t),
    [t]
  );

  const tabs: { id: SpaceWorkspaceView; label: string }[] = [
    { id: 'chat', label: t('panelChat') },
    ...panels.map((panel) => ({ id: panel.panel_id, label: panelLabel(panel) })),
  ];

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, current: SpaceWorkspaceView) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = tabs.findIndex((tab) => tab.id === current);
      const next =
        event.key === 'ArrowRight'
          ? tabs[(index + 1) % tabs.length]
          : tabs[(index - 1 + tabs.length) % tabs.length];
      onChange(next?.id ?? 'chat');
    },
    [onChange, tabs]
  );

  const resolvedDesktop = desktopActive ?? active;

  return (
    <div
      className={cn('flex shrink-0 border-b border-gray-200/80 bg-white', className)}
      role="tablist"
      aria-label={t('workspacePanels')}
    >
      {tabs.map(({ id, label }) => {
        const mobileSelected = active === id;
        const dtSelected = resolvedDesktop === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mobileSelected || dtSelected}
            tabIndex={mobileSelected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => handleKeyDown(event, id)}
            className={cn(
              'relative flex-1 py-3 text-sm font-medium transition-colors',
              mobileSelected ? 'text-kazi-navy lg:text-gray-500' : 'text-gray-500',
              dtSelected && 'lg:text-kazi-navy'
            )}
          >
            {label}
            <span
              className={cn(
                'absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary',
                mobileSelected ? 'block lg:hidden' : 'hidden',
                dtSelected && 'lg:block'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
