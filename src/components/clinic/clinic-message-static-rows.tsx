'use client';

import {
  ClinicMessageRow,
  type ClinicMessageRowProps,
} from '@/components/clinic/clinic-message-row';
import type { StrategySelectTurnContext } from '@/lib/strategy-select';
import type { ChatMessage } from '@/types';

export type ClinicMessageListBodyProps = {
  messages: ChatMessage[];
  strategyContexts: StrategySelectTurnContext[];
  isStreaming: boolean;
} & Omit<ClinicMessageRowProps, 'message' | 'strategy' | 'isStreamingEmpty'>;

/** Shared map used by short threads and as the Virtuoso loading/failure fallback. */
export function StaticClinicMessageRows({
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
}: ClinicMessageListBodyProps) {
  return (
    <>
      {messages.map((message, messageIndex) => (
        <ClinicMessageRow
          key={message.id}
          message={message}
          strategy={strategyContexts[messageIndex] ?? {}}
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
      ))}
    </>
  );
}
