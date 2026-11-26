'use client';

import { useCallback, useEffect, useState } from 'react';

import { readExamMode, writeExamMode, type ExamMode } from '@/lib/exam-mode';
import { useUIStore } from '@/lib/store';

/**
 * Exam's Chat / Form mode (kazispace-ui Exam 0.2, D36, D38). Chat on the server and on first
 * paint, then the mode used last, read after mount so server and client agree. Studio's Get
 * started text (an `exam` composer insert) brings Exam back to Chat, so the composer that takes
 * the text is the one on screen.
 */
export function useExamMode(): [ExamMode, (mode: ExamMode) => void] {
  const [mode, setMode] = useState<ExamMode>('chat');
  useEffect(() => setMode(readExamMode()), []);
  const examInsertPending = useUIStore((s) => s.composerInsert?.target === 'exam');
  useEffect(() => {
    if (!examInsertPending) return;
    setMode('chat');
    writeExamMode('chat');
  }, [examInsertPending]);
  const choose = useCallback((next: ExamMode) => {
    setMode(next);
    writeExamMode(next);
  }, []);
  return [mode, choose];
}
