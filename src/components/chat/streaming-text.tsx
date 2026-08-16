"use client";

/**
 * @deprecated KAZI-561 — Do not use for complete HTTP replies.
 * Clinic/Space use long POST + full Markdown; fake char typewriter caused
 * long-reply flicker and restart-on-rerender. Kept only for a future real
 * SSE draft path; prefer MarkdownContent for authoritative content.
 */
interface StreamingTextProps {
  text: string;
  onComplete?: () => void;
}

/** @deprecated See file header — not used by Clinic HTTP reply path. */
export function StreamingText({ text }: StreamingTextProps) {
  // Immediate paint — never 20ms/char replay (KAZI-561).
  return <span>{text}</span>;
}
