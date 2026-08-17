'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';

import {
  StaticHubMessageRows,
  type HubMessageListBodyProps,
} from '@/components/chat/hub-message-static-rows';
import type { HubMessageVirtuosoProps } from '@/components/chat/hub-message-virtuoso';
import { loadHubMessageVirtuoso } from '@/lib/chat/load-hub-message-virtuoso';
import { shouldVirtualizeHubMessages } from '@/lib/spaces/space-message-virtualize';

export type HubMessageListProps = HubMessageListBodyProps & {
  scrollParentRef: { readonly current: HTMLElement | null };
};

/**
 * Keep StaticHubMessageRows mounted until the virtuoso chunk resolves.
 * Short Interview / English threads never start the import (KAZI-576).
 */
export function HubMessageList({
  messages,
  locale,
  isStreaming,
  scrollParentRef,
}: HubMessageListProps) {
  const virtualize = shouldVirtualizeHubMessages(messages.length);
  const [VirtuosoComp, setVirtuosoComp] = useState<ComponentType<
    HubMessageVirtuosoProps
  > | null>(null);
  const showingVirtuosoRef = useRef(false);
  const preservedScrollTopRef = useRef(0);

  useEffect(() => {
    if (!virtualize || VirtuosoComp) return;
    let cancelled = false;
    void loadHubMessageVirtuoso()
      .then((mod) => {
        if (!cancelled) setVirtuosoComp(() => mod.HubMessageVirtuoso);
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

  const rowProps = { messages, locale, isStreaming };

  if (!showVirtuoso || !VirtuosoComp) {
    return <StaticHubMessageRows {...rowProps} />;
  }

  return (
    <VirtuosoComp
      {...rowProps}
      scrollParentRef={scrollParentRef}
      initialScrollTop={preservedScrollTopRef.current}
    />
  );
}
