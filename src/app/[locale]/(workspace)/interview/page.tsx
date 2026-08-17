"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { ChatInput } from "@/components/chat/chat-input";
import { HubMessageList } from "@/components/chat/hub-message-list";
import {
  AgentTransitionProvider,
  useAgentTransition,
} from "@/components/agent-transition/agent-transition-provider";
import { HubAgentShell } from "@/components/hub/hub-agent-shell";
import { HubWorkflowStrip } from "@/components/hub/hub-workflow-strip";
import { QuickReplies } from "@/components/clinic/quick-replies";
import { InterviewFeedbackActions } from "@/components/interview/interview-feedback-actions";
import { InterviewWorkspace } from "@/components/interview/interview-workspace";
import { IrpDiagnosisUpdate } from "@/components/interview/irp-diagnosis-update";
import { Button } from "@/components/ui/button";
import { HubSessionStaleBanner } from "@/components/hub/hub-session-stale-banner";
import { useInterview } from "@/hooks/use-interview";
import { useHubActiveAgentSync } from "@/hooks/use-hub-active-agent-sync";
import { useHubSessionStaleBanner } from "@/hooks/use-hub-session-stale-banner";
import { MOCK_INTERVIEW_AGENT_ID } from "@/lib/mock-interview-config";
import { useInterviewProfile } from "@/hooks/use-interview-profile";
import { INTAKE_SUGGESTION_KEYS } from "@/lib/interview-intake";
import type { InterviewCta } from "@/types";
import { useUIStore, useAuthStore } from "@/lib/store";

interface InterviewPageProps {
  params: { locale: string };
}

