"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/clinic/message-bubble";
import { InterviewRolePicker } from "@/components/interview/interview-role-picker";
import { InterviewPrepCard } from "@/components/interview/interview-prep-card";
import { InterviewProgress } from "@/components/interview/interview-progress";
import { InterviewFeedbackCard } from "@/components/interview/interview-feedback-card";
import { Button } from "@/components/ui/button";
import { useInterview } from "@/hooks/use-interview";
import type { InterviewCta } from "@/types";
import { useUIStore } from "@/lib/store";

interface InterviewPageProps {
  params: { locale: string };
}

function InterviewPageContent({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const t = useTranslations("interview");
  const showToast = useUIStore((s) => s.showToast);

  const {
    phase,
    messages,
    targetRole,
    questionIndex,
    questionCount,
    feedback,
    diagnosisCtas,
    prepCard,
    jobContext,
    isStarting,
    isAckingPrep,
    isSending,
    isCheckingFeedback,
    needsLogin,
    isJobMode,
    startSession,
    startJobSession,
    ackPrep,
    submitAnswer,
    reset,
    retrySession,
    checkFeedbackNow,
  } = useInterview(jobId);

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
          retrySession();
          break;
        default:
          break;
      }
    },
    [retrySession, showToast, t]
  );

  const showInput = phase === "interview" && !needsLogin;
  const showProgress = phase === "interview" && !needsLogin;
  const prepBusy = isStarting || isAckingPrep;

  const showJobBootstrapping =
    isJobMode &&
    needsLogin === false &&
    (phase === "role_select" || (phase === "prep_review" && !prepCard)) &&
    isStarting;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      <Header locale={locale} />
      <main className="pt-16 flex-1 flex flex-col max-w-3xl mx-auto w-full">
        {showJobBootstrapping ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
            <p className="text-sm text-gray-600">{t("sessionLoading")}</p>
            {subtitle && (
              <p className="text-center text-xs text-gray-500 px-4">{subtitle}</p>
            )}
          </div>
        ) : phase === "role_select" ? (
          <>
            {subtitle && (
              <p className="text-center text-xs text-gray-500 px-4 pt-2">{subtitle}</p>
            )}
            {needsLogin ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
                  <p className="text-sm text-gray-700 mb-4">{t("loginBanner")}</p>
                  <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
                    {t("signIn")}
                  </Button>
                </div>
              </div>
            ) : isJobMode ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 text-center max-w-sm mx-auto">
                <p className="text-sm text-gray-700">{t("startFailed")}</p>
                <Button size="sm" onClick={() => void startJobSession()}>
                  {t("retryStart")}
                </Button>
              </div>
            ) : (
              <InterviewRolePicker
                onSelect={(role) => void startSession(role)}
                disabled={isStarting}
              />
            )}
          </>
        ) : phase === "prep_review" && prepCard ? (
          <>
            {subtitle && (
              <p className="text-center text-xs text-gray-500 px-4 pt-2">{subtitle}</p>
            )}
            <InterviewPrepCard
              prep={prepCard}
              jobContext={jobContext}
              locale={locale}
              jobId={jobId}
              onStart={() => void ackPrep("start")}
              onSkip={() => void ackPrep("skip")}
              disabled={prepBusy}
            />
          </>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
              <div>
                <Link
                  href={`/${locale}/mine`}
                  className="text-xs text-kazi-orange font-medium"
                >
                  {t("backToMine")}
                </Link>
                <h1 className="text-lg font-bold text-kazi-navy mt-1">
                  {targetRole ? `🎤 ${targetRole}` : t("title")}
                </h1>
                {phase === "interview" && (
                  <p className="text-xs text-gray-500">
                    {t("questionOf", { current: questionIndex, total: questionCount })}
                  </p>
                )}
                {phase === "feedback_pending" && (
                  <p className="text-xs text-gray-500">{t("completed")}</p>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={reset}>
                {t("newInterview")}
              </Button>
            </div>

            {showProgress && (
              <InterviewProgress
                questionIndex={questionIndex}
                questionCount={questionCount}
              />
            )}

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-bg min-h-[40vh]">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  variant="agent"
                />
              ))}

              {phase === "feedback_pending" && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 text-center max-w-sm self-start">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-600">{t("feedbackPending")}</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={checkFeedbackNow}
                    disabled={isCheckingFeedback}
                  >
                    {t("checkFeedback")}
                  </Button>
                </div>
              )}

              {phase === "feedback_ready" && feedback && (
                <InterviewFeedbackCard
                  targetRole={targetRole}
                  feedback={feedback}
                  ctas={diagnosisCtas}
                  locale={locale}
                  jobId={jobId}
                  onCtaAction={handleCtaAction}
                  onPracticeAgain={retrySession}
                />
              )}

              {phase === "feedback_failed" && (
                <Button size="sm" onClick={reset}>
                  {t("tryAgain")}
                </Button>
              )}
            </div>

            {showInput && (
              <ChatInput
                onSend={(text) => void submitAnswer(text)}
                disabled={isSending}
                placeholder={t("inputPlaceholder")}
              />
            )}
          </>
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}

export default function InterviewPage({ params }: InterviewPageProps) {
  const t = useTranslations("interview");
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          {t("loading")}
        </div>
      }
    >
      <InterviewPageContent locale={params.locale} />
    </Suspense>
  );
}
