'use client';

import { useLazyVirtuosoSwap } from '@/hooks/use-lazy-virtuoso-swap';
import {
  StaticHubMessageRows,
  type HubMessageListBodyProps,
} from '@/components/chat/hub-message-static-rows';
import type { HubMessageVirtuosoProps } from '@/components/chat/hub-message-virtuoso';
import { loadHubMessageVirtuoso } from '@/lib/chat/load-hub-message-virtuoso';
import { shouldVirtualizeHubMessages } from '@/lib/spaces/space-message-virtualize';

/** Module-scope so useLazyVirtuosoSwap gets a referentially stable loader. */
function loadHubVirtuosoComponent() {
  return loadHubMessageVirtuoso().then((mod) => mod.HubMessageVirtuoso);
}

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
  header,
  scrollParentRef,
}: HubMessageListProps) {
  const virtualize = shouldVirtualizeHubMessages(messages.length);
  const { VirtuosoComponent: VirtuosoComp, showVirtuoso, preservedScrollTop } =
    useLazyVirtuosoSwap<HubMessageVirtuosoProps>(
      virtualize,
      loadHubVirtuosoComponent,
      scrollParentRef
    );

  const rowProps = { messages, locale, isStreaming, header };

  if (!showVirtuoso || !VirtuosoComp) {
    return <StaticHubMessageRows {...rowProps} />;
  }

  return (
    <VirtuosoComp
      {...rowProps}
      scrollParentRef={scrollParentRef}
      initialScrollTop={preservedScrollTop}
    />
  );
}
