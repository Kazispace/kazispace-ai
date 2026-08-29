"use client";

import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  timestamp?: string;
}

export function ChatMessage({ role, content, intent, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 max-w-[78%] animate-fade-up", isUser && "self-end flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser ? "bg-gray-100" : "bg-gradient-to-br from-primary to-amber-500"
        )}
      >
        <span className="text-sm">{isUser ? "👤" : "🤖"}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-user-bubble text-workspace-text border border-user-bubble-border rounded-br-sm"
              : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
          )}
        >
          {content}
        </div>
        {intent && !isUser && intent !== "CHITCHAT" && (
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full self-start",
              intent === "RESUME_OPTIMIZE"
                ? "bg-blue-100 text-primary"
                : intent === "PAYMENT"
                ? "bg-purple-100 text-purple-600"
                : "bg-green-100 text-green-600"
            )}
          >
            {intent === "RESUME_OPTIMIZE" ? "📄 Resume Mode" : intent}
          </span>
        )}
        {timestamp && (
          <span className={cn("text-xs text-gray-400 px-1", isUser && "text-right")}>
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
