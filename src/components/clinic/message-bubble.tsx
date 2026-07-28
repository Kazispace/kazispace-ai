"use client";

import { useTranslations } from "next-intl";
import { Bot, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/constants";
import { CitationList } from "./citation-list";
import { ChatJobTeasers } from "./chat-job-teasers";
import { ChatNextActions } from "./chat-next-actions";
import { MarkdownContent } from "./markdown-content";
import { MessageActions } from "./message-actions";
import { ReferralPrompt } from "./referral-prompt";
import { SpaceNudgePrompt } from "./space-nudge-prompt";
import { UpgradeResearchCta } from "./upgrade-research-cta";
import { SearchCapabilityChip } from "./search-capability-chip";
import { StreamingText } from "@/components/chat/streaming-text";
import {
  stripMarkdownSourcesSection,
  type CitationItem,
} from "@/lib/clinic/citation-list";
import type { UpgradeCtaPayload } from "@/lib/clinic/upgrade-cta";
import {
  isSearchCapability,
  type SearchCapabilityId,
} from "@/lib/clinic/search-capability";
import type { ComposerInsertTarget } from "@/lib/store";
import { isPlaceholderReply } from "@/lib/spaces/turn";
import type { SpaceNudgePayload } from "@/lib/spaces/space-nudge";
import type { ChatJobCard, ChatNextAction, ReferralPayload } from "@/types";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  /** Local / display message id. */
  messageId?: string;
  /** Persisted chat_messages.id for feedback API (KAZI-254). */
  serverMessageId?: string;
  /** Agent Hub: hide thumbs until OQ-1 (surface:agent). */
  feedbackEnabled?: boolean;
  name?: string;
  intent?: string;
  isStreaming?: boolean;
  variant?: "clinic" | "agent";
  surface?: "default" | "workspace";
  status?: "sending" | "sent" | "failed";
  referral?: ReferralPayload;
  spaceNudge?: SpaceNudgePayload;
  nextActions?: ChatNextAction[];
  cards?: ChatJobCard[];
  citations?: CitationItem[];
  upgradeCta?: UpgradeCtaPayload;
  capabilityId?: SearchCapabilityId;
  playbookId?: string | null;
  /** Waiting-copy hint while placeholder is empty (KAZI-233). */
  pendingCapability?: "web_search" | "research";
  /** Quote insert target for MessageActions (clinic vs space). */
  composerTarget?: ComposerInsertTarget;
  locale?: string;
  streamComplete?: boolean;
  agentEmoji?: string;
  agentName?: string;
  onRetry?: () => void;
  onReferralAccept?: () => void;
  onReferralDismiss?: () => void;
  onSpaceNudgeAccept?: () => void;
  onSpaceNudgeDismiss?: () => void;
  onUpgradeResearch?: () => void;
  onNextAction?: (action: ChatNextAction) => void;
  onJobCardClick?: (card: ChatJobCard) => void;
  referralDisabled?: boolean;
  actionsDisabled?: boolean;
  onStreamComplete?: () => void;
}

