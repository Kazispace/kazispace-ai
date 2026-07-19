"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  /**
   * `bar` — full-bleed clinic/space footer (default).
   * `card` — Doubao-style framed card; pair with outer max-w column.
   */
  variant?: "bar" | "card";
  /** Extra row inside the card (e.g. capability chips). Only used with `card`. */
  toolbar?: ReactNode;
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
  variant = "bar",
  toolbar,
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
  const showToast = useUIStore((s) => s.showToast);

  /** Grow with content up to max-h-32; avoid internal scroll until capped. */
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // max-h-32 = 8rem; read computed so theme/root font-size stays correct.
    const maxPx = Number.parseFloat(getComputedStyle(el).maxHeight);
    const cap = Number.isFinite(maxPx) && maxPx > 0 ? maxPx : 128;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, cap);
    el.style.height = `${next}px`;
    // +1px slack: sub-pixel scrollHeight vs capped height can flicker overflowY.
    el.style.overflowY = el.scrollHeight > cap + 1 ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [message, resizeTextarea]);

  // Recompute when the card width / viewport changes (wrap → height).
  useEffect(() => {
    const onResize = () => resizeTextarea();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeTextarea]);

  useEffect(() => {
    if (!composerInsert) return;
    if (!composerTarget || composerInsert.target !== composerTarget) return;
    const chunk = composerInsert.text;
    const mode = composerInsert.mode ?? 'append';
    let replacedDraft = false;
    setMessage((prev) => {
      if (mode === 'replace') {
        // TODO(KAZI-238): replace silently drops in-progress drafts (PRD replace-fill).
        // Follow-up: confirm / undo stack when prev.trim() is non-empty.
        replacedDraft = Boolean(prev.trim());
        return chunk;
      }
      if (!prev.trim()) return chunk;
      // Quote blocks already end with blank lines; emoji is a short prefix.
      const needsGap = !prev.endsWith("\n") && !chunk.startsWith("\n");
      return needsGap ? `${prev}\n\n${chunk}` : `${prev}${chunk}`;
    });
    if (replacedDraft) {
      showToast(t('starter.draftReplaced'), 'info');
    }
    clearComposerInsert();
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
      resizeTextarea();
    });
  }, [
    composerInsert,
    clearComposerInsert,
    composerTarget,
    showToast,
    t,
    resizeTextarea,
  ]);

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
  const isCard = variant === "card";
  /** Card composer ~15% denser than bar control sizes. */
  const iconBtn = isCard ? "h-7 w-7" : "h-8 w-8";

  const openAttachOrAgents = () => {
    if (showAttachButton) {
      setAttachMenuOpen(!attachMenuOpen);
      setFileError(null);
    } else if (onOpenAgents) {
      onOpenAgents();
    }
  };

  const plusButton = showPlus ? (
    <button
      type="button"
      onClick={openAttachOrAgents}
      disabled={inputDisabled}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[#86909C]",
        iconBtn,
        "hover:bg-gray-200/60 hover:text-[#1D2129] transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
      aria-label={t("attachFile")}
    >
      <Plus
        className={cn(
          isCard ? "h-4 w-4" : "h-[18px] w-[18px]",
          "transition-transform",
          attachMenuOpen && "rotate-45"
        )}
      />
    </button>
  ) : null;

  const sendOrMic = (
    <>
      {showMicButton && !hasContent && onSendAudio ? (
        isTranscribing ? (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center text-kazi-orange",
              iconBtn
            )}
            aria-label={t("voiceTranscribing")}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <VoiceRecordButton
            onRecordComplete={onSendAudio}
            disabled={inputDisabled}
            compact={isCard}
          />
        )
      ) : (
        <button
          type="submit"
          disabled={!hasContent || inputDisabled}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full transition-colors",
            iconBtn,
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
    </>
  );

  const textarea = (
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
      // Card layout is a block stack (not a flex row) — without w-full the
      // native cols≈20 width wins and text wraps early with empty space on the right.
      // Line-height: card uses leading-6 (CJK-friendly in Doubao stack); bar keeps
      // leading-5 to match the denser single-row footer alongside icon buttons.
      className={cn(
        "box-border w-full min-w-0 max-h-32 resize-none overflow-hidden",
        "bg-transparent text-sm leading-6 text-[#1D2129]",
        isCard ? "min-h-[40px] py-2" : "min-h-[36px] flex-1 py-1.5 leading-5",
        "placeholder:text-[#86909C] focus:outline-none",
        "disabled:cursor-not-allowed"
      )}
    />
  );

  const openFilePicker = (opts: {
    accept: string;
    capture?: boolean;
  }) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = opts.accept;
    if (opts.capture) {
      fileInputRef.current.setAttribute("capture", "environment");
    } else {
      fileInputRef.current.removeAttribute("capture");
    }
    fileInputRef.current.click();
    setAttachMenuOpen(false);
  };

  const attachMenu = attachMenuOpen ? (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40"
        onClick={() => setAttachMenuOpen(false)}
        aria-label="Close menu"
      />
      <div
        className={cn(
          "z-50 rounded-xl border border-gray-200 bg-white p-1 shadow-lg",
          isCard
            ? "absolute bottom-full left-0 mb-1.5 w-56"
            : "relative mx-4 mt-2"
        )}
      >
        <button
          type="button"
          onClick={() =>
            openFilePicker({ accept: "image/jpeg,image/png" })
          }
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#1D2129] hover:bg-[#F7F8FA]"
        >
          <ImageIcon className="h-5 w-5 text-green-500" />
          {t("attachPhoto")}
        </button>
        <button
          type="button"
          onClick={() =>
            openFilePicker({
              accept:
                "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            })
          }
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#1D2129] hover:bg-[#F7F8FA]"
        >
          <FileText className="h-5 w-5 text-blue-500" />
          {t("attachDocument")}
        </button>
        <button
          type="button"
          onClick={() =>
            openFilePicker({
              accept: "image/jpeg,image/png",
              capture: true,
            })
          }
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#1D2129] hover:bg-[#F7F8FA]"
        >
          <Camera className="h-5 w-5 text-orange-500" />
          {t("attachCamera")}
        </button>
      </div>
    </>
  ) : null;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        isCard ? "bg-transparent" : "border-t border-gray-200/80 bg-white"
      )}
    >
      {attachment && (
        <div className={cn("flex items-center gap-3 pt-3", isCard ? "px-1" : "px-4")}>
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

      {fileError && (
        <div className={cn("pt-2", isCard ? "px-1" : "px-4")}>
          <p className="text-xs text-red-500">{fileError}</p>
        </div>
      )}

      {!isCard && attachMenu}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden
        tabIndex={-1}
      />

      {isCard ? (
        <div
          className={cn(
            "rounded-2xl border border-[#D0E3FF]/90 bg-white",
            "shadow-[0_0_0_1px_rgba(208,227,255,0.35),0_8px_24px_-12px_rgba(15,23,42,0.18)]",
            "transition-shadow focus-within:border-kazi-orange/50 focus-within:shadow-[0_0_0_1px_rgba(244,121,32,0.25),0_8px_24px_-12px_rgba(244,121,32,0.2)]",
            inputDisabled && "opacity-50"
          )}
        >
          <div className="px-3 pt-3 pb-1">
            {textarea}
          </div>
          <div className="relative flex items-center gap-1.5 px-2 pb-2.5 pt-1">
            {plusButton}
            {attachMenu}
            {toolbar ? (
              <div
                className={cn(
                  "min-w-0 flex-1 overflow-x-auto",
                  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                )}
              >
                {toolbar}
              </div>
            ) : (
              <div className="flex-1" />
            )}
            {sendOrMic}
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div
            className={cn(
              "flex items-end gap-1 rounded-2xl border bg-gray-50 px-2 py-1.5 transition-colors",
              "focus-within:border-kazi-orange focus-within:bg-white",
              inputDisabled ? "opacity-50" : "border-gray-200"
            )}
          >
            {plusButton}
            {textarea}
            {sendOrMic}
          </div>
        </div>
      )}
    </form>
  );
}
