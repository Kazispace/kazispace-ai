'use client';

import { memo, useCallback, useMemo } from 'react';

import { HistoryStubPlaceholder } from '@/components/chat/history-stub-placeholder';
import { MessageBubble } from '@/components/clinic/message-bubble';
import { isHistoryStub } from '@/lib/chat/history-window';
import {
  AGENT_REGISTRY,
  getAgentLabel,
} from '@/lib/agents/registry';
import type { StrategySelectTurnContext } from '@/lib/strategy-select';
import type { SpaceNudgePayload } from '@/lib/spaces/space-nudge';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { ChatJobCard, ChatMessage, ChatNextAction } from '@/types';
import type { ExamPickerOption } from '@/types/english-tutor-envelope';

export type ClinicMessageRowProps = {
  /**
   * KAZI-651 Phase C.1b: Clinic's own messages now live in the same
   * per-space slice shape Space uses (`SpaceChatMessage`) — this row never
   * read `.timestamp`/`.sessionId` (the two fields that shape lacks), so
   * that side is a no-op retype. Still a union with `ChatMessage`, not a
   * clean swap: `isAgentMode` renders Hub agent messages through this same
   * row (`agent-slice.ts`, untouched by this migration, still `ChatMessage[]`)
   * — every `.role` read below already narrows defensively
   * (`message.role === 'user' ? 'user' : 'assistant'`), so the union is safe.
   */
  message: SpaceChatMessage | ChatMessage;
  strategy: StrategySelectTurnContext;
  locale: string;
  isAgentMode: boolean;
  isStreamingEmpty: boolean;
  actionsDisabled: boolean;
  referralDisabled: boolean;
  onRetryById: (messageId: string) => void;
  onReferralAccept: (agentId: string, messageId: string) => void;
  onReferralDismiss: (agentId: string, messageId: string) => void;
  onSpaceNudgeAccept: (nudge: SpaceNudgePayload, messageId: string) => void;
  onSpaceNudgeDismiss: (nudge: SpaceNudgePayload, messageId: string) => void;
  onUpgradeResearch: (messageId: string) => void;
  onNextAction: (action: ChatNextAction) => void;
  onFocusComposer: () => void;
  onExamSelect: (option: ExamPickerOption) => void;
  onJobCardClick: (card: ChatJobCard) => void;
};

function clinicMessageRowEqual(
  prev: ClinicMessageRowProps,
  next: ClinicMessageRowProps
): boolean {
  return (
    prev.message === next.message &&
    prev.strategy.activeNextActions === next.strategy.activeNextActions &&
    prev.strategy.selectedStrategyPayload ===
      next.strategy.selectedStrategyPayload &&
    prev.locale === next.locale &&
    prev.isAgentMode === next.isAgentMode &&
    prev.isStreamingEmpty === next.isStreamingEmpty &&
    prev.actionsDisabled === next.actionsDisabled &&
    prev.referralDisabled === next.referralDisabled &&
    prev.onRetryById === next.onRetryById &&
    prev.onReferralAccept === next.onReferralAccept &&
    prev.onReferralDismiss === next.onReferralDismiss &&
    prev.onSpaceNudgeAccept === next.onSpaceNudgeAccept &&
    prev.onSpaceNudgeDismiss === next.onSpaceNudgeDismiss &&
    prev.onUpgradeResearch === next.onUpgradeResearch &&
    prev.onNextAction === next.onNextAction &&
    prev.onFocusComposer === next.onFocusComposer &&
    prev.onExamSelect === next.onExamSelect &&
    prev.onJobCardClick === next.onJobCardClick
  );
}

