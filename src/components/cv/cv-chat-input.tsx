"use client";

import { useRef, useState } from "react";
import { ArrowUp, Loader2, Paperclip } from "lucide-react";
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
      className="shrink-0 p-3 border-t border-workspace-border bg-workspace-sidebar"
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-lg border border-workspace-border bg-workspace-input",
          "focus-within:border-workspace-accent/60 transition-colors"
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
            "shrink-0 m-1.5 h-7 w-7 flex items-center justify-center rounded",
            "text-workspace-muted hover:text-workspace-text hover:bg-workspace-hover",
            "disabled:opacity-40 transition-colors"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
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
            "flex-1 resize-none bg-transparent py-2.5 pr-1 text-[13px] text-workspace-text",
            "placeholder:text-workspace-muted focus:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed max-h-28"
          )}
          style={{ minHeight: "36px" }}
        />
        <button
          type="submit"
          disabled={!message.trim() || inputDisabled}
          aria-label="Send"
          className={cn(
            "shrink-0 m-1.5 h-7 w-7 flex items-center justify-center rounded",
            "bg-workspace-accent text-white",
            "hover:bg-workspace-accent/90 disabled:opacity-30 disabled:cursor-not-allowed",
            "transition-colors"
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
