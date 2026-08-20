'use client';

import { cn } from '@/lib/utils';

/**
 * Id-only history row until scroll hydrates full body (KAZI-580).
 * Solid reserved height — not opacity / timeout hiding of real content.
 */
export function HistoryStubPlaceholder({
  id,
  role,
  className,
}: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  className?: string;
}) {
  return (
    <div
      data-testid="history-stub"
      data-history-stub={id}
      data-role={role}
      aria-busy="true"
      aria-label="Loading message"
      className={cn(
        'group flex min-h-[48px] w-full max-w-[85%] items-center justify-center rounded-2xl bg-[#F2F3F5]',
        'data-[failed=true]:cursor-pointer',
        role === 'user' ? 'ml-auto' : 'mr-auto',
        className
      )}
    >
      <span className="hidden text-xs text-[#86909C] group-data-[failed=true]:inline">
        Retry
      </span>
    </div>
  );
}
