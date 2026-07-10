'use client';

import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { AgentSessionList } from '@/components/agent/agent-session-list';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentSessionSummary } from '@/types';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface AgentSessionPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sessions: AgentSessionSummary[];
  activeSessionId: string | null;
  isLoading?: boolean;
  disabled?: boolean;
  onSelect: (sessionId: string) => void;
  onNew?: () => void;
  newLabel?: string;
  /** Desktop top offset when panel is `lg:absolute` (e.g. below a sticky header). */
  topOffset?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function AgentSessionPanel({
  open,
  onClose,
  title,
  sessions,
  activeSessionId,
  isLoading,
  disabled,
  onSelect,
  onNew,
  newLabel,
  topOffset,
  returnFocusRef,
  className,
}: AgentSessionPanelProps) {
  const t = useTranslations('agentSessions');
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      returnFocusRef?.current ??
      (document.activeElement as HTMLElement | null);
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const restore = returnFocusRef?.current ?? previousFocusRef.current;
      restore?.focus();
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30 lg:bg-transparent"
        aria-label={t('closeHistory')}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className={cn(
          'fixed z-50 top-0 right-0 h-full w-[min(100%,280px)] flex flex-col bg-white shadow-xl border-l border-gray-200/80',
          'lg:absolute lg:right-0 lg:h-full lg:shadow-none',
          topOffset ? 'lg:top-[var(--panel-top)]' : 'lg:top-0',
          className
        )}
        style={
          topOffset ? { ['--panel-top' as string]: topOffset } : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-session-panel-title"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-100 shrink-0">
          <h2
            id="agent-session-panel-title"
            className="text-sm font-semibold text-kazi-navy truncate"
          >
            {title}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {onNew ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-500 hover:text-kazi-orange"
                disabled={disabled}
                onClick={onNew}
                aria-label={newLabel ?? t('newSession')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              ref={closeButtonRef}
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-gray-500"
              onClick={onClose}
              aria-label={t('closeHistory')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          <AgentSessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={isLoading}
            disabled={disabled}
            onSelect={(id) => {
              onSelect(id);
              onClose();
            }}
          />
        </div>
      </aside>
    </>
  );
}
