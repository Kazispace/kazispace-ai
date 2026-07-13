'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { getSpacePanelLabel } from '@/lib/spaces/panel-labels';
import type { SpacePanelConfig } from '@/types/spaces';

/** Mobile view switcher: chat column ↔ template panel. */
export type SpaceWorkspaceView = 'chat' | SpacePanelConfig['panel_id'];

interface SpacePanelTabsProps {
  panels: SpacePanelConfig[];
  active: SpaceWorkspaceView;
  onChange: (view: SpaceWorkspaceView) => void;
  className?: string;
}

export function SpacePanelTabs({
  panels,
  active,
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

  return (
    <div
      className={cn('flex shrink-0 border-b border-gray-200/80 bg-white', className)}
      role="tablist"
      aria-label={t('workspacePanels')}
    >
      {tabs.map(({ id, label }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => handleKeyDown(event, id)}
            className={cn(
              'relative flex-1 py-3 text-sm font-medium transition-colors',
              selected ? 'text-kazi-navy' : 'text-gray-500'
            )}
          >
            {label}
            {selected ? (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-kazi-orange" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
