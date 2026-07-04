'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ackInterviewPrep,
  createInterviewSession,
  getInterviewSession,
  submitInterviewAnswer,
} from '@/lib/interview-api';
import { DEFAULT_INTERVIEW_LEVEL } from '@/lib/interview-roles';
import { getJobDetail } from '@/lib/jobs-api';
import { useAuthStore, useUIStore } from '@/lib/store';
import type {
  CreateInterviewSessionResponse,
  InterviewCta,
  InterviewFeedbackSummary,
  InterviewJobContext,
  InterviewMessage,
  InterviewPrepCard,
  InterviewQuestion,
  PrepAckAction,
} from '@/types';

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type SessionBootstrap = {
  session_id: string;
  question_count?: number;
  question_index?: number;
  question?: InterviewQuestion;
  language_notice?: string;
  target_role?: string;
};

function needsPrepGate(data: {
  prep_ack_required?: boolean;
  prep_card?: InterviewPrepCard | null;
}): boolean {
  if (data.prep_ack_required === true) return true;
  if (data.prep_ack_required === false) return false;
  return Boolean(data.prep_card && Object.keys(data.prep_card).length > 0);
}

function isProfileGateError(code?: string): boolean {
  return code === 'ONBOARDING_INCOMPLETE' || code === 'PROFILE_INCOMPLETE';
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
  const [diagnosisCtas, setDiagnosisCtas] = useState<InterviewCta[]>([]);
  const [prepCard, setPrepCard] = useState<InterviewPrepCard | null>(null);
  const [jobContext, setJobContext] = useState<InterviewJobContext | null>(null);
  const [isStarting, setIsStarting] = useState(Boolean(jobId));
  const [isAckingPrep, setIsAckingPrep] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingFeedback, setIsCheckingFeedback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);
  const pendingStartRef = useRef<SessionBootstrap | null>(null);
  const jobAutoStartRef = useRef(false);

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

  useEffect(() => {
    if (!jobId || !isLoggedIn) {
      setJobContext(null);
      return;
    }
    let cancelled = false;
    void getJobDetail(jobId).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      setJobContext({
        jobId,
        title: res.data.title,
        company: res.data.company,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, isLoggedIn]);

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
        setDiagnosisCtas(data.ctas ?? []);
        if (data.target_role) setTargetRole(data.target_role);
        setPhase('feedback_ready');
        return;
      }

      if (data.status === 'completed') {
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
    (data: SessionBootstrap, runId: number) => {
      if (isStale(runId)) return;

      setSessionId(data.session_id);
      setQuestionCount(data.question_count ?? 3);
      setQuestionIndex(data.question_index ?? 1);
      setCurrentQuestion(data.question ?? null);
      if (data.target_role) setTargetRole(data.target_role);
      setPhase('interview');
      setPrepCard(null);

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
      setIsAckingPrep(false);
    },
    [appendMessage, isStale, showQuestion]
  );

  const enterPrepReview = useCallback(
    (data: CreateInterviewSessionResponse & { prep_ack_required?: boolean }, runId: number) => {
      if (isStale(runId)) return;
      pendingStartRef.current = {
        session_id: data.session_id,
        question_count: data.question_count,
        question_index: data.question_index,
        question: data.question,
        language_notice: data.language_notice,
        target_role: (data as { target_role?: string }).target_role,
      };
      setPrepCard(data.prep_card ?? null);
      setSessionId(data.session_id);
      if ((data as { target_role?: string }).target_role) {
        setTargetRole((data as { target_role?: string }).target_role ?? null);
      }
      setPhase('prep_review');
      setIsStarting(false);
    },
    [isStale]
  );

  const handleCreateResponse = useCallback(
    (data: CreateInterviewSessionResponse & { prep_ack_required?: boolean; target_role?: string }, runId: number) => {
      if (data.target_role) setTargetRole(data.target_role);

      if (needsPrepGate(data)) {
        enterPrepReview(data, runId);
        return;
      }

      beginInterview(
        {
          session_id: data.session_id,
          question_count: data.question_count,
          question_index: data.question_index,
          question: data.question,
          language_notice: data.language_notice,
          target_role: data.target_role,
        },
        runId
      );
    },
    [beginInterview, enterPrepReview]
  );

  const startSession = useCallback(
    async (role: string) => {
      if (!isLoggedIn || isStarting) return;
      const runId = ++runIdRef.current;
      setIsStarting(true);
      setTargetRole(role);
      setMessages([]);
      setFeedback(null);
      setDiagnosisCtas([]);
      setPrepCard(null);
      pendingStartRef.current = null;

      const res = await createInterviewSession({
        target_role: role,
        interview_level: DEFAULT_INTERVIEW_LEVEL,
        source_channel: 'web',
        answer_mode: 'text',
        job_id: jobId ?? undefined,
      });

      if (isStale(runId)) return;

      if (!res.success || !res.data) {
        if (isProfileGateError(res.errorCode)) {
          showToast(res.error ?? 'Complete your profile in chat first', 'error');
        } else {
          showToast(res.error ?? 'Failed to start interview', 'error');
        }
        setPhase(jobId ? 'role_select' : 'role_select');
        setIsStarting(false);
        return;
      }

      handleCreateResponse(res.data, runId);
    },
    [handleCreateResponse, isLoggedIn, isStale, isStarting, jobId, showToast]
  );

  const startJobSession = useCallback(async () => {
    if (!isLoggedIn || !jobId || isStarting) return;
    const runId = ++runIdRef.current;
    setIsStarting(true);
    setMessages([]);
    setFeedback(null);
    setDiagnosisCtas([]);
    setPrepCard(null);
    pendingStartRef.current = null;

    const res = await createInterviewSession({
      target_role: '',
      interview_level: DEFAULT_INTERVIEW_LEVEL,
      source_channel: 'web',
      answer_mode: 'text',
      job_id: jobId,
    });

    if (isStale(runId)) return;

    if (!res.success || !res.data) {
      if (isProfileGateError(res.errorCode)) {
        showToast(res.error ?? 'Complete your profile in chat first', 'error');
      } else {
        showToast(res.error ?? 'Failed to start interview', 'error');
      }
      setIsStarting(false);
      return;
    }

    handleCreateResponse(res.data, runId);
  }, [handleCreateResponse, isLoggedIn, isStale, isStarting, jobId, showToast]);

  useEffect(() => {
    if (!jobId || !isLoggedIn || jobAutoStartRef.current) return;
    jobAutoStartRef.current = true;
    void startJobSession();
  }, [jobId, isLoggedIn, startJobSession]);

  const ackPrep = useCallback(
    async (action: PrepAckAction) => {
      const sid = sessionId ?? pendingStartRef.current?.session_id;
      if (!sid || isAckingPrep) return;
      const runId = runIdRef.current;
      setIsAckingPrep(true);

      const res = await ackInterviewPrep(sid, { action });

      if (isStale(runId)) return;

      if (!res.success || !res.data) {
        showToast(res.error ?? 'Failed to start interview', 'error');
        setIsAckingPrep(false);
        return;
      }

      const pending = pendingStartRef.current;
      beginInterview(
        {
          session_id: res.data.session_id,
          question_count: pending?.question_count,
          question_index: pending?.question_index ?? 1,
          question: res.data.question,
          language_notice: pending?.language_notice,
          target_role: pending?.target_role,
        },
        runId
      );
      pendingStartRef.current = null;
    },
    [beginInterview, isAckingPrep, isStale, sessionId, showToast]
  );

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
    setDiagnosisCtas([]);
    setPrepCard(null);
    pendingStartRef.current = null;
    setIsStarting(false);
    setIsAckingPrep(false);
    setIsSending(false);
    setIsCheckingFeedback(false);
    if (jobId) {
      void startJobSession();
    }
  }, [jobId, startJobSession, stopPolling]);

  const retrySession = useCallback(() => {
    runIdRef.current += 1;
    stopPolling();
    setMessages([]);
    setSessionId(null);
    setQuestionIndex(1);
    setQuestionCount(3);
    setCurrentQuestion(null);
    setFeedback(null);
    setDiagnosisCtas([]);
    setPrepCard(null);
    pendingStartRef.current = null;
    setIsSending(false);
    setIsCheckingFeedback(false);
    if (jobId) {
      void startJobSession();
    } else {
      setPhase('role_select');
      setTargetRole(null);
      setIsStarting(false);
    }
  }, [jobId, startJobSession, stopPolling]);

  const checkFeedbackNow = useCallback(() => {
    void pollFeedback(runIdRef.current);
  }, [pollFeedback]);

  return {
    phase,
    messages,
    sessionId,
    targetRole,
    prepCard,
    jobContext,
    questionIndex,
    questionCount,
    currentQuestion,
    feedback,
    diagnosisCtas,
    isStarting,
    isAckingPrep,
    isSending,
    isCheckingFeedback,
    needsLogin: !isLoggedIn,
    isJobMode: Boolean(jobId),
    startSession,
    startJobSession,
    ackPrep,
    submitAnswer,
    reset,
    retrySession,
    checkFeedbackNow,
  };
}
