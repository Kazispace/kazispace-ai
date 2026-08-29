"use client";

import { useRef, useState, type RefObject } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CV_UPLOAD_ACCEPT } from "@/lib/cv-input-api";
import { cn } from "@/lib/utils";

interface CvChatInputProps {
  onSend: (message: string) => void;
  onUpload: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  placeholder?: string;
  fileInputRef?: RefObject<HTMLInputElement>;
}

export function CvChatInput({
  onSend,
  onUpload,
  disabled,
  isUploading,
  placeholder,
  fileInputRef: externalFileRef,
}: CvChatInputProps) {
  const t = useTranslations("cv");
  const internalFileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = externalFileRef ?? internalFileRef;
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
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-white border-t border-gray-200/80 items-end">
      <input
        ref={fileInputRef}
        type="file"
        accept={CV_UPLOAD_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
        tabIndex={-1}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-12 w-12 shrink-0 rounded-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={inputDisabled}
        aria-label={t("uploadResume")}
      >
        {isUploading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Paperclip className="w-5 h-5" />
        )}
      </Button>
      <div className="flex-1 relative">
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
            "w-full resize-none rounded-[24px] border border-gray-200 bg-gray-50 px-4 py-3 text-sm",
            "focus:outline-none focus:border-primary focus:bg-white transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed max-h-32"
          )}
          style={{ minHeight: "48px" }}
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!message.trim() || inputDisabled}
        className="h-12 w-12 shrink-0"
      >
        <Send className="w-5 h-5" />
      </Button>
    </form>
  );
}
