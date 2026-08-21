'use client';

import { Button } from '@/components/ui/button';

export function ChatHistoryLoadError({
  message,
  retryLabel,
  onRetry,
  disabled = false,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-gray-500">
      <p className="text-sm text-red-600">{message}</p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onRetry}
        disabled={disabled}
      >
        {retryLabel}
      </Button>
    </div>
  );
}
