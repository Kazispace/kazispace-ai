"use client";

import { useTranslations } from "next-intl";
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
  /** Message id — used for future thumbs feedback / corpus. */
  messageId?: string;
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

  return (
    <div
      className={cn(
        "flex gap-3 max-w-[78%] animate-fade-up",
        isUser ? "self-end flex-row-reverse" : "self-start"
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
              : "bg-gradient-to-br from-kazi-orange to-amber-500"
        )}
      >
        {isUser ? "👤" : "🤖"}
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
            // web_search short-answer: denser body only. CitationList keeps its own
            // text-sm; research keeps default Markdown long-form spacing (KAZI-225).
            isWebSearchShortAnswer && "text-[14px] leading-snug",
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
                : "bg-clinic-bubble text-gray-900 border border-gray-200/80 rounded-bl-[4px]"
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
          {showJobCards && (
            <ChatJobTeasers
              cards={jobCards}
              locale={locale}
              onCardClick={onJobCardClick}
            />
          )}
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
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start bg-orange-100 text-kazi-orange">
            {intent === "RESUME_OPTIMIZE" ? "📄 Resume Mode" : intent}
          </span>
        )}
      </div>
    </div>
  );
}
