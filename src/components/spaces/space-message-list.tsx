'use client';

import { useLazyVirtuosoSwap } from '@/hooks/use-lazy-virtuoso-swap';
import {
  StaticSpaceMessageRows,
  type SpaceMessageListBodyProps,
} from '@/components/spaces/space-message-static-rows';
import type { SpaceMessageVirtuosoProps } from '@/components/spaces/space-message-virtuoso';
import { loadSpaceMessageVirtuoso } from '@/lib/spaces/load-space-message-virtuoso';
import { shouldVirtualizeSpaceMessages } from '@/lib/spaces/space-message-virtualize';

/** Module-scope so useLazyVirtuosoSwap gets a referentially stable loader. */
function loadSpaceVirtuosoComponent() {
  return loadSpaceMessageVirtuoso().then((mod) => mod.SpaceMessageVirtuoso);
}

export type SpaceMessageListProps = SpaceMessageListBodyProps & {
  scrollParentRef: { readonly current: HTMLElement | null };
  /** Pin to the last bubble after Virtuoso swap (KAZI-588). */
  alignToLatest?: boolean;
  activationKey?: string;
};

/**
 * Keep StaticSpaceMessageRows mounted until the virtuoso chunk resolves.
 * A null loading slot blanked the thread at the 59→60 boundary and on
 * first paint of a long history (KAZI-574 R1).
 */
export function SpaceMessageList({
  messages,
  strategyContexts,
  scrollParentRef,
  locale,
  actionsDisabled,
  onRetryById,
  onNextAction,
  onFocusComposer,
  onExamSelect,
  onJobCardClick,
  alignToLatest = false,
  activationKey,
}: SpaceMessageListProps) {
  const virtualize = shouldVirtualizeSpaceMessages(messages.length);
  const { VirtuosoComponent: VirtuosoComp, showVirtuoso, preservedScrollTop } =
    useLazyVirtuosoSwap<SpaceMessageVirtuosoProps>(
      virtualize,
      loadSpaceVirtuosoComponent,
      scrollParentRef
    );

  const rowProps = {
    messages,
    strategyContexts,
    locale,
    actionsDisabled,
    onRetryById,
    onNextAction,
    onFocusComposer,
    onExamSelect,
    onJobCardClick,
  };

  if (!showVirtuoso || !VirtuosoComp) {
    return <StaticSpaceMessageRows {...rowProps} />;
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
