'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface SessionHeaderDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function SessionHeaderDrawer({
  open,
  title,
  onClose,
  children,
  className,
}: SessionHeaderDrawerProps) {
  const t = useTranslations('sessionNav');
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 bg-black/20"
        aria-label={t('closeDrawer')}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-header-drawer-title"
        className={cn(
          'absolute inset-x-0 top-12 z-40 max-h-[min(360px,50vh)] overflow-hidden border-b border-workspace-border bg-white shadow-lg',
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-workspace-hover px-4 py-2">
          <h2 id="session-header-drawer-title" className="text-sm font-semibold text-workspace-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-workspace-muted hover:bg-workspace-hover"
            aria-label={t('closeDrawer')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