export function MessageBubble({
  role,
  content,
  messageId,
  serverMessageId,
  feedbackEnabled = true,
  name,
  intent,
  isStreaming,
  variant = "clinic",
  surface = "default",
  status,
  referral,
  spaceNudge,
  nextActions,
  cards,
  citations,
  upgradeCta,
  capabilityId,
  playbookId,
  pendingCapability,
  composerTarget,
  locale = "en",
  streamComplete = true,
  agentEmoji,
  agentName,
  onRetry,
  onReferralAccept,
  onReferralDismiss,
  onSpaceNudgeAccept,
  onSpaceNudgeDismiss,
  onUpgradeResearch,
  onNextAction,
  onJobCardClick,
  referralDisabled,
  actionsDisabled,
  onStreamComplete,
}: MessageBubbleProps) {
  const t = useTranslations("chat");
  const isUser = role === "user";
  const isFailed = isUser && status === "failed";
  const displayName = name ?? (isUser ? undefined : AGENT_NAME);
  const showReferral =
    !isUser &&
    referral &&
    !referral.dismissed &&
    onReferralAccept &&
    onReferralDismiss;
  const showSpaceNudge =
    !isUser &&
    spaceNudge &&
    !spaceNudge.dismissed &&
    onSpaceNudgeAccept &&
    onSpaceNudgeDismiss;
  const showEnrichment =
    !isUser && streamComplete && !isStreaming;
  const jobCards = cards?.filter((card) => card.type === "job") ?? [];
  const showJobCards = showEnrichment && jobCards.length > 0;
  const showNextActions =
    showEnrichment && (nextActions?.length ?? 0) > 0 && onNextAction;
  const showCitations = showEnrichment && (citations?.length ?? 0) > 0;
  const showUpgradeCta =
    showEnrichment &&
    upgradeCta &&
    !upgradeCta.dismissed &&
    onUpgradeResearch;
  const showMessageActions =
    showEnrichment &&
    Boolean(content?.trim()) &&
    !isUser &&
    Boolean(composerTarget);
  const isWorkspace = surface === "workspace";
  const isWebSearchShortAnswer = capabilityId === "web_search";
  const isLongFormAssistant =
    !isUser &&
    (capabilityId === "research" ||
      pendingCapability === "research" ||
      (citations?.length ?? 0) > 0);
  const showCapabilityChip =
    !isUser && showEnrichment && isSearchCapability(capabilityId);
  // Search intents use the capability chip when resolved; keep the raw intent
  // badge only for non-search intents (or history rows without capabilityId).
  const intentCoveredByCapabilityChip =
    showCapabilityChip && isSearchCapability(intent);
  const showIntentBadge =
    !isUser &&
    Boolean(intent) &&
    intent !== "CHITCHAT" &&
    !intent!.startsWith("REFERRAL_") &&
    !intentCoveredByCapabilityChip;
  const markdownContent =
    showCitations && content
      ? stripMarkdownSourcesSection(content)
      : content;

  const processingLabel =
    pendingCapability === "research"
      ? t("processingResearch")
      : pendingCapability === "web_search"
        ? t("processingWebSearch")
        : t("processing");

  const renderAssistantContent = () => {
    // Empty or BE placeholder ("…") while waiting — show Processing… (KAZI-186).
    if (isStreaming && isPlaceholderReply(content ?? "")) {
      return (
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span className="inline-flex gap-1 align-middle" aria-hidden>
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot" />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot [animation-delay:0.15s]" />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot [animation-delay:0.3s]" />
          </span>
          <span>{processingLabel}</span>
        </span>
      );
    }

    if (!isUser && content && !streamComplete) {
      return (
        <StreamingText text={content} onComplete={onStreamComplete} />
      );
    }

    if (!isUser && content) {
      return <MarkdownContent content={markdownContent} />;
    }

    return <span className="whitespace-pre-wrap">{content}</span>;
  };

  // Assistant-only: job cards never attach to user turns, so this never widens user bubbles.
  const widenForJobCards = showJobCards;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 animate-fade-up min-w-0",
        widenForJobCards
          ? "w-full max-w-[92%] self-center"
          : cn(
              "max-w-[78%]",
              isUser ? "self-end" : "self-start"
            )
      )}
    >
      <div
        className={cn(
          "flex gap-4",
          widenForJobCards && (isUser ? "self-end max-w-[85%]" : "self-start max-w-[85%]")
        )}
      >
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm",
            isUser
              ? isWorkspace
                ? "bg-workspace-input text-workspace-muted"
                : "bg-gray-100 text-muted-foreground"
              : isWorkspace
                ? "bg-workspace-active text-kazi-orange"
                : "bg-orange-100 text-kazi-orange"
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          ) : (
            <Bot
              className="h-4 w-4 text-kazi-orange"
              strokeWidth={2.25}
              aria-hidden
            />
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          {!isUser && displayName && (
            <span
              className={cn(
                "text-xs font-medium px-1",
                isWorkspace ? "text-workspace-muted" : "text-muted-foreground"
              )}
            >
              {displayName}
            </span>
          )}
          <div
            className={cn(
              "px-4 py-3 rounded-[18px] text-[15px] leading-relaxed break-words",
              isUser ? "font-medium" : "font-normal",
              // web_search short-answer: denser body only. CitationList keeps its own
              // text-sm; research keeps default Markdown long-form spacing (KAZI-225).
              isWebSearchShortAnswer && "text-[14px] leading-snug",
              !isUser &&
                isLongFormAssistant &&
                !isWorkspace &&
                "text-gray-900",
              isUser
              ? isFailed
                ? "bg-red-950/40 text-red-200 border border-red-800/60 rounded-br-[4px]"
                : isWorkspace
                  ? "bg-workspace-accent text-white rounded-br-[4px]"
                  : "bg-kazi-orange text-white rounded-br-[4px]"
              : variant === "agent"
                ? isWorkspace
                  ? "bg-workspace-active text-workspace-text border border-workspace-border rounded-bl-[4px]"
                  : "bg-agent-bubble text-gray-900 border border-green-200/80 rounded-bl-[4px]"
                : isWorkspace
                  ? "bg-workspace-active text-workspace-text border border-workspace-border rounded-bl-[4px]"
                  : "bg-clinic-bubble text-gray-800 border border-gray-200/80 rounded-bl-[4px]"
            )}
          >
            {renderAssistantContent()}
            {showCitations && citations ? (
              <CitationList
                items={citations}
                className={
                  isWebSearchShortAnswer ? "max-h-40 [&_ul]:max-h-32" : undefined
                }
              />
            ) : null}
            {showNextActions && (
              <ChatNextActions
                actions={nextActions!}
                locale={locale}
                onAction={onNextAction!}
                disabled={actionsDisabled}
              />
            )}
            {showUpgradeCta && (
              <UpgradeResearchCta
                cta={upgradeCta!}
                onUpgrade={onUpgradeResearch!}
                disabled={actionsDisabled}
              />
            )}
            {showReferral && agentEmoji && agentName && (
              <ReferralPrompt
                agentEmoji={agentEmoji}
                agentName={agentName}
                reason={referral.reason}
                onAccept={onReferralAccept}
                onDismiss={onReferralDismiss}
                disabled={referralDisabled}
              />
            )}
            {showSpaceNudge && (
              <SpaceNudgePrompt
                nudge={spaceNudge}
                onAccept={onSpaceNudgeAccept}
                onDismiss={onSpaceNudgeDismiss}
                disabled={referralDisabled || actionsDisabled}
              />
            )}
          </div>
          {showMessageActions && composerTarget ? (
            <MessageActions
              content={content}
              messageId={messageId}
              serverMessageId={serverMessageId}
              feedbackEnabled={feedbackEnabled}
              composerTarget={composerTarget}
              disabled={actionsDisabled}
              className="px-1"
            />
          ) : null}
          {isFailed && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs text-red-600 hover:text-red-800 self-end px-1 underline-offset-2 hover:underline"
            >
              {t("retry")}
            </button>
          )}
          {showCapabilityChip && capabilityId ? (
            <SearchCapabilityChip
              capabilityId={capabilityId}
              playbookId={playbookId}
            />
          ) : null}
          {showIntentBadge && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full self-start bg-orange-100 text-kazi-orange">
              {intent === "RESUME_OPTIMIZE" ? (
                <>
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Resume Mode
                </>
              ) : (
                intent
              )}
            </span>
          )}
        </div>
      </div>
      {showJobCards ? (
        // pl-11 = avatar w-8 (32px) + gap-3 (12px) so teasers align with bubble text column.
        <div className="w-full pl-11">
          <ChatJobTeasers
            cards={jobCards}
            locale={locale}
            onCardClick={onJobCardClick}
          />
        </div>
      ) : null}
    </div>
  );
}
