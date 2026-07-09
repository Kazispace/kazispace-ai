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

/** Mobile top tabs — Coze H5 style segmented control. */
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
    <div
      className={cn(
        'lg:hidden shrink-0 px-3 py-2 bg-white border-b border-workspace-border',
        className
      )}
      role="tablist"
      aria-label={t('workspacePanels')}
    >
      <div className="flex p-1 rounded-xl bg-workspace-bg border border-workspace-border">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                selected
                  ? 'bg-white text-workspace-text shadow-sm'
                  : 'text-workspace-muted hover:text-workspace-text'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{label}</span>
              {id === 'resume' && resumeReady ? (
                <span className="h-1.5 w-1.5 rounded-full bg-kazi-orange shrink-0" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
