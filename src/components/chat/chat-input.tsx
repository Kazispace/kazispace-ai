"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

import { VoiceRecordButton } from "@/components/chat/voice-record-button";
import { formatFileSize } from "@/lib/file-utils";
import { useUIStore, type ComposerInsertTarget } from "@/lib/store";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — matches BE MAX_FILE_SIZE_BYTES
/** Align with backend files/constants.py ALLOWED_MIME_TYPES */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/ogg',
  'audio/mpeg',
  'audio/webm',
  'image/jpeg',
  'image/png',
]);

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
  /** True while POST /inputs ASR is in flight (mic → chat). */
  isTranscribing?: boolean;
  /**
   * Only consume composerInsert events for this target (PR #126 P2).
   * Omit on non-clinic/space composers so they ignore quote inserts.
   */
  composerTarget?: ComposerInsertTarget;
}

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(mime);
}

export function ChatInput({
  onSend,
  onSendAudio,
  disabled,
  placeholder,
  onOpenAgents,
  showAgentButton,
  showAttachButton = false,
  showMicButton = false,
  isUploading,
  isTranscribing,
  composerTarget,
}: ChatInputProps) {
  const t = useTranslations("spaces");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<AttachmentPreview | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputDisabled = disabled || isUploading || isTranscribing;
  const composerInsert = useUIStore((s) => s.composerInsert);
  const clearComposerInsert = useUIStore((s) => s.clearComposerInsert);

  useEffect(() => {
    if (!composerInsert) return;
    if (!composerTarget || composerInsert.target !== composerTarget) return;
    const chunk = composerInsert.text;
    const mode = composerInsert.mode ?? 'append';
    setMessage((prev) => {
      if (mode === 'replace' || !prev.trim()) return chunk;
      // Quote blocks already end with blank lines; emoji is a short prefix.
      const needsGap = !prev.endsWith("\n") && !chunk.startsWith("\n");
      return needsGap ? `${prev}\n\n${chunk}` : `${prev}${chunk}`;
    });
    clearComposerInsert();
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }, [composerInsert, clearComposerInsert, composerTarget]);

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
  const showPlus = showAttachButton || (showAgentButton && onOpenAgents);

  return (
    <form onSubmit={handleSubmit} className="bg-white border-t border-gray-200/80">
      {/* Attachment preview — above the input box */}
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

      {/* Attach menu popover */}
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
                  fileInputRef.current.accept = "image/jpeg,image/png";
                  fileInputRef.current.removeAttribute("capture");
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
                    "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                  fileInputRef.current.removeAttribute("capture");
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
                  fileInputRef.current.accept = "image/jpeg,image/png";
                  fileInputRef.current.setAttribute("capture", "environment");
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

      {/* ── Unified input bar: [+] textarea [mic|send] ── */}
      <div className="p-3">
        <div
          className={cn(
            "flex items-end gap-1 rounded-2xl border bg-gray-50 px-2 py-1.5 transition-colors",
            "focus-within:border-kazi-orange focus-within:bg-white",
            inputDisabled ? "opacity-50" : "border-gray-200"
          )}
        >
          {/* Left: "+" inside the box */}
          {showPlus && (
            <button
              type="button"
              onClick={() => {
                if (showAttachButton) {
                  setAttachMenuOpen(!attachMenuOpen);
                  setFileError(null);
                } else if (onOpenAgents) {
                  onOpenAgents();
                }
              }}
              disabled={inputDisabled}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#86909C]",
                "hover:bg-gray-200/60 hover:text-[#1D2129] transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              aria-label={t("attachFile")}
            >
              <Plus className={cn("h-[18px] w-[18px] transition-transform", attachMenuOpen && "rotate-45")} />
            </button>
          )}

          {/* Center: textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTranscribing
                ? t("voiceTranscribing")
                : isUploading
                  ? t("uploading")
                  : placeholder || "Ask Kazi anything..."
            }
            disabled={inputDisabled}
            rows={1}
            className={cn(
              "min-h-[36px] max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm leading-5",
              "placeholder:text-[#86909C] focus:outline-none",
              "disabled:cursor-not-allowed"
            )}
          />

          {/* Right: mic or send — inside the box */}
          {showMicButton && !hasContent && onSendAudio ? (
            isTranscribing ? (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center text-kazi-orange"
                aria-label={t("voiceTranscribing")}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <VoiceRecordButton
                onRecordComplete={onSendAudio}
                disabled={inputDisabled}
              />
            )
          ) : (
            <button
              type="submit"
              disabled={!hasContent || inputDisabled}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                hasContent && !inputDisabled
                  ? "bg-kazi-orange text-white hover:bg-kazi-orange/90"
                  : "text-[#C9CDD4] cursor-not-allowed"
              )}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
