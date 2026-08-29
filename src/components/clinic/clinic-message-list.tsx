'use client';

import { useLazyVirtuosoSwap } from '@/hooks/use-lazy-virtuoso-swap';
import {
  StaticClinicMessageRows,
  type ClinicMessageListBodyProps,
} from '@/components/clinic/clinic-message-static-rows';
import type { ClinicMessageVirtuosoProps } from '@/components/clinic/clinic-message-virtuoso';
import { loadClinicMessageVirtuoso } from '@/lib/clinic/load-clinic-message-virtuoso';
import { shouldVirtualizeClinicMessages } from '@/lib/spaces/space-message-virtualize';

/** Module-scope so useLazyVirtuosoSwap gets a referentially stable loader. */
function loadClinicVirtuosoComponent() {
  return loadClinicMessageVirtuoso().then((mod) => mod.ClinicMessageVirtuoso);
}

export type ClinicMessageListProps = ClinicMessageListBodyProps & {
  scrollParentRef: { readonly current: HTMLElement | null };
  /** Pin to the last bubble after Virtuoso swap (KAZI-588). */
  alignToLatest?: boolean;
  activationKey?: string;
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
  alignToLatest = false,
  activationKey,
}: ClinicMessageListProps) {
  const virtualize = shouldVirtualizeClinicMessages(messages.length);
  const { VirtuosoComponent: VirtuosoComp, showVirtuoso, preservedScrollTop } =
    useLazyVirtuosoSwap<ClinicMessageVirtuosoProps>(
      virtualize,
      loadClinicVirtuosoComponent,
      scrollParentRef
    );

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
      initialScrollTop={preservedScrollTop}
      alignToLatest={alignToLatest}
      activationKey={activationKey}
    />
  );
}
