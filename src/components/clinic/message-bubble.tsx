"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/constants";
import { MarkdownContent } from "./markdown-content";
import { ReferralPrompt } from "./referral-prompt";
import { StreamingText } from "@/components/chat/streaming-text";
import type { ReferralPayload } from "@/types";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  name?: string;
  intent?: string;
  isStreaming?: boolean;
  variant?: "clinic" | "agent";
  status?: "sending" | "sent" | "failed";
  referral?: ReferralPayload;
  streamComplete?: boolean;
  agentEmoji?: string;
  agentName?: string;
  onRetry?: () => void;
  onReferralAccept?: () => void;
  onReferralDismiss?: () => void;
  referralDisabled?: boolean;
  onStreamComplete?: () => void;
}

export function MessageBubble({
  role,
  content,
  name,
  intent,
  isStreaming,
  variant = "clinic",
  status,
  referral,
  streamComplete = true,
  agentEmoji,
  agentName,
  onRetry,
  onReferralAccept,
  onReferralDismiss,
  referralDisabled,
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

  const renderAssistantContent = () => {
    if (isStreaming && !content) {
      return (
        <span className="inline-flex gap-1 align-middle">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot [animation-delay:0.15s]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot [animation-delay:0.3s]" />
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
            ? "bg-gray-100 text-muted-foreground"
            : "bg-gradient-to-br from-kazi-orange to-amber-500"
        )}
      >
        {isUser ? "👤" : "🤖"}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        {!isUser && displayName && (
          <span className="text-xs font-medium text-muted-foreground px-1">
            {displayName}
          </span>
        )}
        <div
          className={cn(
            "px-4 py-3 rounded-[18px] text-[15px] leading-relaxed break-words",
            isUser
              ? isFailed
                ? "bg-red-50 text-red-900 border border-red-200 rounded-br-[4px]"
                : "bg-kazi-orange text-white rounded-br-[4px]"
              : variant === "agent"
                ? "bg-agent-bubble text-gray-900 border border-green-200/80 rounded-bl-[4px]"
                : "bg-clinic-bubble text-gray-900 border border-gray-200/80 rounded-bl-[4px]"
          )}
        >
          {renderAssistantContent()}
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
