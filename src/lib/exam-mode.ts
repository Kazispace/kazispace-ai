/**
 * Exam's two modes (kazispace-ui Exam 0.1.1, D36; KAZI-1485): Chat is the English Space's
 * conversation, Form picks questions on a page. Chat the first time; after that, the mode the
 * user used last. Remembered per browser only: a lost value just means Chat again.
 */
export type ExamMode = 'chat' | 'form';

export const EXAM_MODES: readonly ExamMode[] = ['chat', 'form'] as const;
export const EXAM_MODE_STORAGE_KEY = 'kazi.exam.mode';

export function readExamMode(): ExamMode {
  if (typeof window === 'undefined') return 'chat';
  try {
    return window.localStorage.getItem(EXAM_MODE_STORAGE_KEY) === 'form' ? 'form' : 'chat';
  } catch {
    return 'chat';
  }
}

export function writeExamMode(mode: ExamMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXAM_MODE_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable: the mode is not remembered */
  }
}