function ClinicMessageRowImpl({
  message,
  strategy,
  locale,
  isAgentMode,
  isStreamingEmpty,
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
}: ClinicMessageRowProps) {
  const referralEntry = useMemo(
    () =>
      message.referral
        ? AGENT_REGISTRY.find((a) => a.agentId === message.referral?.agentId)
        : undefined,
    [message.referral]
  );

  const handleRetry = useCallback(() => {
    onRetryById(message.id);
  }, [message.id, onRetryById]);

  const handleReferralAccept = useCallback(() => {
    if (message.referral) {
      onReferralAccept(message.referral.agentId, message.id);
    }
  }, [message.id, message.referral, onReferralAccept]);

  const handleReferralDismiss = useCallback(() => {
    if (message.referral) {
      onReferralDismiss(message.referral.agentId, message.id);
    }
  }, [message.id, message.referral, onReferralDismiss]);

  const handleSpaceNudgeAccept = useCallback(() => {
    if (message.spaceNudge) {
      onSpaceNudgeAccept(message.spaceNudge, message.id);
    }
  }, [message.id, message.spaceNudge, onSpaceNudgeAccept]);

  const handleSpaceNudgeDismiss = useCallback(() => {
    if (message.spaceNudge) {
      onSpaceNudgeDismiss(message.spaceNudge, message.id);
    }
  }, [message.id, message.spaceNudge, onSpaceNudgeDismiss]);

  const handleUpgradeResearch = useCallback(() => {
    onUpgradeResearch(message.id);
  }, [message.id, onUpgradeResearch]);

  if (isHistoryStub(message)) {
    return (
      <HistoryStubPlaceholder
        id={message.id}
        role={message.role === 'user' ? 'user' : 'assistant'}
      />
    );
  }

  return (
    <MessageBubble
      role={message.role === 'user' ? 'user' : 'assistant'}
      content={message.content}
      messageId={message.id}
      serverMessageId={message.serverMessageId}
      feedbackEnabled={!isAgentMode}
      intent={message.intent}
      status={message.status}
      referral={message.referral}
      spaceNudge={!isAgentMode ? message.spaceNudge : undefined}
      nextActions={message.nextActions}
      selectedStrategyPayload={strategy.selectedStrategyPayload}
      assistantMeta={message.assistantMeta}
      cards={message.cards}
      citations={message.citations}
      customComponents={message.customComponents}
      upgradeCta={!isAgentMode ? message.upgradeCta : undefined}
      capabilityId={!isAgentMode ? message.capabilityId : undefined}
      playbookId={!isAgentMode ? message.playbookId : undefined}
      pendingCapability={!isAgentMode ? message.pendingCapability : undefined}
      composerTarget="clinic"
      locale={locale}
      streamComplete={message.streamComplete ?? true}
      isStreaming={isStreamingEmpty}
      variant={isAgentMode ? 'agent' : 'clinic'}
      agentEmoji={referralEntry?.emoji}
      agentName={
        referralEntry
          ? getAgentLabel(referralEntry, locale, 'name')
          : undefined
      }
      onRetry={
        !isAgentMode && message.role === 'user' && message.status === 'failed'
          ? handleRetry
          : undefined
      }
      onReferralAccept={
        message.referral && !message.referral.dismissed
          ? handleReferralAccept
          : undefined
      }
      onReferralDismiss={
        message.referral && !message.referral.dismissed
          ? handleReferralDismiss
          : undefined
      }
      onSpaceNudgeAccept={
        !isAgentMode && message.spaceNudge && !message.spaceNudge.dismissed
          ? handleSpaceNudgeAccept
          : undefined
      }
      onSpaceNudgeDismiss={
        !isAgentMode && message.spaceNudge && !message.spaceNudge.dismissed
          ? handleSpaceNudgeDismiss
          : undefined
      }
      onUpgradeResearch={
        !isAgentMode && message.upgradeCta && !message.upgradeCta.dismissed
          ? handleUpgradeResearch
          : undefined
      }
      referralDisabled={referralDisabled}
      onNextAction={strategy.activeNextActions ? onNextAction : undefined}
      onFocusComposer={onFocusComposer}
      onExamSelect={onExamSelect}
      onJobCardClick={onJobCardClick}
      actionsDisabled={actionsDisabled}
    />
  );
}

export const ClinicMessageRow = memo(
  ClinicMessageRowImpl,
  clinicMessageRowEqual
);

export { clinicMessageRowEqual };
