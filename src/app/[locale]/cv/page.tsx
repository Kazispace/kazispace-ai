"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CvChatInput } from "@/components/cv/cv-chat-input";
import { CvParsedHints } from "@/components/cv/cv-parsed-hints";
import { MessageBubble } from "@/components/clinic/message-bubble";
import { ChatNextActions } from "@/components/clinic/chat-next-actions";
import { QuickReplies } from "@/components/clinic/quick-replies";
import { CvPreviewPane } from "@/components/cv/cv-preview-pane";
import { CvDiffPanel } from "@/components/cv/cv-diff-panel";
import { CvPipelineSteps } from "@/components/cv/cv-pipeline-steps";
import { CvSessionSidebar } from "@/components/cv/cv-session-sidebar";
import { Button } from "@/components/ui/button";
import { handleCvNextAction, isRoutedCvAction, quickReplyLabel } from "@/lib/cv-next-action";
import { useCvAgent } from "@/hooks/use-cv-agent";
import { useUIStore } from "@/lib/store";
import type { ChatNextAction } from "@/types/chat-envelope";

interface CvPageProps {
  params: { locale: string };
}

function CvPageContent({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const t = useTranslations("cv");
  const openPaywall = useUIStore((s) => s.openPaywall);

  const agentSession = useCvAgent(jobId);

  const {
    messages,
    preview,
    diff,
    quickReplies,
    isLoading,
    isSending,
    isUploading,
    error,
    needsLogin,
    needsOnboarding,
    needsProfile,
    pipelineState,
    nextActions,
    isSessionReady,
    isReadOnly,
    parsedSections,
    sessions,
    sessionsLoading,
    sessionId,
    sendMessage,
    sendPayload,
    uploadResume,
    confirmCv,
    regenerateCv,
    selectSession,
    refreshSessions,
    restart,
  } = agentSession;

  const showProfileGate = needsProfile === true;
  const showPipelineSteps =
    !needsLogin && !needsOnboarding && !showProfileGate && !isReadOnly;

  const routedActions = nextActions.filter((a) => isRoutedCvAction(a.type));
  const pickerActions = nextActions.filter((a) => !isRoutedCvAction(a.type));

  const handleCvAction = useCallback(
    (action: ChatNextAction) => {
      handleCvNextAction(action, {
        locale,
        router,
        openPaywall,
        sendPayload: (payload, showUserBubble) =>
          void sendPayload(payload, { showUserBubble }),
        intakeConfirm: () => void agentSession.intakeConfirm(),
        acceptCv: () => void confirmCv(),
        regenerateCv: () => void regenerateCv(),
      });
    },
    [agentSession.intakeConfirm, confirmCv, locale, openPaywall, regenerateCv, router, sendPayload]
  );

  const subtitle = useMemo(
    () => (jobId ? t("subtitleWithJob", { jobId }) : t("subtitle")),
    [jobId, t]
  );

  const handleRestart = useCallback(async () => {
    await restart();
    await refreshSessions();
  }, [refreshSessions, restart]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0 flex flex-col">
      <Header locale={locale} />
      <main className="pt-16 flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {!needsLogin && !needsOnboarding && !showProfileGate && (
          <CvSessionSidebar
            sessions={sessions}
            activeSessionId={sessionId}
            isLoading={sessionsLoading}
            onSelect={(id) => void selectSession(id)}
            onNew={() => void handleRestart()}
            disabled={isSending || isLoading}
            className="hidden lg:flex"
          />
        )}

        <section className="flex-1 flex flex-col min-w-0 min-h-[50vh] lg:min-h-[calc(100vh-4rem)]">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/${locale}/mine`}
                className="text-xs text-kazi-orange font-medium"
              >
                {t("backToMine")}
              </Link>
              <h1 className="text-lg font-bold text-kazi-navy mt-1">{t("title")}</h1>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
            {!needsLogin && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 lg:hidden"
                disabled={isLoading || isSending}
                onClick={() => void handleRestart()}
              >
                {t("newCv")}
              </Button>
            )}
          </div>

          {showPipelineSteps && (
            <CvPipelineSteps
              pipelineState={pipelineState}
              isWorking={isSending}
            />
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
          ) : needsOnboarding ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
                <p className="text-sm text-gray-700 mb-4">{t("onboardingBanner")}</p>
                <Button size="sm" onClick={() => router.push(`/${locale}/chat`)}>
                  {t("completeProfile")}
                </Button>
              </div>
            </div>
          ) : showProfileGate ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
                <p className="text-sm text-gray-700 mb-4">{t("profileBanner")}</p>
                <Button size="sm" onClick={() => router.push(`/${locale}/profile`)}>
                  {t("goToProfile")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {isReadOnly && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-900 text-center">
                  {t("readOnlyBanner")}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-bg">
                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    variant="agent"
                  />
                ))}
                {isLoading && messages.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {t("sessionLoading")}
                  </p>
                )}
              </div>
              {!isReadOnly && (
                <>
                  {routedActions.length > 0 && (
                    <div className="px-4 pb-2 bg-gray-bg">
                      <ChatNextActions
                        actions={routedActions}
                        locale={locale}
                        onAction={handleCvAction}
                        disabled={!isSessionReady || isSending}
                      />
                    </div>
                  )}
                  {pickerActions.length > 0 && (
                    <QuickReplies
                      options={pickerActions.map((a) => quickReplyLabel(a, locale))}
                      disabled={!isSessionReady || isSending}
                      onSelect={(text) => {
                        const action = pickerActions.find(
                          (a) => quickReplyLabel(a, locale) === text
                        );
                        if (action) handleCvAction(action);
                      }}
                    />
                  )}
                  {quickReplies.length > 0 && (
                    <QuickReplies
                      options={quickReplies}
                      disabled={!isSessionReady || isSending}
                      onSelect={(text) => void sendMessage(text)}
                    />
                  )}
                  <CvChatInput
                    onSend={(text) => void sendMessage(text)}
                    onUpload={(file) => void uploadResume(file)}
                    disabled={!isSessionReady || isSending}
                    isUploading={isUploading}
                    placeholder={t("inputPlaceholder")}
                  />
                </>
              )}
            </>
          )}
        </section>

        {!needsLogin && !needsOnboarding && !showProfileGate && (
          <CvPreviewPane
            preview={preview}
            isLoading={isLoading && !preview}
            footer={
              <>
                {parsedSections && !isReadOnly ? (
                  <CvParsedHints
                    sections={parsedSections}
                    className="px-4 py-3 border-t border-gray-100 bg-gray-50"
                  />
                ) : null}
                {diff && !isReadOnly ? (
                  <CvDiffPanel
                    diff={diff}
                    onConfirm={() => void confirmCv()}
                    onRegenerate={() => void regenerateCv()}
                    disabled={isSending || isUploading}
                  />
                ) : null}
              </>
            }
          />
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}

export default function CvPage({ params }: CvPageProps) {
  const t = useTranslations("cv");
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          {t("sessionLoading")}
        </div>
      }
    >
      <CvPageContent locale={params.locale} />
    </Suspense>
  );
}
