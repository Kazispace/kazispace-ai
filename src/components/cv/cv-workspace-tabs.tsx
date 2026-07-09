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

/** Mobile-only: switch between resume document and chat. */
export function CvWorkspaceTabs({
  active,
  onChange,
  resumeReady,
  className,
}: CvWorkspaceTabsProps) {
  const t = useTranslations('cv');

  const tabs: { id: CvWorkspaceTab; label: string; icon: typeof FileText }[] = [
    { id: 'resume', label: t('tabResume'), icon: FileText },
    { id: 'chat', label: t('tabChat'), icon: MessageSquare },
  ];

  return (
    <div
      className={cn(
        'lg:hidden flex p-1 mx-4 mt-3 mb-1 bg-gray-100 rounded-xl border border-gray-200/80',
        className
      )}
      role="tablist"
    >
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
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors',
              selected
                ? 'bg-white text-kazi-navy shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{label}</span>
            {id === 'resume' && resumeReady ? (
              <span className="h-2 w-2 rounded-full bg-kazi-orange shrink-0" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
