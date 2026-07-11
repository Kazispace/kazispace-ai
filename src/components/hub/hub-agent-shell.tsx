'use client';

import { type ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface HubAgentShellProps {
  /** Optional hub sub-header (title, reset, status). */
  header?: ReactNode;
  /** Optional progress strip below header. */
  progress?: ReactNode;
  /** Primary conversation column. */
  children: ReactNode;
  /** Optional workspace attachment (§19.3.1). */
  workspace?: ReactNode;
  /** Chat composer pinned to shell bottom. */
  input?: ReactNode;
  className?: string;
}

export function HubAgentShell({
  header,
  progress,
  children,
  workspace,
  input,
  className,
}: HubAgentShellProps) {
  const t = useTranslations('hub');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const hasWorkspace = workspace != null;

  return (
    <div className={cn('flex-1 flex flex-col min-h-0', className)}>
      {header}
      {progress}

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">{children}</div>

        {hasWorkspace ? (
          <aside className="hidden md:flex w-72 shrink-0 border-l border-gray-200 bg-white flex-col overflow-y-auto">
            {workspace}
          </aside>
        ) : null}
      </div>

      {hasWorkspace ? (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setWorkspaceOpen((open) => !open)}
            className="w-full px-4 py-2 text-xs font-medium text-kazi-orange text-left"
          >
            {workspaceOpen ? t('workspaceCollapse') : t('workspaceExpand')}
          </button>
          {workspaceOpen ? (
            <div className="max-h-48 overflow-y-auto border-t border-gray-100">{workspace}</div>
          ) : null}
        </div>
      ) : null}

      {input}
    </div>
  );
}
