'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';

interface ConfirmAbandonSessionDialogProps {
  open: boolean;
  agentId: string | null;
  locale: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmAbandonSessionDialog({
  open,
  agentId,
  locale,
  onConfirm,
  onCancel,
}: ConfirmAbandonSessionDialogProps) {
  const t = useTranslations('sessionNav');
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const agent = agentId
    ? AGENT_REGISTRY.find((entry) => entry.agentId === agentId)
    : undefined;
  const agentName = agent ? getAgentLabel(agent, locale, 'name') : agentId;

  useDialogFocusTrap({
    open,
    onClose: onCancel,
    dialogRef,
    initialFocusRef: cancelButtonRef,
  });

  if (!open) return null;
  // Portal to <body>: callers mount this inside scrollable/overflow-hidden
  // panels (e.g. a mobile session-nav drawer), which would otherwise become
  // this dialog's `fixed`-position containing block and risk clipping the
  // overlay instead of covering the full viewport.
  if (typeof document === 'undefined') return null;

  const title = t('confirmAbandonTitle');
  const body = t('confirmAbandonBody', {
    agent: agentName ?? t('confirmAbandonFallbackAgent'),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t('confirmAbandonCancel')}
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-abandon-title"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 text-workspace-muted hover:text-workspace-text"
          aria-label={t('confirmAbandonCancel')}
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="confirm-abandon-title" className="pr-8 text-lg font-semibold text-workspace-text">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-workspace-secondary">{body}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelButtonRef} variant="ghost" onClick={onCancel}>
            {t('confirmAbandonCancel')}
          </Button>
          <Button onClick={onConfirm}>{t('confirmAbandonAction')}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
