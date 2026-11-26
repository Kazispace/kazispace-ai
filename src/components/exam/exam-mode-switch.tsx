'use client';

import { useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

import { EXAM_MODES, type ExamMode } from '@/lib/exam-mode';
import { cn } from '@/lib/utils';

/**
 * Exam's Chat / Form switch (kazispace-ui Exam 0.1.1, "Modes" and "Accessibility"; D36).
 * Unlike the tab bar, this really is a set of tabs on one screen: a tab list of two tabs,
 * each controlling the panel below, arrow keys moving between them. The only row of tabs
 * inside a destination; it stays under the header while the content scrolls.
 */
export function ExamModeSwitch({
  mode,
  onChange,
  panelId,
}: {
  mode: ExamMode;
  onChange: (mode: ExamMode) => void;
  panelId: (mode: ExamMode) => string;
}) {
  const t = useTranslations('exam');
  const refs = useRef<Record<ExamMode, HTMLButtonElement | null>>({ chat: null, form: null });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = EXAM_MODES[(EXAM_MODES.indexOf(mode) + 1) % EXAM_MODES.length];
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="shrink-0 border-b border-workspace-border bg-white px-4 py-2">
      <div
        role="tablist"
        aria-label={t('modes')}
        onKeyDown={onKeyDown}
        data-testid="exam-mode-switch"
        className="mx-auto flex w-full max-w-md rounded-full bg-gray-100 p-1 md:mx-0"
      >
        {EXAM_MODES.map((m) => {
          const selected = m === mode;
          return (
            <button
              key={m}
              ref={(el) => {
                refs.current[m] = el;
              }}
              type="button"
              role="tab"
              id={`exam-mode-tab-${m}`}
              aria-selected={selected}
              aria-controls={panelId(m)}
              tabIndex={selected ? 0 : -1}
              data-testid={`exam-mode-${m}`}
              onClick={() => onChange(m)}
              className={cn(
                // At least 44px tall (size.touch-target); the selected one is filled and bolder.
                'min-h-11 flex-1 rounded-full px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                selected
                  ? 'bg-white font-semibold text-workspace-text shadow-sm'
                  : 'font-medium text-workspace-secondary hover:text-workspace-text'
              )}
            >
              {t(`mode.${m}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
