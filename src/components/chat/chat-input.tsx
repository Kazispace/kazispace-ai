"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 p-4 bg-white border-t">
      <div className="flex-1 relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask Kazi anything..."}
          disabled={disabled}
          rows={1}
          className={cn(
            "w-full resize-none rounded-[24px] border border-gray-200 bg-gray-50 px-4 py-3 text-sm",
            "focus:outline-none focus:border-kazi-orange focus:bg-white transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "max-h-32"
          )}
          style={{ minHeight: "48px" }}
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!message.trim() || disabled}
        className="h-12 w-12 shrink-0"
      >
        <Send className="w-5 h-5" />
      </Button>
    </form>
  );
}
