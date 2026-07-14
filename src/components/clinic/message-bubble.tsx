"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/constants";
import { ChatJobTeasers } from "./chat-job-teasers";
import { ChatNextActions } from "./chat-next-actions";
import { MarkdownContent } from "./markdown-content";
import { ReferralPrompt } from "./referral-prompt";
import { StreamingText } from "@/components/chat/streaming-text";
import { isPlaceholderReply } from "@/lib/spaces/turn";
import type { ChatJobCard, ChatNextAction, ReferralPayload } from "@/types";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  name?: string;
  intent?: string;
  isStreaming?: boolean;
  variant?: "clinic" | "agent";
  surface?: "default" | "workspace";
  status?: "sending" | "sent" | "failed";
  referral?: ReferralPayload;
  nextActions?: ChatNextAction[];
  cards?: ChatJobCard[];
  locale?: string;
  streamComplete?: boolean;
  agentEmoji?: string;
  agentName?: string;
  onRetry?: () => void;
  onReferralAccept?: () => void;
  onReferralDismiss?: () => void;
  onNextAction?: (action: ChatNextAction) => void;
  onJobCardClick?: (card: ChatJobCard) => void;
  referralDisabled?: boolean;
  actionsDisabled?: boolean;
  onStreamComplete?: () => void;
}

export function MessageBubble({
  role,
  content,
  name,
  intent,
  isStreaming,
  variant = "clinic",
  surface = "default",
  status,
  referral,
  nextActions,
  cards,
  locale = "en",
  streamComplete = true,
  agentEmoji,
  agentName,
  onRetry,
  onReferralAccept,
  onReferralDismiss,
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
  const showEnrichment =
    !isUser && streamComplete && !isStreaming;
  const jobCards = cards?.filter((card) => card.type === "job") ?? [];
  const showJobCards = showEnrichment && jobCards.length > 0;
  const showNextActions =
    showEnrichment && (nextActions?.length ?? 0) > 0 && onNextAction;
  const isWorkspace = surface === "workspace";

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
          <span>{t("processing")}</span>
        </span>
      );
    }

    if (!isUser && content && !streamComplete) {
      return (
        <StreamingText text={content} onComplete={onStreamComplete} />
      );
    }

    if (!isUser && content) {
      return <MarkdownContent content={content} />;
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
        </div>
        {isFailed && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-red-600 hover:text-red-800 self-end px-1 underline-offset-2 hover:underline"
          >
            {t("retry")}
          </button>
        )}
        {intent && !isUser && intent !== "CHITCHAT" && !intent.startsWith("REFERRAL_") && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start bg-orange-100 text-kazi-orange">
            {intent === "RESUME_OPTIMIZE" ? "📄 Resume Mode" : intent}
          </span>
        )}
      </div>
    </div>
  );
}
