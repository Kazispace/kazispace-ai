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
  InterviewPrepCard,
  InterviewQuestion,
} from '@/types';

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export type InterviewPhase =
  | 'role_select'
  | 'prep_review'
  | 'interview'
  | 'feedback_pending'
  | 'feedback_ready'
  | 'feedback_failed';

export function useInterview(jobId?: string | null) {
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
  const [prepCard, setPrepCard] = useState<InterviewPrepCard | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingFeedback, setIsCheckingFeedback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);
  const pendingStartRef = useRef<{
    session_id: string;
    question_count?: number;
    question_index?: number;
    question?: InterviewQuestion;
    language_notice?: string;
  } | null>(null);

  const isStale = useCallback((runId: number) => runId !== runIdRef.current, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const appendMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [...prev, { id: nextId('int'), role, content }]);
  }, []);

  const pollFeedback = useCallback(
    async (runId: number) => {
      if (!sessionId || isStale(runId)) return;
      setIsCheckingFeedback(true);
      const res = await getInterviewSession(sessionId);
      if (isStale(runId)) {
        setIsCheckingFeedback(false);
        return;
      }
      setIsCheckingFeedback(false);

      if (!res.success || !res.data) return;

      const data = res.data;
      if (data.status === 'feedback_pending') return;

      if (data.status === 'feedback_failed') {
        stopPolling();
        setPhase('feedback_failed');
        appendMessage(
          'assistant',
          data.message ?? 'Feedback generation failed. Please start a new interview.'
        );
        return;
      }

      if (data.status === 'completed' && data.feedback_summary) {
        stopPolling();
        setFeedback(data.feedback_summary);
        setPhase('feedback_ready');
        return;
      }

      if (data.status === 'completed') {
        // Report still generating — keep polling.
        return;
      }

      stopPolling();
      setPhase('feedback_failed');
      appendMessage(
        'assistant',
        data.message ?? 'Could not load feedback. Please try again.'
      );
    },
    [appendMessage, isStale, sessionId, stopPolling]
  );

  const startPolling = useCallback(
    (runId: number) => {
      stopPolling();
      void pollFeedback(runId);
      pollRef.current = setInterval(() => void pollFeedback(runId), 5000);
    },
    [pollFeedback, stopPolling]
  );

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

  const beginInterview = useCallback(
    (
      data: {
        session_id: string;
        question_count?: number;
        question_index?: number;
        question?: InterviewQuestion;
        language_notice?: string;
      },
      runId: number
    ) => {
      if (isStale(runId)) return;

      setSessionId(data.session_id);
      setQuestionCount(data.question_count ?? 3);
      setQuestionIndex(data.question_index ?? 1);
      setCurrentQuestion(data.question ?? null);
      setPhase('interview');

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
    [appendMessage, isStale, showQuestion]
  );

  const startSession = useCallback(
    async (role: string) => {
      if (!isLoggedIn || isStarting) return;
      const runId = ++runIdRef.current;
      setIsStarting(true);
      setTargetRole(role);
      setMessages([]);
      setFeedback(null);
      setPrepCard(null);

      const res = await createInterviewSession({
        target_role: role,
        interview_level: DEFAULT_INTERVIEW_LEVEL,
        source_channel: 'web',
        answer_mode: 'text',
        job_id: jobId ?? undefined,
      });

      if (isStale(runId)) return;

      if (!res.success || !res.data) {
        if (res.errorCode === 'ONBOARDING_INCOMPLETE') {
          showToast(res.error ?? 'Complete your profile in chat first', 'error');
        } else {
          showToast(res.error ?? 'Failed to start interview', 'error');
        }
        setPhase('role_select');
        setIsStarting(false);
        return;
      }

      const data = res.data;

      if (data.prep_card && Object.keys(data.prep_card).length > 0) {
        pendingStartRef.current = {
          session_id: data.session_id,
          question_count: data.question_count,
          question_index: data.question_index,
          question: data.question,
          language_notice: data.language_notice,
        };
        setPrepCard(data.prep_card);
        setSessionId(data.session_id);
        setPhase('prep_review');
        setIsStarting(false);
        return;
      }

      beginInterview(data, runId);
    },
    [beginInterview, isLoggedIn, isStale, isStarting, jobId, showToast]
  );

  const beginInterviewFromPrep = useCallback(() => {
    const pending = pendingStartRef.current;
    if (!pending) return;
    const runId = runIdRef.current;
    beginInterview(pending, runId);
    pendingStartRef.current = null;
    setPrepCard(null);
  }, [beginInterview]);

  const submitAnswer = useCallback(
    async (text: string) => {
      if (!text.trim() || !sessionId || !currentQuestion || isSending) return;
      const runId = runIdRef.current;
      setIsSending(true);
      appendMessage('user', text.trim());

      const res = await submitInterviewAnswer(sessionId, {
        question_id: currentQuestion.question_id,
        answer_text: text.trim(),
      });

      if (isStale(runId)) return;

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
        startPolling(runId);
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
      isStale,
      questionCount,
      questionIndex,
      sessionId,
      showQuestion,
      showToast,
      startPolling,
    ]
  );

  const reset = useCallback(() => {
    runIdRef.current += 1;
    stopPolling();
    setPhase('role_select');
    setMessages([]);
    setSessionId(null);
    setTargetRole(null);
    setQuestionIndex(1);
    setQuestionCount(3);
    setCurrentQuestion(null);
    setFeedback(null);
    setPrepCard(null);
    pendingStartRef.current = null;
    setIsStarting(false);
    setIsSending(false);
    setIsCheckingFeedback(false);
  }, [stopPolling]);

  const checkFeedbackNow = useCallback(() => {
    void pollFeedback(runIdRef.current);
  }, [pollFeedback]);

  return {
    phase,
    messages,
    sessionId,
    targetRole,
    prepCard,
    questionIndex,
    questionCount,
    currentQuestion,
    feedback,
    isStarting,
    isSending,
    isCheckingFeedback,
    needsLogin: !isLoggedIn,
    startSession,
    beginInterviewFromPrep,
    submitAnswer,
    reset,
    checkFeedbackNow,
  };
}
