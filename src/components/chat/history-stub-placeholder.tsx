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
        'min-h-[48px] w-full max-w-[85%] rounded-2xl bg-[#F2F3F5]',
        role === 'user' ? 'ml-auto' : 'mr-auto',
        className
      )}
    />
  );
}