function InterviewPageContent({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const t = useTranslations("interview");
  const showToast = useUIStore((s) => s.showToast);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { openSwitcher } = useAgentTransition();

  const {
    phase,
    messages,
    displayRole,
    activeWorkflow,
    questionIndex,
    questionCount,
    diagnosisCtas,
    prepCard,
    prepAckRequired,
    jobContext,
    isStarting,
    isAckingPrep,
    isSending,
    isCheckingFeedback,
    needsLogin,
    isJobMode,
    startJobSession,
    submitIntake,
    ackPrep,
    submitAnswer,
    reset,
    retrySession,
    checkFeedbackNow,
    agentSessionId,
    resyncSession,
  } = useInterview(jobId);

  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionStale = useHubSessionStaleBanner(
    MOCK_INTERVIEW_AGENT_ID,
    agentSessionId,
    !needsLogin,
    resyncSession
  );

  useHubActiveAgentSync(locale, MOCK_INTERVIEW_AGENT_ID, !needsLogin);

  const {
    irpEnabled,
    profile,
    profileStatus,
    isProfileLoading,
    profileError,
    refetchProfile,
  } = useInterviewProfile({ enabled: !needsLogin });

  const [profileBaselineUpdatedAt, setProfileBaselineUpdatedAt] = useState<string | null>(
    null
  );

  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (phase === "feedback_pending" && prevPhaseRef.current !== "feedback_pending") {
      setProfileBaselineUpdatedAt(profile?.updated_at ?? null);
    }
    prevPhaseRef.current = phase;
  }, [phase, profile?.updated_at]);

  const subtitle = useMemo(() => {
    if (jobContext) {
      return t("subtitleWithJobDetail", {
        title: jobContext.title,
        company: jobContext.company,
      });
    }
    if (jobId) return t("subtitleWithJob", { jobId });
    return null;
  }, [jobContext, jobId, t]);

  const handleCtaAction = useCallback(
    (cta: InterviewCta) => {
      switch (cta.cta_type) {
        case "weakness_drill":
          showToast(t("drillComingSoon"), "info");
          break;
        case "retry_full":
          retrySession(cta.job_id ?? jobId);
          break;
        default:
          break;
      }
    },
    [jobId, retrySession, showToast, t]
  );

  const handleReset = useCallback(() => {
    setProfileBaselineUpdatedAt(null);
    reset();
  }, [reset]);

  const intakeQuickReplies = useMemo(
    () => INTAKE_SUGGESTION_KEYS.map((key) => t(`intakeSuggestions.${key}`)),
    [t]
  );

  const prepQuickReplies = useMemo(
    () => [t("startInterview"), t("skipPrep")],
    [t]
  );

  const quickReplies = useMemo(() => {
    if (phase === "role_select" && !isJobMode) return intakeQuickReplies;
    if (phase === "prep_review" && (prepCard || prepAckRequired)) return prepQuickReplies;
    return [];
  }, [intakeQuickReplies, isJobMode, phase, prepAckRequired, prepCard, prepQuickReplies]);

  const handleQuickReply = useCallback(
    (text: string) => {
      if (phase === "role_select" && !isJobMode) {
        void submitIntake(text);
        return;
      }
      if (phase === "prep_review") {
        if (text === t("startInterview")) void ackPrep("start");
        else if (text === t("skipPrep")) void ackPrep("skip");
      }
    },
    [ackPrep, isJobMode, phase, submitIntake, t]
  );

  const showChatInput =
    !needsLogin &&
    ((phase === "role_select" && !isJobMode) || phase === "interview");

  const inputDisabled =
    isStarting ||
    isSending ||
    isAckingPrep ||
    (phase === "role_select" && irpEnabled && isProfileLoading && !jobId);

  const handleSend = useCallback(
    (text: string) => {
      if (phase === "role_select") {
        void submitIntake(text);
        return;
      }
      void submitAnswer(text);
    },
    [phase, submitAnswer, submitIntake]
  );

  const showJobBootstrapping =
    isJobMode &&
    !needsLogin &&
    (phase === "role_select" || (phase === "prep_review" && !prepCard)) &&
    isStarting;

  const shellHeader = (
    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-lg font-bold text-kazi-navy">
          {displayRole ? `🎤 ${displayRole}` : t("title")}
        </h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        {phase === "interview" && (
          <p className="text-xs text-gray-500">
            {t("questionOf", { current: questionIndex, total: questionCount })}
          </p>
        )}
        {phase === "feedback_pending" && (
          <div className="flex items-center gap-1.5 text-xs text-kazi-orange mt-0.5">
            <div className="w-3 h-3 border-2 border-kazi-orange/30 border-t-kazi-orange rounded-full animate-spin shrink-0" />
            <span>{t("feedbackPending")}</span>
          </div>
        )}
      </div>
      {phase !== "role_select" ? (
        <Button size="sm" variant="outline" onClick={handleReset}>
          {t("newInterview")}
        </Button>
      ) : null}
    </div>
  );

  const chatBody = (
    <>
      {irpEnabled && profileStatus === "provisional" && !jobId && phase === "role_select" && (
        <p className="text-xs text-amber-700 bg-amber-50 border-b border-amber-100 px-4 py-2">
          {t("irp.provisionalBanner", {
            remaining: Math.max(0, 3 - (profile?.total_training_rounds ?? 0)),
          })}
        </p>
      )}
      {irpEnabled && profileError && !jobId && phase === "role_select" && (
        <div className="mx-4 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center space-y-2">
          <p className="text-xs text-red-700">{t("irp.profileLoadFailed")}</p>
          <Button size="sm" variant="outline" onClick={() => void refetchProfile()}>
            {t("irp.profileRetry")}
          </Button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col bg-gray-bg min-h-0"
      >
        <HubWorkflowStrip workflow={activeWorkflow} locale={locale} />
        <div className="flex-1 p-4 flex flex-col gap-3 max-w-3xl mx-auto w-full">
        {showJobBootstrapping && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
            <p className="text-sm text-gray-600">{t("sessionLoading")}</p>
          </div>
        ) : (
          <HubMessageList
            messages={messages}
            locale={locale}
            isStreaming={false}
            scrollParentRef={scrollRef}
          />
        )}

        {phase === "feedback_pending" && (
          <div className="flex items-center gap-2 text-sm text-gray-500 self-start">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin shrink-0" />
            <span>{t("feedbackPending")}</span>
          </div>
        )}

        {phase === "feedback_ready" && (
          <>
            <InterviewFeedbackActions
              ctas={diagnosisCtas}
              locale={locale}
              jobId={jobId}
              onCtaAction={handleCtaAction}
            />
            <IrpDiagnosisUpdate
              enabled={irpEnabled}
              baselineUpdatedAt={profileBaselineUpdatedAt}
            />
          </>
        )}

        {phase === "feedback_failed" && (
          <Button size="sm" onClick={handleReset} className="self-start">
            {t("tryAgain")}
          </Button>
        )}

        {isJobMode && phase === "role_select" && !isStarting && !needsLogin && (
          <div className="self-start space-y-2">
            <p className="text-sm text-gray-700">{t("startFailed")}</p>
            <Button size="sm" onClick={() => void startJobSession()}>
              {t("retryStart")}
            </Button>
          </div>
        )}
        </div>
      </div>
    </>
  );

  const composerPrefix = (
    <>
      {phase === "feedback_pending" && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-orange-50 border-b border-orange-100">
          <div className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin shrink-0" />
            <span className="truncate">{t("feedbackPending")}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 text-xs"
            onClick={checkFeedbackNow}
            disabled={isCheckingFeedback}
          >
            {t("checkFeedback")}
          </Button>
        </div>
      )}
      {quickReplies.length > 0 ? (
        <QuickReplies
          options={quickReplies}
          disabled={inputDisabled}
          onSelect={handleQuickReply}
        />
      ) : null}
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      {sessionStale.stale ? (
        <HubSessionStaleBanner
          onRefresh={sessionStale.refresh}
          onDismiss={sessionStale.dismiss}
        />
      ) : null}
      <main className="flex min-h-0 flex-1 w-full flex-col">
        {needsLogin ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
              <p className="text-sm text-gray-700 mb-4">{t("loginBanner")}</p>
              <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
                {t("signIn")}
              </Button>
            </div>
          </div>
        ) : (
          <HubAgentShell
            header={shellHeader}
            workspace={
              !needsLogin ? (
                <InterviewWorkspace
                  locale={locale}
                  showProfileLink={irpEnabled}
                  onPracticeForJob={(ctx) => {
                    // Already on interview page — start job session for this role.
                    if (ctx.jobTitle?.trim()) {
                      void submitIntake(ctx.jobTitle.trim());
                    } else if (jobId) {
                      void startJobSession();
                    }
                  }}
                />
              ) : undefined
            }
            composerPrefix={
              phase === "feedback_pending" || quickReplies.length > 0
                ? composerPrefix
                : undefined
            }
            input={
              showChatInput ? (
                <ChatInput
                  onSend={handleSend}
                  disabled={inputDisabled}
                  placeholder={
                    phase === "role_select"
                      ? t("intakePlaceholder")
                      : t("inputPlaceholder")
                  }
                  showAgentButton
                  onOpenAgents={openSwitcher}
                />
              ) : undefined
            }
          >
            {chatBody}
          </HubAgentShell>
        )}
      </main>
    </div>
  );
}

export default function InterviewPage({ params }: InterviewPageProps) {
  const t = useTranslations("interview");
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <AgentTransitionProvider
      locale={params.locale}
      fromSurface="interview"
      hubAgentId={MOCK_INTERVIEW_AGENT_ID}
      isLoggedIn={isLoggedIn}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-gray-500">
            {t("loading")}
          </div>
        }
      >
        <InterviewPageContent locale={params.locale} />
      </Suspense>
    </AgentTransitionProvider>
  );
}
