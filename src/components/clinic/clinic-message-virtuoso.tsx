'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { ClinicMessageRow } from '@/components/clinic/clinic-message-row';
import {
  StaticClinicMessageRows,
  type ClinicMessageListBodyProps,
} from '@/components/clinic/clinic-message-static-rows';
import {
  pinChatScrollToLatest,
  shouldPinChatScrollToLatest,
} from '@/lib/spaces/chat-scroll';
import {
  SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT,
  SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
} from '@/lib/spaces/perf-policy';
import { restoreSpaceChatScrollAfterVirtualize } from '@/lib/spaces/space-message-virtualize';

export type ClinicMessageVirtuosoProps = ClinicMessageListBodyProps & {
  /** Existing Clinic overflow node — do not invent a second scroller. */
  scrollParentRef: { readonly current: HTMLElement | null };
  /** Parent scrollTop captured before static rows unmount. */
  initialScrollTop?: number;
  /** Ignore pixel restore; pin the parent to the last item (KAZI-588). */
  alignToLatest?: boolean;
  /** Keep-alive show retriggers pin; do not pin while `idle` (zero height). */
  activationKey?: string;
};

/**
 * Variable-height Clinic bubbles inside the existing useChatScroll parent
 * (KAZI-575). follow / jump-to-latest / restore stay on that element.
 */
export function ClinicMessageVirtuoso({
  messages,
  strategyContexts,
  isStreaming,
  scrollParentRef,
  initialScrollTop = 0,
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
  activationKey = 'default',
}: ClinicMessageVirtuosoProps) {
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(
    () => scrollParentRef.current
  );
  const restoredRef = useRef(false);
  const initialTopMostRef = useRef<number | { index: number; align: 'end' }>(0);
  const didFreezeInitialRef = useRef(false);
  if (alignToLatest && messages.length > 0 && !didFreezeInitialRef.current) {
    didFreezeInitialRef.current = true;
    initialTopMostRef.current = {
      index: messages.length - 1,
      align: 'end',
    };
  }

  useLayoutEffect(() => {
    const node = scrollParentRef.current;
    setScrollParent((prev) => (prev === node ? prev : node));
  }, [scrollParentRef]);

  useLayoutEffect(() => {
    restoredRef.current = false;
  }, [activationKey]);

  const tryRestore = useCallback(() => {
    if (!scrollParent) return;
    if (alignToLatest) {
      if (
        !shouldPinChatScrollToLatest({
          alignToLatest,
          activationKey,
          alreadyPinned: restoredRef.current,
          hasOverflow: scrollParent.scrollHeight > scrollParent.clientHeight,
        })
      ) {
        return;
      }
      pinChatScrollToLatest(scrollParent);
      restoredRef.current = true;
      return;
    }
    if (restoredRef.current) return;
    if (restoreSpaceChatScrollAfterVirtualize(scrollParent, initialScrollTop)) {
      restoredRef.current = true;
    }
  }, [activationKey, alignToLatest, initialScrollTop, scrollParent]);

  useLayoutEffect(() => {
    tryRestore();
  }, [messages.length, tryRestore]);

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

  if (!scrollParent) {
    return <StaticClinicMessageRows {...rowProps} />;
  }

  return (
    <Virtuoso
      data={messages}
      customScrollParent={scrollParent}
      defaultItemHeight={SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT}
      increaseViewportBy={{
        top: SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
        bottom: SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN,
      }}
      computeItemKey={(_, message) => message.id}
      initialTopMostItemIndex={initialTopMostRef.current}
      totalListHeightChanged={tryRestore}
      itemContent={(index, message) => (
        <div className={index < messages.length - 1 ? 'pb-4' : undefined}>
          <ClinicMessageRow
            message={message}
            strategy={strategyContexts[index] ?? {}}
            locale={locale}
            isAgentMode={isAgentMode}
            isStreamingEmpty={isStreaming && message.content === ''}
            actionsDisabled={actionsDisabled}
            referralDisabled={referralDisabled}
            onRetryById={onRetryById}
            onReferralAccept={onReferralAccept}
            onReferralDismiss={onReferralDismiss}
            onSpaceNudgeAccept={onSpaceNudgeAccept}
            onSpaceNudgeDismiss={onSpaceNudgeDismiss}
            onUpgradeResearch={onUpgradeResearch}
            onNextAction={onNextAction}
            onFocusComposer={onFocusComposer}
            onExamSelect={onExamSelect}
            onJobCardClick={onJobCardClick}
          />
        </div>
      )}
    />
  );
}
