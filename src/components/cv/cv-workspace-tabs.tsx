'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type CvWorkspaceTab = 'resume' | 'chat';

interface CvWorkspaceTabsProps {
  active: CvWorkspaceTab;
  onChange: (tab: CvWorkspaceTab) => void;
  resumeReady?: boolean;
  className?: string;
}

export function CvWorkspaceTabs({
  active,
  onChange,
  resumeReady,
  className,
}: CvWorkspaceTabsProps) {
  const t = useTranslations('cv');

  const tabs: { id: CvWorkspaceTab; label: string }[] = [
    { id: 'chat', label: t('tabChat') },
    { id: 'resume', label: t('tabResume') },
  ];

  return (
    <div
      className={cn('lg:hidden shrink-0 flex bg-white border-b border-gray-200/80', className)}
      role="tablist"
    >
      {tabs.map(({ id, label }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={cn(
              'relative flex-1 py-3 text-sm font-medium transition-colors',
              selected ? 'text-kazi-navy' : 'text-gray-500'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {label}
              {id === 'resume' && resumeReady ? (
                <span className="h-1.5 w-1.5 rounded-full bg-kazi-orange" aria-hidden />
              ) : null}
            </span>
            {selected ? (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-kazi-orange" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
