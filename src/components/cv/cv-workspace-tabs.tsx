'use client';

import { FileText, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type CvWorkspaceTab = 'resume' | 'chat';

interface CvWorkspaceTabsProps {
  active: CvWorkspaceTab;
  onChange: (tab: CvWorkspaceTab) => void;
  resumeReady?: boolean;
  className?: string;
}

/** Mobile activity rail — Cursor/VS Code style vertical panel switcher. */
export function CvWorkspaceTabs({
  active,
  onChange,
  resumeReady,
  className,
}: CvWorkspaceTabsProps) {
  const t = useTranslations('cv');

  const tabs: { id: CvWorkspaceTab; label: string; icon: typeof FileText }[] = [
    { id: 'chat', label: t('tabChat'), icon: MessageSquare },
    { id: 'resume', label: t('tabResume'), icon: FileText },
  ];

  return (
    <nav
      className={cn(
        'lg:hidden w-12 shrink-0 flex flex-col items-center gap-1 py-2',
        'bg-workspace-sidebar border-r border-workspace-border',
        className
      )}
      aria-label={t('workspacePanels')}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={selected ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={cn(
              'relative flex flex-col items-center justify-center w-10 h-10 rounded-md transition-colors',
              selected
                ? 'text-workspace-text bg-workspace-active'
                : 'text-workspace-muted hover:text-workspace-text hover:bg-workspace-hover'
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {id === 'resume' && resumeReady ? (
              <span
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-kazi-orange"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
