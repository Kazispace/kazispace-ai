'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAgentTransition } from '@/components/agent-transition/agent-transition-provider';
import {
  ackInterviewPrep,
  createInterviewSession,
  getInterviewSession,
  submitInterviewAnswer,
} from '@/lib/interview-api';
import { followAgentEscalation } from '@/lib/agent-escalation';
import { resolveWorkflowFromMessages } from '@/lib/agent-sessions';
import { isNavigationPending, planNavigation } from '@/lib/agent-transition';
import {
  buildAssistantMessageFields,
  handleAgentEnvelope,
} from '@/lib/handle-agent-envelope';
import { formatFeedbackMessage, formatPrepMessage } from '@/lib/interview-message-format';
import { buildMockInterviewWorkflow } from '@/lib/workflow-catalog';
import { DEFAULT_INTERVIEW_LEVEL } from '@/lib/interview-roles';
import { getJobDetail } from '@/lib/jobs-api';
import { useAuthStore, useUIStore } from '@/lib/store';
import type {
  AssistantWorkflow,
  ChatJobCard,
  ChatNextAction,
} from '@/types/chat-envelope';
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

const INTAKE_WELCOME_ID = 'intake_welcome';

type SessionBootstrap = {
  session_id: string;
  question_count?: number;
  question_index?: number;
  question?: InterviewQuestion;
  language_notice?: string;
  target_role?: string;
};

type CreateSessionPayload = CreateInterviewSessionResponse & {
  prep_ack_required?: boolean;
  target_role?: string;
};

function prepCardHasContent(card?: InterviewPrepCard | null): boolean {
  if (!card) return false;
  return Boolean(
    (card.focus_areas?.length ?? 0) > 0 ||
      (card.sample_questions?.length ?? 0) > 0 ||
      card.estimated_duration_min != null
  );
}

function needsPrepGate(data: {
  prep_ack_required?: boolean;
  prep_card?: InterviewPrepCard | null;
}): boolean {
  if (data.prep_ack_required === true) return true;
  if (data.prep_ack_required === false) return false;
  return prepCardHasContent(data.prep_card);
}

function isProfileGateError(code?: string): boolean {
  return code === 'ONBOARDING_INCOMPLETE' || code === 'PROFILE_INCOMPLETE';
}

// §19 P3: phases orchestrate requests/loading inside one shell — not full-page UI trees.
export type InterviewPhase =
  | 'role_select'
  | 'prep_review'
  | 'interview'
  | 'feedback_pending'
  | 'feedback_ready'
  | 'feedback_failed';

