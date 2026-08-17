'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';

import {
  StaticClinicMessageRows,
  type ClinicMessageListBodyProps,
} from '@/components/clinic/clinic-message-static-rows';
import type { ClinicMessageVirtuosoProps } from '@/components/clinic/clinic-message-virtuoso';
import { loadClinicMessageVirtuoso } from '@/lib/clinic/load-clinic-message-virtuoso';
import { shouldVirtualizeClinicMessages } from '@/lib/spaces/space-message-virtualize';

export type ClinicMessageListProps = ClinicMessageListBodyProps & {
  scrollParentRef: { readonly current: HTMLElement | null };
};

/**
 * Keep StaticClinicMessageRows mounted until the virtuoso chunk resolves.
 * Public welcome / short threads never start the import (KAZI-575).
 */
export function ClinicMessageList({
  messages,
  strategyContexts,
  isStreaming,
  scrollParentRef,
  locale,
  isAgentMode,
  actionsDisabled,
  referralDisabled,
  onRetryById,
  onReferralAccept,
  onReferralDismiss,
  onSpaceNudgeAccept,
  onSpaceNudgeDismiss,
  onUpgradeResearch,
  onNextAction,
  onFocusComposer,
  onExamSelect,
  onJobCardClick,
}: ClinicMessageListProps) {
  const virtualize = shouldVirtualizeClinicMessages(messages.length);
  const [VirtuosoComp, setVirtuosoComp] = useState<ComponentType<
    ClinicMessageVirtuosoProps
  > | null>(null);
  const showingVirtuosoRef = useRef(false);
  const preservedScrollTopRef = useRef(0);

  useEffect(() => {
    if (!virtualize || VirtuosoComp) return;
    let cancelled = false;
    void loadClinicMessageVirtuoso()
      .then((mod) => {
        if (!cancelled) setVirtuosoComp(() => mod.ClinicMessageVirtuoso);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [virtualize, VirtuosoComp]);

  const showVirtuoso = virtualize && VirtuosoComp != null;
  if (showVirtuoso && !showingVirtuosoRef.current) {
    preservedScrollTopRef.current = scrollParentRef.current?.scrollTop ?? 0;
  }
  showingVirtuosoRef.current = showVirtuoso;

  const rowProps = {
    messages,
    strategyContexts,
    isStreaming,
    locale,
    isAgentMode,
    actionsDisabled,
    referralDisabled,
    onRetryById,
    onReferralAccept,
    onReferralDismiss,
    onSpaceNudgeAccept,
    onSpaceNudgeDismiss,
    onUpgradeResearch,
    onNextAction,
    onFocusComposer,
    onExamSelect,
    onJobCardClick,
  };

  if (!showVirtuoso || !VirtuosoComp) {
    return <StaticClinicMessageRows {...rowProps} />;
  }

  return (
    <VirtuosoComp
      {...rowProps}
      scrollParentRef={scrollParentRef}
      initialScrollTop={preservedScrollTopRef.current}
    />
  );
}
