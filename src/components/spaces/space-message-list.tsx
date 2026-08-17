'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';

import {
  StaticSpaceMessageRows,
  type SpaceMessageListBodyProps,
} from '@/components/spaces/space-message-static-rows';
import type { SpaceMessageVirtuosoProps } from '@/components/spaces/space-message-virtuoso';
import { loadSpaceMessageVirtuoso } from '@/lib/spaces/load-space-message-virtuoso';
import { shouldVirtualizeSpaceMessages } from '@/lib/spaces/space-message-virtualize';

export type SpaceMessageListProps = SpaceMessageListBodyProps & {
  scrollParentRef: { readonly current: HTMLElement | null };
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
}: SpaceMessageListProps) {
  const virtualize = shouldVirtualizeSpaceMessages(messages.length);
  const [VirtuosoComp, setVirtuosoComp] = useState<ComponentType<
    SpaceMessageVirtuosoProps
  > | null>(null);
  const showingVirtuosoRef = useRef(false);
  const preservedScrollTopRef = useRef(0);

  useEffect(() => {
    if (!virtualize || VirtuosoComp) return;
    let cancelled = false;
    void loadSpaceMessageVirtuoso()
      .then((mod) => {
        if (!cancelled) setVirtuosoComp(() => mod.SpaceMessageVirtuoso);
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
      initialScrollTop={preservedScrollTopRef.current}
    />
  );
}
