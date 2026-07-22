'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import {
  StarterCapabilityToolbar,
  StarterExampleStrip,
  type StarterPromptsController,
} from '@/components/spaces/starter-prompts-bar';
import {
  readClinicStarterCollapsed,
  resolveClinicStarterConfig,
  resolveStarterCollapsed,
  shouldHideClinicStarterForQuickReplies,
  writeClinicStarterCollapsed,
} from '@/lib/clinic/starter-prompts/config';
import type { SpaceStarterConfig } from '@/lib/spaces/starter-prompts/types';
import { readCachedMasterSessionId } from '@/lib/master-session';
import { useChatStore } from '@/lib/store';

export { resolveLatestClinicNextActions } from '@/lib/clinic/starter-prompts/clinic-nba';

export {
  shouldHideClinicStarterForQuickReplies,
};

export function useClinicStarterPromptsController(
  hasUserMessage: boolean
): StarterPromptsController | null {
  const panelId = useId();
  const storeSessionId = useChatStore((s) => s.currentSessionId);
  const clinicSessionId =
    storeSessionId ?? readCachedMasterSessionId() ?? 'pending';

  const cfg = useMemo(() => resolveClinicStarterConfig(), []);
  const [hydrated, setHydrated] = useState(false);
  const [examplesCollapsed, setExamplesCollapsed] = useState(false);

  useEffect(() => {
    const stored = readClinicStarterCollapsed(clinicSessionId);
    const next = resolveStarterCollapsed({ hasUserMessage, stored });
    setExamplesCollapsed(next);
    if (stored === null && hasUserMessage && next) {
      writeClinicStarterCollapsed(clinicSessionId, true);
    }
    setHydrated(true);
  }, [clinicSessionId, hasUserMessage]);

  if (!cfg) return null;

  return {
    cfg,
    hydrated,
    examplesCollapsed,
    setExamplesCollapsed: (next: boolean) => {
      setExamplesCollapsed(next);
      writeClinicStarterCollapsed(clinicSessionId, next);
    },
    panelId,
  };
}

export function ClinicStarterCapabilityToolbar({
  cfg,
  disabled,
}: {
  cfg: SpaceStarterConfig;
  disabled?: boolean;
}) {
  return (
    <StarterCapabilityToolbar
      cfg={cfg}
      disabled={disabled}
      insertTarget="clinic"
      i18nNamespace="clinic"
    />
  );
}

export function ClinicStarterExampleStrip({
  cfg,
  panelId,
  collapsed,
  disabled,
  onToggleCollapsed,
  onSendExample,
}: {
  cfg: SpaceStarterConfig;
  panelId: string;
  collapsed: boolean;
  disabled?: boolean;
  onToggleCollapsed: (next: boolean) => void;
  onSendExample: (text: string) => void;
}) {
  return (
    <StarterExampleStrip
      cfg={cfg}
      panelId={panelId}
      collapsed={collapsed}
      disabled={disabled}
      onToggleCollapsed={onToggleCollapsed}
      onSendExample={onSendExample}
      i18nNamespace="clinic"
    />
  );
}
