"use client";

import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/constants";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  name?: string;
  intent?: string;
  isStreaming?: boolean;
}

export function MessageBubble({
  role,
  content,
  name,
  intent,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const displayName = name ?? (isUser ? undefined : AGENT_NAME);

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
          <span className="text-xs font-medium text-muted-foreground px-1">{displayName}</span>
        )}
        <div
          className={cn(
            "px-4 py-3 rounded-[18px] text-[15px] leading-relaxed whitespace-pre-wrap break-words",
            isUser
              ? "bg-kazi-orange text-white rounded-br-[4px]"
              : "bg-clinic-bubble text-gray-900 border border-gray-200/80 rounded-bl-[4px]"
          )}
        >
          {content}
          {isStreaming && !content && (
            <span className="inline-flex gap-1 align-middle ml-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce-dot [animation-delay:0.3s]" />
            </span>
          )}
        </div>
        {intent && !isUser && intent !== "CHITCHAT" && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start bg-orange-100 text-kazi-orange">
            {intent === "RESUME_OPTIMIZE" ? "📄 Resume Mode" : intent}
          </span>
        )}
      </div>
    </div>
  );
}
