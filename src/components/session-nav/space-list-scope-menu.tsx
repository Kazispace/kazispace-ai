'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { SpaceNavFilter } from '@/lib/space-nav';
import { cn } from '@/lib/utils';

interface SpaceListScopeMenuProps {
  spaceFilter: SpaceNavFilter;
  hasArchivedSpaces: boolean;
  onFilterChange: (filter: SpaceNavFilter) => void;
}

export function SpaceListScopeMenu({
  spaceFilter,
  hasArchivedSpaces,
  onFilterChange,
}: SpaceListScopeMenuProps) {
  const t = useTranslations('sessionNav');
  const tSpaces = useTranslations('spaces');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const title =
    spaceFilter === 'archived' ? tSpaces('filterArchived') : t('tabSpaces');

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!hasArchivedSpaces) {
    return (
      <p className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-workspace-text">
        {title}
      </p>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-0.5 rounded-md px-1 py-0.5 text-sm font-medium text-workspace-text hover:bg-workspace-hover"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-workspace-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 min-w-[10rem] rounded-lg border border-workspace-border bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className={cn(
              'flex w-full px-3 py-2 text-left text-sm hover:bg-workspace-hover',
              spaceFilter === 'active' && 'font-medium text-workspace-text'
            )}
            onClick={() => {
              onFilterChange('active');
              setOpen(false);
            }}
          >
            {tSpaces('filterActive')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(
              'flex w-full px-3 py-2 text-left text-sm hover:bg-workspace-hover',
              spaceFilter === 'archived' && 'font-medium text-workspace-text'
            )}
            onClick={() => {
              onFilterChange('archived');
              setOpen(false);
            }}
          >
            {tSpaces('filterArchived')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
