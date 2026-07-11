'use client';

import type { ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDeactivateToClinic } from '@/hooks/use-deactivate-to-clinic';
import { useUIStore } from '@/lib/store';
import { useTranslations } from 'next-intl';

type BackToClinicButtonProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  locale: string;
  agentId?: string;
  showReturnMessage?: boolean;
};

export function BackToClinicButton({
  locale,
  agentId,
  showReturnMessage = true,
  children,
  disabled,
  ...buttonProps
}: BackToClinicButtonProps) {
  const tClinic = useTranslations('clinic');
  const showToast = useUIStore((s) => s.showToast);
  const { deactivateAndGo, isDeactivating } = useDeactivateToClinic(locale);

  return (
    <Button
      type="button"
      disabled={disabled || isDeactivating}
      onClick={() => {
        void deactivateAndGo({
          agentId,
          showReturnMessage,
          bestEffort: Boolean(agentId),
        }).then((result) => {
          if (result && !result.ok) {
            showToast(tClinic('deactivateFailed'), 'error');
          }
        });
      }}
      {...buttonProps}
    >
      {isDeactivating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