export function useInterview(jobId?: string | null) {
  const params = useParams();
  const locale = typeof params.locale === 'string' ? params.locale : 'en';
  const router = useRouter();
  const { activateAgentWithoutPrecheck } = useAgentTransition();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const t = useTranslations('interview');
  const tHub = useTranslations('hub');

  const formatLabels = useCallback(
    () => ({
      prepTitle: t('prepTitle'),
      prepFocusAreas: t('prepFocusAreas'),
      prepSampleQuestions: t('prepSampleQuestions'),
      prepDuration: (values: { min: number }) => t('prepDuration', values),
      prepPrompt: t('prepPrompt'),
      feedbackTitle: (values: { role: string }) => t('feedbackTitle', values),
      feedbackTitleGeneric: t('feedbackTitleGeneric'),
      overallSummary: t('overallSummary'),
      strengths: t('strengths'),
      improvements: t('improvements'),
      weaknessTags: t('weaknessTags'),
      sampleAnswer: t('sampleAnswer'),
      nextStep: t('nextStep'),
      scores: {
        clarity: t('scores.clarity'),
        relevance: t('scores.relevance'),
        confidence: t('scores.confidence'),
      },
    }),
    [t]
  );

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
  const [prepAckRequired, setPrepAckRequired] = useState(false);
  const [jobContext, setJobContext] = useState<InterviewJobContext | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isAckingPrep, setIsAckingPrep] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingFeedback, setIsCheckingFeedback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(0);
  const pendingStartRef = useRef<SessionBootstrap | null>(null);
  const lastAutoStartedJobIdRef = useRef<string | null>(null);
  const jobStartInFlightRef = useRef(false);

  const finishIfStale = useCallback((runId: number) => {
    if (runId !== runIdRef.current) {
      setIsStarting(false);
      setIsAckingPrep(false);
      setIsSending(false);
      setIsCheckingFeedback(false);
      jobStartInFlightRef.current = false;
      return true;
    }
    return false;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const seedIntakeWelcome = useCallback(() => {
    setMessages([
      {
        id: INTAKE_WELCOME_ID,
        role: 'assistant',
        content: t('intakeWelcome'),
      },
    ]);
  }, [t]);

  const resetInterviewSession = useCallback(
    (options?: { messages?: 'clear' | 'welcome' }) => {
      stopPolling();
      setSessionId(null);
      setCurrentQuestion(null);
      setQuestionIndex(1);
      setQuestionCount(3);
      pendingStartRef.current = null;
      setPhase('role_select');
      if (options?.messages === 'welcome') {
        seedIntakeWelcome();
      } else if (options?.messages === 'clear') {
        setMessages([]);
      }
    },
    [seedIntakeWelcome, stopPolling]
  );

  const appendAssistantEnvelope = useCallback(
    (assistant: ReturnType<typeof buildAssistantMessageFields>) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('int'),
          role: 'assistant',
          content: assistant.content,
          ...(assistant.workflow ? { workflow: assistant.workflow } : {}),
          ...(assistant.nextActions
            ? { nextActions: assistant.nextActions }
            : {}),
          ...(assistant.cards ? { cards: assistant.cards } : {}),
        },
      ]);
    },
    []
  );

  const tryHandleAnswerEscalation = useCallback(
    async (data: unknown): Promise<boolean> => {
      const { envelope, assistant, escalation } = handleAgentEnvelope(data);
      if (!envelope.exited && !escalation) return false;

      resetInterviewSession({ messages: 'clear' });
      if (assistant.content && assistant.content !== '…') {
        appendAssistantEnvelope(assistant);
      }

      if (escalation) {
        showToast(tHub('escalationSwitching'), 'info');
        const follow = await followAgentEscalation(escalation, {
          activateAgentWithoutPrecheck,
        });
        if (!follow.ok) {
          showToast(follow.error ?? tHub('escalationFailed'), 'error');
          setIsSending(false);
          return true;
        }
        const plan = planNavigation(locale, 'interview', escalation.targetAgentId);
        if (plan.href && isNavigationPending(plan)) {
          router.replace(plan.href);
        }
      }

      setIsSending(false);
      return true;
    },
    [
      activateAgentWithoutPrecheck,
      appendAssistantEnvelope,
      locale,
      resetInterviewSession,
      router,
      showToast,
      tHub,
    ]
  );

  const appendMessage = useCallback(
    (
      role: 'user' | 'assistant',
      content: string,
      extras?: {
        workflow?: AssistantWorkflow;
        nextActions?: ChatNextAction[];
        cards?: ChatJobCard[];
      }
    ) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('int'),
          role,
          content,
          ...(extras?.workflow ? { workflow: extras.workflow } : {}),
          ...(extras?.nextActions ? { nextActions: extras.nextActions } : {}),
          ...(extras?.cards ? { cards: extras.cards } : {}),
        },
      ]);
    },
    []
  );

  useEffect(() => {
    if (!isLoggedIn || jobId || phase !== 'role_select') return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === INTAKE_WELCOME_ID)) return prev;
      return [
        {
          id: INTAKE_WELCOME_ID,
          role: 'assistant',
          content: t('intakeWelcome'),
        },
      ];
    });
  }, [isLoggedIn, jobId, phase, t]);

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
      if (!sessionId) return;
      setIsCheckingFeedback(true);
      const res = await getInterviewSession(sessionId);
      if (finishIfStale(runId)) return;
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
        appendMessage(
          'assistant',
          formatFeedbackMessage(
            data.feedback_summary,
            data.target_role ?? targetRole,
            formatLabels()
          )
        );
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
    [appendMessage, finishIfStale, formatLabels, sessionId, stopPolling, targetRole]
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
    (
      q: InterviewQuestion,
      idx: number,
      total: number,
      extras?: {
        content?: string;
        workflow?: AssistantWorkflow;
        nextActions?: ChatNextAction[];
        cards?: ChatJobCard[];
      }
    ) => {
      setQuestionIndex(idx);
      setQuestionCount(total);
      setCurrentQuestion(q);
      const content =
        extras?.content && extras.content !== '…'
          ? extras.content
          : `**Question ${idx}** (${q.category})\n\n${q.content}`;
      appendMessage('assistant', content, {
        workflow: extras?.workflow,
        nextActions: extras?.nextActions,
        cards: extras?.cards,
      });
    },
    [appendMessage]
  );

  const beginInterview = useCallback(
    (data: SessionBootstrap, runId: number) => {
      if (finishIfStale(runId)) return;

      setSessionId(data.session_id);
      setQuestionCount(data.question_count ?? 3);
      setQuestionIndex(data.question_index ?? 1);
      setCurrentQuestion(data.question ?? null);
      if (data.target_role) setTargetRole(data.target_role);
      setPhase('interview');
      setPrepCard(null);
      setPrepAckRequired(false);

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
      jobStartInFlightRef.current = false;
    },
    [appendMessage, finishIfStale, showQuestion]
  );

  const storePendingBootstrap = useCallback((data: CreateSessionPayload) => {
    pendingStartRef.current = {
      session_id: data.session_id,
      question_count: data.question_count,
      question_index: data.question_index,
      question: data.question,
      language_notice: data.language_notice,
      target_role: data.target_role,
    };
    setSessionId(data.session_id);
  }, []);

  const enterPrepReview = useCallback(
    (data: CreateSessionPayload, runId: number) => {
      if (finishIfStale(runId)) return;
      storePendingBootstrap(data);
      setPrepCard(data.prep_card ?? null);
      setPrepAckRequired(Boolean(data.prep_ack_required));
      if (data.target_role) setTargetRole(data.target_role);
      setPhase('prep_review');
      appendMessage(
        'assistant',
        formatPrepMessage(data.prep_card, jobContext, formatLabels())
      );
      setIsStarting(false);
      jobStartInFlightRef.current = false;
    },
    [appendMessage, finishIfStale, formatLabels, jobContext, storePendingBootstrap]
  );

  const autoAckPrepAndBegin = useCallback(
    async (data: CreateSessionPayload, runId: number, action: PrepAckAction = 'skip') => {
      storePendingBootstrap(data);
      setIsAckingPrep(true);
      const res = await ackInterviewPrep(data.session_id, { action });
      if (finishIfStale(runId)) return;

      if (!res.success || !res.data) {
        showToast(res.error ?? 'Failed to start interview', 'error');
        setIsAckingPrep(false);
        setIsStarting(false);
        setPhase('role_select');
        jobStartInFlightRef.current = false;
        return;
      }

      beginInterview(
        {
          session_id: res.data.session_id,
          question_count: data.question_count,
          question_index: data.question_index ?? 1,
          question: res.data.question,
          language_notice: data.language_notice,
          target_role: data.target_role,
        },
        runId
      );
      pendingStartRef.current = null;
    },
    [beginInterview, finishIfStale, showToast, storePendingBootstrap]
  );

  const handleCreateResponse = useCallback(
    async (data: CreateSessionPayload, runId: number) => {
      if (data.target_role) setTargetRole(data.target_role);

      if (needsPrepGate(data)) {
        if (data.prep_ack_required && !prepCardHasContent(data.prep_card)) {
          await autoAckPrepAndBegin(data, runId, 'skip');
          return;
        }
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
    [autoAckPrepAndBegin, beginInterview, enterPrepReview]
  );

  const startSession = useCallback(
    async (role: string) => {
      if (!isLoggedIn || isStarting) return;
      const runId = ++runIdRef.current;
      setIsStarting(true);
      setTargetRole(role);
      setFeedback(null);
      setDiagnosisCtas([]);
      setPrepCard(null);
      setPrepAckRequired(false);
      pendingStartRef.current = null;

      const res = await createInterviewSession({
        target_role: role,
        interview_level: DEFAULT_INTERVIEW_LEVEL,
        source_channel: 'web',
        answer_mode: 'text',
        job_id: jobId ?? undefined,
      });

      if (finishIfStale(runId)) return;

      if (!res.success || !res.data) {
        if (isProfileGateError(res.errorCode)) {
          showToast(res.error ?? 'Complete your profile in chat first', 'error');
        } else {
          showToast(res.error ?? 'Failed to start interview', 'error');
        }
        setPhase('role_select');
        setIsStarting(false);
        return;
      }

      await handleCreateResponse(res.data, runId);
    },
    [finishIfStale, handleCreateResponse, isLoggedIn, isStarting, jobId, showToast]
  );

  const startJobSession = useCallback(
    async (overrideJobId?: string | null) => {
      const effectiveJobId = overrideJobId ?? jobId;
      if (!isLoggedIn || !effectiveJobId || jobStartInFlightRef.current) return;

      jobStartInFlightRef.current = true;
      const runId = ++runIdRef.current;
      setIsStarting(true);
      setPhase('role_select');
      setMessages([]);
      setFeedback(null);
      setDiagnosisCtas([]);
      setPrepCard(null);
      setPrepAckRequired(false);
      pendingStartRef.current = null;

      const res = await createInterviewSession({
        target_role: '',
        interview_level: DEFAULT_INTERVIEW_LEVEL,
        source_channel: 'web',
        answer_mode: 'text',
        job_id: effectiveJobId,
      });

      if (finishIfStale(runId)) return;

      if (!res.success || !res.data) {
        if (isProfileGateError(res.errorCode)) {
          showToast(res.error ?? 'Complete your profile in chat first', 'error');
        } else {
          showToast(res.error ?? 'Failed to start interview', 'error');
        }
        setPhase('role_select');
        setIsStarting(false);
        jobStartInFlightRef.current = false;
        return;
      }

      await handleCreateResponse(res.data, runId);
    },
    [finishIfStale, handleCreateResponse, isLoggedIn, jobId, showToast]
  );

  useEffect(() => {
    if (!jobId || !isLoggedIn) {
      lastAutoStartedJobIdRef.current = null;
      return;
    }
    if (lastAutoStartedJobIdRef.current === jobId) return;
    lastAutoStartedJobIdRef.current = jobId;
    void startJobSession(jobId);
  }, [jobId, isLoggedIn, startJobSession]);

  const ackPrep = useCallback(
    async (action: PrepAckAction) => {
      const sid = sessionId ?? pendingStartRef.current?.session_id;
      if (!sid || isAckingPrep) return;
      const runId = runIdRef.current;
      setIsAckingPrep(true);

      const res = await ackInterviewPrep(sid, { action });

      if (finishIfStale(runId)) return;

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
    [beginInterview, finishIfStale, isAckingPrep, sessionId, showToast]
  );

  const submitIntake = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !isLoggedIn || isStarting || jobId) return;
      appendMessage('user', trimmed);
      await startSession(trimmed);
    },
    [appendMessage, isLoggedIn, isStarting, jobId, startSession]
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

      if (finishIfStale(runId)) return;

      if (res.success && res.data) {
        if (await tryHandleAnswerEscalation(res.data)) return;
      }

      if (!res.success || !res.data) {
        // TODO(KAZI-128): prefer errorCode === 'SESSION_ABANDONED' once BE stabilizes.
        if (
          res.errorCode === 'SESSION_ABANDONED' ||
          /abandoned/i.test(res.error ?? '')
        ) {
          resetInterviewSession({ messages: 'welcome' });
          setIsSending(false);
          showToast(t('sessionEnded'), 'info');
          return;
        }
        showToast(res.error ?? 'Failed to submit answer', 'error');
        setIsSending(false);
        return;
      }

      const data = res.data;
      const { assistant } = handleAgentEnvelope(data);
      if (data.status === 'completed') {
        setCurrentQuestion(null);
        setPhase('feedback_pending');
        appendMessage(
          'assistant',
          data.loading_hint ??
            assistant.content ??
            'All answers submitted! Generating your personalized feedback…',
          {
            workflow: assistant.workflow,
            nextActions: assistant.nextActions,
            cards: assistant.cards,
          }
        );
        startPolling(runId);
        setIsSending(false);
        return;
      }

      if (data.next_question) {
        showQuestion(data.next_question, questionIndex + 1, questionCount, {
          content: assistant.content,
          workflow: assistant.workflow,
          nextActions: assistant.nextActions,
          cards: assistant.cards,
        });
      }
      setIsSending(false);
    },
    [
      appendMessage,
      questionCount,
      questionIndex,
      resetInterviewSession,
      currentQuestion,
      finishIfStale,
      isSending,
      sessionId,
      showQuestion,
      showToast,
      startPolling,
      t,
      tryHandleAnswerEscalation,
    ]
  );

  const reset = useCallback(() => {
    runIdRef.current += 1;
    stopPolling();
    jobStartInFlightRef.current = false;
    setPhase('role_select');
    setSessionId(null);
    setTargetRole(null);
    setQuestionIndex(1);
    setQuestionCount(3);
    setCurrentQuestion(null);
    setFeedback(null);
    setDiagnosisCtas([]);
    setPrepCard(null);
    setPrepAckRequired(false);
    pendingStartRef.current = null;
    setIsStarting(false);
    setIsAckingPrep(false);
    setIsSending(false);
    setIsCheckingFeedback(false);
    if (jobId) {
      lastAutoStartedJobIdRef.current = null;
      setMessages([]);
      void startJobSession(jobId);
    } else {
      seedIntakeWelcome();
    }
  }, [jobId, seedIntakeWelcome, startJobSession, stopPolling]);

  const retrySession = useCallback(
    (overrideJobId?: string | null) => {
      runIdRef.current += 1;
      stopPolling();
      jobStartInFlightRef.current = false;
      setMessages([]);
      setSessionId(null);
      setQuestionIndex(1);
      setQuestionCount(3);
      setCurrentQuestion(null);
      setFeedback(null);
      setDiagnosisCtas([]);
      setPrepCard(null);
      setPrepAckRequired(false);
      pendingStartRef.current = null;
      setIsSending(false);
      setIsCheckingFeedback(false);

      const effectiveJobId =
        typeof overrideJobId === 'string' && overrideJobId.length > 0
          ? overrideJobId
          : jobId;
      if (effectiveJobId) {
        lastAutoStartedJobIdRef.current = null;
        setMessages([]);
        void startJobSession(effectiveJobId);
      } else {
        setPhase('role_select');
        setTargetRole(null);
        setIsStarting(false);
        seedIntakeWelcome();
      }
    },
    [jobId, seedIntakeWelcome, startJobSession, stopPolling]
  );

  const checkFeedbackNow = useCallback(() => {
    void pollFeedback(runIdRef.current);
  }, [pollFeedback]);

  const displayRole = jobContext?.title ?? targetRole;

  const miWorkflowLabels = useMemo(
    () => ({
      prep: t('workflow.prep'),
      questions: t('workflow.questions'),
      feedback: t('workflow.feedback'),
      report: t('workflow.report'),
      questionDetail: (values: { current: number; total: number }) =>
        t('questionOf', values),
    }),
    [t]
  );

  const activeWorkflow = useMemo(
    () =>
      resolveWorkflowFromMessages(messages, () =>
        buildMockInterviewWorkflow(phase, miWorkflowLabels, questionIndex, questionCount)
      ),
    [messages, miWorkflowLabels, phase, questionIndex, questionCount]
  );

  return {
    phase,
    messages,
    sessionId,
    targetRole,
    displayRole,
    activeWorkflow,
    prepCard,
    prepAckRequired,
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
    submitIntake,
    ackPrep,
    submitAnswer,
    reset,
    retrySession,
    checkFeedbackNow,
  };
}
