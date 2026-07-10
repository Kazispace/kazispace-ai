'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AgentSessionList } from '@/components/agent/agent-session-list';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentSessionSummary } from '@/types';

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
  className,
}: AgentSessionPanelProps) {
  const t = useTranslations('agentSessions');

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
        className={cn(
          'fixed z-50 top-0 right-0 h-full w-[min(100%,280px)] flex flex-col bg-white shadow-xl border-l border-gray-200/80',
          'lg:absolute lg:top-0 lg:right-0 lg:h-full lg:shadow-none',
          className
        )}
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
