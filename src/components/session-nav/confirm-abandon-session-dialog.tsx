'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const agent = agentId
    ? AGENT_REGISTRY.find((entry) => entry.agentId === agentId)
    : undefined;
  const agentName = agent ? getAgentLabel(agent, locale, 'name') : agentId;

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
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
      previousFocusRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open || !agentId) return null;

  return (
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
          className="absolute right-4 top-4 text-[#86909C] hover:text-[#1D2129]"
          aria-label={t('confirmAbandonCancel')}
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="confirm-abandon-title" className="pr-8 text-lg font-semibold text-[#1D2129]">
          {t('confirmAbandonTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#4E5969]">
          {t('confirmAbandonBody', { agent: agentName ?? '' })}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelButtonRef} variant="ghost" onClick={onCancel}>
            {t('confirmAbandonCancel')}
          </Button>
          <Button onClick={onConfirm}>{t('confirmAbandonAction')}</Button>
        </div>
      </div>
    </div>
  );
}
