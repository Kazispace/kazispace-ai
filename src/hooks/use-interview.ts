'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInterviewSession,
  getInterviewSession,
  submitInterviewAnswer,
} from '@/lib/interview-api';
import { DEFAULT_INTERVIEW_LEVEL } from '@/lib/interview-roles';
import { useAuthStore, useUIStore } from '@/lib/store';
import type {
  InterviewFeedbackSummary,
  InterviewMessage,
  InterviewQuestion,
} from '@/types';

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export type InterviewPhase =
  | 'role_select'
  | 'interview'
  | 'feedback_pending'
  | 'feedback_ready'
  | 'feedback_failed';

export function useInterview() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);

  const [phase, setPhase] = useState<InterviewPhase>('role_select');
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [questionCount, setQuestionCount] = useState(3);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [feedback, setFeedback] = useState<InterviewFeedbackSummary | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const appendMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [...prev, { id: nextId('int'), role, content }]);
  }, []);

  const pollFeedback = useCallback(async () => {
    if (!sessionId) return;
    const res = await getInterviewSession(sessionId);
    if (!res.success || !res.data) return;

    const data = res.data;
    if (data.status === 'feedback_pending') return;

    stopPolling();

    if (data.status === 'feedback_failed') {
      setPhase('feedback_failed');
      appendMessage(
        'assistant',
        'Feedback generation failed. Please start a new interview.'
      );
      return;
    }

    if (data.status === 'completed' && data.feedback_summary) {
      setFeedback(data.feedback_summary);
      setPhase('feedback_ready');
    }
  }, [appendMessage, sessionId, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    setIsPolling(true);
    void pollFeedback();
    pollRef.current = setInterval(() => void pollFeedback(), 5000);
  }, [pollFeedback, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const showQuestion = useCallback(
    (q: InterviewQuestion, idx: number, total: number) => {
      setQuestionIndex(idx);
      setQuestionCount(total);
      setCurrentQuestion(q);
      appendMessage('assistant', `**Question ${idx}** (${q.category})\n\n${q.content}`);
    },
    [appendMessage]
  );

  const startSession = useCallback(
    async (role: string) => {
      if (!isLoggedIn || isStarting) return;
      setIsStarting(true);
      setTargetRole(role);
      setMessages([]);
      setFeedback(null);
      setPhase('interview');

      const res = await createInterviewSession({
        target_role: role,
        interview_level: DEFAULT_INTERVIEW_LEVEL,
        source_channel: 'web',
        answer_mode: 'text',
      });

      if (!res.success || !res.data) {
        showToast(res.error ?? 'Failed to start interview', 'error');
        setPhase('role_select');
        setIsStarting(false);
        return;
      }

      const data = res.data;
      setSessionId(data.session_id);
      setQuestionCount(data.question_count ?? 3);
      setQuestionIndex(data.question_index ?? 1);
      setCurrentQuestion(data.question ?? null);

      if (data.language_notice) {
        appendMessage('assistant', data.language_notice);
      }
      if (data.question) {
        showQuestion(
          data.question,
          data.question_index ?? 1,
          data.question_count ?? 3
        );
      }
      setIsStarting(false);
    },
    [appendMessage, isLoggedIn, isStarting, showQuestion, showToast]
  );

  const submitAnswer = useCallback(
    async (text: string) => {
      if (!text.trim() || !sessionId || !currentQuestion || isSending) return;
      setIsSending(true);
      appendMessage('user', text.trim());

      const res = await submitInterviewAnswer(sessionId, {
        question_id: currentQuestion.question_id,
        answer_text: text.trim(),
      });

      if (!res.success || !res.data) {
        showToast(res.error ?? 'Failed to submit answer', 'error');
        setIsSending(false);
        return;
      }

      const data = res.data;
      if (data.status === 'completed') {
        setCurrentQuestion(null);
        setPhase('feedback_pending');
        appendMessage(
          'assistant',
          data.loading_hint ??
            'All answers submitted! Generating your personalized feedback…'
        );
        startPolling();
        setIsSending(false);
        return;
      }

      if (data.next_question) {
        showQuestion(data.next_question, questionIndex + 1, questionCount);
      }
      setIsSending(false);
    },
    [
      appendMessage,
      currentQuestion,
      isSending,
      questionCount,
      questionIndex,
      sessionId,
      showQuestion,
      showToast,
      startPolling,
    ]
  );

  const reset = useCallback(() => {
    stopPolling();
    setPhase('role_select');
    setMessages([]);
    setSessionId(null);
    setTargetRole(null);
    setQuestionIndex(1);
    setQuestionCount(3);
    setCurrentQuestion(null);
    setFeedback(null);
  }, [stopPolling]);

  const checkFeedbackNow = useCallback(() => {
    void pollFeedback();
  }, [pollFeedback]);

  return {
    phase,
    messages,
    sessionId,
    targetRole,
    questionIndex,
    questionCount,
    currentQuestion,
    feedback,
    isStarting,
    isSending,
    isPolling,
    needsLogin: !isLoggedIn,
    startSession,
    submitAnswer,
    reset,
    checkFeedbackNow,
  };
}
