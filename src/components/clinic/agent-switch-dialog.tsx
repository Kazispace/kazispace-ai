'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';

interface AgentSwitchDialogProps {
  locale: string;
  fromAgentId: string;
  toAgentId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export function AgentSwitchDialog({
  locale,
  fromAgentId,
  toAgentId,
  onConfirm,
  onCancel,
  isConfirming,
}: AgentSwitchDialogProps) {
  const t = useTranslations('clinic');
  const fromEntry = AGENT_REGISTRY.find((a) => a.agentId === fromAgentId);
  const toEntry = AGENT_REGISTRY.find((a) => a.agentId === toAgentId);
  const fromName = fromEntry
    ? getAgentLabel(fromEntry, locale, 'name')
    : fromAgentId;
  const toName = toEntry ? getAgentLabel(toEntry, locale, 'name') : toAgentId;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // useDialogFocusTrap reads onClose via an internal ref (KAZI-652), so this
  // no longer needs to be referentially stable across renders — it only
  // needs to check the *current* isConfirming on each call, which a plain
  // closure over props already does correctly.
  const handleClose = () => {
    // Match the disabled close button: Escape must not let the dialog
    // unmount while confirmPendingAgentSwitch() is still in flight, or the
    // activate can finish in the background with no dialog left to show it.
    if (isConfirming) return;
    onCancel();
  };

  useDialogFocusTrap({
    open: true,
    onClose: handleClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  // Portal to <body> (KAZI-664, matching KAZI-652's ConfirmDialog): this
  // dialog is mounted from clinic-shell.tsx, which today isn't inside any
  // overflow-hidden/transform ancestor, but nothing structurally prevents
  // that from changing later — portaling all 5 dialogs consistently means
  // a future refactor can't silently reintroduce the clipping bug KAZI-652
  // fixed for the other two.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-switch-title"
    >
      <div ref={dialogRef} className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 relative">
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onCancel}
          disabled={isConfirming}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          aria-label={t('switchConfirmCancel')}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="agent-switch-title" className="text-xl font-bold text-kazi-navy pr-8">
          {t('switchConfirmTitle')}
        </h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {t('switchConfirmBody', { currentName: fromName, targetName: toName })}
        </p>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={isConfirming}>
            {t('switchConfirmCancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isConfirming}>
            {t('switchConfirmAction', { targetName: toName })}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
