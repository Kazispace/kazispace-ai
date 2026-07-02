"use client";

import { Suspense, useMemo } from "react";
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

interface InterviewPageProps {
  params: { locale: string };
}

function InterviewPageContent({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const t = useTranslations("interview");

  const {
    phase,
    messages,
    targetRole,
    questionIndex,
    questionCount,
    feedback,
    prepCard,
    isStarting,
    isSending,
    isCheckingFeedback,
    needsLogin,
    startSession,
    beginInterviewFromPrep,
    submitAnswer,
    reset,
    checkFeedbackNow,
  } = useInterview(jobId);

  const subtitle = useMemo(
    () => (jobId ? t("subtitleWithJob", { jobId }) : null),
    [jobId, t]
  );

  const showInput =
    phase === "interview" && !needsLogin;
  const showProgress = phase === "interview" && !needsLogin;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      <Header locale={locale} />
      <main className="pt-16 flex-1 flex flex-col max-w-3xl mx-auto w-full">
        {phase === "role_select" ? (
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
              onStart={beginInterviewFromPrep}
              disabled={isStarting}
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
                  locale={locale}
                  jobId={jobId}
                  onPracticeAgain={reset}
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
