"use client";

import { useCallback, useRef, useState } from "react";
import {
  Camera,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Send,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { VoiceRecordButton } from "@/components/chat/voice-record-button";
import { formatFileSize } from "@/lib/file-utils";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats",
  "text/",
  "image/",
  "audio/",
];

interface AttachmentPreview {
  file: File;
  previewUrl?: string;
}

interface ChatInputProps {
  onSend: (message: string, attachment?: File) => void;
  onSendAudio?: (audioBlob: Blob) => void;
  disabled?: boolean;
  placeholder?: string;
  onOpenAgents?: () => void;
  showAgentButton?: boolean;
  showAttachButton?: boolean;
  showMicButton?: boolean;
  isUploading?: boolean;
}

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function ChatInput({
  onSend,
  onSendAudio,
  disabled,
  placeholder,
  onOpenAgents,
  showAgentButton,
  showAttachButton = true,
  showMicButton = true,
  isUploading,
}: ChatInputProps) {
  const t = useTranslations("spaces");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<AttachmentPreview | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputDisabled = disabled || isUploading;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const hasContent = message.trim() || attachment;
      if (!hasContent || inputDisabled) return;
      onSend(message.trim(), attachment?.file);
      setMessage("");
      setAttachment(null);
    },
    [message, attachment, inputDisabled, onSend]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setFileError(null);
      if (file.size > MAX_FILE_SIZE) {
        setFileError(t("fileTooLarge", { limit: "20 MB" }));
        return;
      }
      if (!isAllowedMime(file.type)) {
        setFileError(t("fileTypeNotSupported"));
        return;
      }

      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      setAttachment({ file, previewUrl });
      setAttachMenuOpen(false);
    },
    [t]
  );

  const removeAttachment = useCallback(() => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    setFileError(null);
  }, [attachment]);

  const hasContent = message.trim() || attachment;

  return (
    <form onSubmit={handleSubmit} className="bg-white border-t border-gray-200/80">
      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-3 px-4 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-[#86909C]" />
            <span className="max-w-[180px] truncate text-[#1D2129]">
              {attachment.file.name}
            </span>
            <span className="text-xs text-[#86909C]">
              {formatFileSize(attachment.file.size)}
            </span>
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-kazi-orange" />
            ) : (
              <button
                type="button"
                onClick={removeAttachment}
                className="rounded p-0.5 text-[#86909C] hover:text-red-500"
                aria-label={t("attachmentPreviewRemove")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* File error */}
      {fileError && (
        <div className="px-4 pt-2">
          <p className="text-xs text-red-500">{fileError}</p>
        </div>
      )}

      {/* Attach menu (bottom sheet style) */}
      {attachMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            onClick={() => setAttachMenuOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative z-50 mx-4 mt-2 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*,video/*";
                  fileInputRef.current.click();
                }
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#1D2129] hover:bg-[#F7F8FA]"
            >
              <ImageIcon className="h-5 w-5 text-green-500" />
              {t("attachPhoto")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept =
                    ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx";
                  fileInputRef.current.click();
                }
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#1D2129] hover:bg-[#F7F8FA]"
            >
              <FileText className="h-5 w-5 text-blue-500" />
              {t("attachDocument")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.capture = "environment";
                  fileInputRef.current.click();
                }
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#1D2129] hover:bg-[#F7F8FA]"
            >
              <Camera className="h-5 w-5 text-orange-500" />
              {t("attachCamera")}
            </button>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden
        tabIndex={-1}
      />

      {/* Input bar */}
      <div className="flex gap-2 p-4 items-end">
        {/* "+" attach button (KAZI-212) */}
        {showAttachButton && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-10 w-10 shrink-0 rounded-full border-gray-200"
            onClick={() => {
              setAttachMenuOpen(!attachMenuOpen);
              setFileError(null);
            }}
            disabled={inputDisabled}
            aria-label={t("attachFile")}
          >
            <Plus className={cn("w-5 h-5 transition-transform", attachMenuOpen && "rotate-45")} />
          </Button>
        )}

        {/* Legacy agent button fallback */}
        {!showAttachButton && showAgentButton && onOpenAgents && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={onOpenAgents}
            disabled={inputDisabled}
          >
            <Plus className="w-5 h-5" />
          </Button>
        )}

        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isUploading
                ? t("uploading")
                : placeholder || "Ask Kazi anything..."
            }
            disabled={inputDisabled}
            rows={1}
            className={cn(
              "w-full resize-none rounded-[24px] border border-gray-200 bg-gray-50 px-4 py-3 text-sm",
              "focus:outline-none focus:border-kazi-orange focus:bg-white transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "max-h-32"
            )}
            style={{ minHeight: "44px" }}
          />
        </div>

        {/* Mic button (KAZI-213) — press-and-hold to record, release to send */}
        {showMicButton && !hasContent && onSendAudio && (
          <VoiceRecordButton
            onRecordComplete={onSendAudio}
            disabled={inputDisabled}
          />
        )}

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!hasContent || inputDisabled}
          className={cn(
            "h-10 w-10 shrink-0 rounded-full",
            !hasContent && showMicButton && onSendAudio && "hidden"
          )}
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
    </form>
  );
}
