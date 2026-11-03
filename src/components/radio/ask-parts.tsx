'use client';

import { useTranslations } from 'next-intl';

import type { PlayableSentence } from '@/hooks/use-sentence-player';
import type { RadioNotice } from '@/types/radio';
import { cn } from '@/lib/utils';

/** The most a question's text may be (Data · A program: 1 to 200 characters; a story turn the same). */
export const QUESTION_TEXT_MAX = 200;

/**
 * "Explain this sentence" as the question's text: the menu's own words, then the sentence, so the
 * server's parser reads it as a question about exactly that sentence.
 */
export function explainQuestion(prompt: string, sentence: string): string {
  return `${prompt}：${sentence}`.slice(0, QUESTION_TEXT_MAX);
}

/** The host's answer, shown in the captions in the same style as the story, the sentence spoken highlighted. */
export function AnswerCaptions({ sentences, activeIndex }: { sentences: PlayableSentence[]; activeIndex: number }) {
  return (
    <ol className="mt-3 flex flex-col gap-2" data-testid="radio-answer" aria-live="polite">
      {sentences.map((s, i) => (
        <li
          key={`${s.seq}-${i}`}
          className={cn(
            'rounded-lg border-l-4 border-primary/40 px-3 py-2 text-base leading-relaxed',
            i === activeIndex ? 'bg-primary/10 text-workspace-text' : 'text-workspace-secondary'
          )}
        >
          {s.text}
        </li>
      ))}
    </ol>
  );
}

/**
 * Care (code `input_self_harm`): a card that stays until the user acts, never read aloud. Keep
 * listening and Close only: no offer of any kind and no mention of credits.
 */
export function CareCard({ notice, onKeepListening, onClose }: { notice: RadioNotice; onKeepListening: () => void; onClose: () => void }) {
  const t = useTranslations('radio.notice');
  return (
    <div role="alertdialog" aria-live="assertive" data-testid="radio-care" className="mt-4 rounded-xl border border-gray-300 bg-white p-4 text-sm text-workspace-text shadow-sm">
      <p className="whitespace-pre-line">{notice.text}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onKeepListening} className="flex-1 rounded-lg border border-gray-300 px-3 py-2">
          {t('keepListening')}
        </button>
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-3 py-2">
          {t('close')}
        </button>
      </div>
    </div>
  );
}

/**
 * A notice card from the server (Notices). **Limit** (`quota`) and **Not available here**
 * (`unavailable`) close with `radio.notice.gotIt`; other kinds show their text with Close. The text
 * is the server's, shown as it comes.
 */
export function NoticeCard({ notice, onClose }: { notice: RadioNotice; onClose: () => void }) {
  const t = useTranslations('radio.notice');
  if (!notice.text) return null;
  const gotIt = notice.kind === 'quota' || notice.kind === 'unavailable';
  return (
    <div
      role="status"
      data-testid="radio-notice"
      data-kind={notice.kind}
      className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p>{notice.text}</p>
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-2 py-1 text-xs underline" data-testid="radio-notice-close">
        {gotIt ? t('gotIt') : t('close')}
      </button>
    </div>
  );
}

/** "Not understood", "Can't take that", "Tap instead" / "Ask another way": one line, the server's text. */
export function VoiceLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="status" data-testid="radio-voice-line" className="mt-4 text-sm text-workspace-secondary">
      {text}
    </p>
  );
}
