'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LayerIndicator } from '@/components/clinic/layer-indicator';
import { useAgentTransition } from '@/components/agent-transition/agent-transition-provider';
import { Button } from '@/components/ui/button';

interface HubLayerBarProps {
  locale: string;
}

/** Hub manual Path B entry — Layer breadcrumb + Switcher (+). */
export function HubLayerBar({ locale }: HubLayerBarProps) {
  const t = useTranslations('clinic');
  const { activeAgentId, isSwitching, statusBadge, openSwitcher, returnToClinic } =
    useAgentTransition();

  return (
    <div className="shrink-0 flex items-stretch bg-white border-b border-gray-200/80">
      <LayerIndicator
        locale={locale}
        activeAgentId={activeAgentId}
        statusDetail={statusBadge}
        onClinicClick={() => void returnToClinic()}
        className="flex-1 border-b-0 min-w-0"
      />
      <div className="flex items-center pr-3 shrink-0">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-full"
          onClick={openSwitcher}
          disabled={isSwitching}
          aria-label={t('switchExpert')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
