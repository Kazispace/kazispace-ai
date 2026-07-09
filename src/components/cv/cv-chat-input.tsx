"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { CV_UPLOAD_ACCEPT } from "@/lib/cv-input-api";
import { cn } from "@/lib/utils";

interface CvChatInputProps {
  onSend: (message: string) => void;
  onUpload: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  placeholder?: string;
}

/** Coze-style floating composer at bottom of chat. */
export function CvChatInput({
  onSend,
  onUpload,
  disabled,
  isUploading,
  placeholder,
}: CvChatInputProps) {
  const t = useTranslations("cv");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const inputDisabled = disabled || isUploading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !inputDisabled) {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && !inputDisabled) {
      onUpload(file);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 px-4 py-3 bg-gradient-to-t from-workspace-bg via-workspace-bg to-transparent"
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-workspace-border bg-white",
          "px-3 py-2 shadow-md shadow-black/5",
          "focus-within:border-kazi-orange/40 focus-within:ring-2 focus-within:ring-kazi-orange/10",
          "transition-all"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={CV_UPLOAD_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={inputDisabled}
          aria-label={t("uploadResume")}
          title={t("uploadResume")}
          className={cn(
            "shrink-0 h-9 w-9 flex items-center justify-center rounded-xl",
            "text-workspace-muted hover:text-kazi-orange hover:bg-workspace-hover",
            "disabled:opacity-40 transition-colors"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </button>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isUploading ? t("uploading") : placeholder || t("inputPlaceholder")
          }
          disabled={inputDisabled}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent py-2 text-sm text-workspace-text",
            "placeholder:text-workspace-muted focus:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed max-h-32"
          )}
          style={{ minHeight: "36px" }}
        />
        <button
          type="submit"
          disabled={!message.trim() || inputDisabled}
          aria-label="Send"
          className={cn(
            "shrink-0 h-9 w-9 flex items-center justify-center rounded-xl",
            "bg-kazi-orange text-white shadow-sm",
            "hover:bg-kazi-orange/90 disabled:opacity-30 disabled:cursor-not-allowed",
            "transition-colors"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[10px] text-workspace-muted text-center mt-2">
        {t("composerHint")}
      </p>
    </form>
  );
}
