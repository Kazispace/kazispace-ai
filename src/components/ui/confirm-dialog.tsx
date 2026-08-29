'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Use destructive styling for the confirm button. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useDialogFocusTrap({
    open,
    onClose: onCancel,
    dialogRef,
    initialFocusRef: cancelButtonRef,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label={cancelLabel}
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 text-workspace-muted hover:text-workspace-text"
          aria-label={cancelLabel}
        >
          <X className="h-5 w-5" />
        </button>
        <h2
          id="confirm-dialog-title"
          className="pr-8 text-lg font-semibold text-workspace-text"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm leading-relaxed text-workspace-secondary"
        >
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelButtonRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            className={cn(destructive && 'bg-red-500 hover:bg-red-600')}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
