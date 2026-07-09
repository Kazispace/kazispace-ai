"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";

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
import { CvNewSessionDialog } from "@/components/cv/cv-new-session-dialog";
import { CvWorkspaceTabs, type CvWorkspaceTab } from "@/components/cv/cv-workspace-tabs";
import { Button } from "@/components/ui/button";
import { handleCvNextAction, isRoutedCvAction, quickReplyLabel } from "@/lib/cv-next-action";
import { useCvAgent } from "@/hooks/use-cv-agent";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";
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
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<CvWorkspaceTab>("chat");

  const agentSession = useCvAgent(jobId);

  const {
    messages,
    preview,
    diff,
    quickReplies,
    isLoading,
    isSending,
    isUploading,
    isExporting,
    error,
    needsLogin,
    needsOnboarding,
    needsProfile,
    pipelineState,
    nextActions,
    isSessionReady,
    isReadOnly,
    sessionResumed,
    parsedSections,
    documentId,
    sessions,
    sessionsLoading,
    sessionId,
    sendMessage,
    sendPayload,
    uploadResume,
    confirmCv,
    regenerateCv,
    exportCvPdf,
    selectSession,
    refreshSessions,
    restart,
  } = agentSession;

  const showProfileGate = needsProfile === true;
  const showWorkspace =
    !needsLogin && !needsOnboarding && !showProfileGate;
  const showPipelineSteps = showWorkspace && !isReadOnly;
  const canDownloadCv = documentId != null;
  const resumeReady = canDownloadCv || preview != null;

  useEffect(() => {
    if (canDownloadCv) {
      setMobileTab("resume");
    }
  }, [canDownloadCv]);

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
        exportCv: () => void exportCvPdf(),
      });
    },
    [
      agentSession.intakeConfirm,
      confirmCv,
      exportCvPdf,
      locale,
      openPaywall,
      regenerateCv,
      router,
      sendPayload,
    ]
  );

  const handleRestart = useCallback(async () => {
    setNewSessionDialogOpen(false);
    await restart();
    await refreshSessions();
  }, [refreshSessions, restart]);

  const requestNewSession = useCallback(() => {
    if (isLoading || isSending) return;
    setNewSessionDialogOpen(true);
  }, [isLoading, isSending]);

  const handleDownload = useCallback(() => {
    void exportCvPdf();
  }, [exportCvPdf]);

  const previewFooter = (
    <>
      {parsedSections && !isReadOnly ? (
        <CvParsedHints
          sections={parsedSections}
          className="px-4 py-3 border-t border-gray-100 bg-white"
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
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0 flex flex-col">
      <Header locale={locale} />
      <main className="pt-16 flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full min-h-0">
        {showWorkspace ? (
          <CvSessionSidebar
            sessions={sessions}
            activeSessionId={sessionId}
            isLoading={sessionsLoading}
            onSelect={(id) => void selectSession(id)}
            onNew={requestNewSession}
            disabled={isSending || isLoading}
            className="hidden lg:flex"
          />
        ) : null}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <Link
                href={`/${locale}/mine`}
                className="text-xs text-kazi-orange font-medium"
              >
                {t("backToMine")}
              </Link>
              <h1 className="text-lg font-bold text-kazi-navy mt-0.5 leading-tight">
                {t("title")}
              </h1>
            </div>
            {showWorkspace ? (
              <div className="flex shrink-0 items-center gap-2">
                {canDownloadCv ? (
                  <Button
                    size="sm"
                    className="hidden sm:inline-flex bg-kazi-orange hover:bg-kazi-orange/90 text-white"
                    disabled={isExporting || isSending}
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-1.5" aria-hidden />
                    {isExporting ? t("exportingPdf") : t("downloadPdfShort")}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading || isSending}
                  onClick={requestNewSession}
                >
                  {t("newCv")}
                </Button>
              </div>
            ) : null}
          </div>

          {!showWorkspace ? (
            <GateScreen
              needsLogin={needsLogin}
              needsOnboarding={needsOnboarding}
              showProfileGate={showProfileGate}
              locale={locale}
              router={router}
              t={t}
            />
          ) : (
            <>
              <CvWorkspaceTabs
                active={mobileTab}
                onChange={setMobileTab}
                resumeReady={resumeReady}
              />

              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                <section
                  className={cn(
                    "flex-1 flex flex-col min-w-0 min-h-0 bg-gray-bg",
                    mobileTab !== "chat" && "hidden lg:flex"
                  )}
                >
                  {showPipelineSteps ? (
                    <CvPipelineSteps
                      pipelineState={pipelineState}
                      isWorking={isSending}
                    />
                  ) : null}

                  {sessionResumed && !isReadOnly ? (
                    <p className="px-4 py-2 text-xs text-blue-800 bg-blue-50 border-b border-blue-100 text-center">
                      {t("sessionResumedBanner")}
                    </p>
                  ) : null}
                  {isReadOnly ? (
                    <p className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-b border-amber-100 text-center">
                      {t("readOnlyBanner")}
                    </p>
                  ) : null}

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
                    {error ? (
                      <p className="text-sm text-red-500 text-center">{error}</p>
                    ) : null}
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        variant="agent"
                      />
                    ))}
                    {isLoading && messages.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        {t("sessionLoading")}
                      </p>
                    ) : null}
                  </div>

                  {!isReadOnly ? (
                    <>
                      {routedActions.length > 0 ? (
                        <div className="px-4 pb-2 shrink-0">
                          <ChatNextActions
                            actions={routedActions}
                            locale={locale}
                            onAction={handleCvAction}
                            disabled={!isSessionReady || isSending || isExporting}
                          />
                        </div>
                      ) : null}
                      {pickerActions.length > 0 ? (
                        <QuickReplies
                          options={pickerActions.map((a) =>
                            quickReplyLabel(a, locale)
                          )}
                          disabled={!isSessionReady || isSending || isExporting}
                          onSelect={(text) => {
                            const action = pickerActions.find(
                              (a) => quickReplyLabel(a, locale) === text
                            );
                            if (action) handleCvAction(action);
                          }}
                        />
                      ) : null}
                      {quickReplies.length > 0 ? (
                        <QuickReplies
                          options={quickReplies}
                          disabled={!isSessionReady || isSending || isExporting}
                          onSelect={(text) => void sendMessage(text)}
                        />
                      ) : null}
                      <CvChatInput
                        onSend={(text) => void sendMessage(text)}
                        onUpload={(file) => void uploadResume(file)}
                        disabled={
                          !isSessionReady ||
                          isSending ||
                          isUploading ||
                          isExporting
                        }
                        isUploading={isUploading}
                        placeholder={t("inputPlaceholder")}
                      />
                    </>
                  ) : null}
                </section>

                <CvPreviewPane
                  preview={preview}
                  isLoading={isLoading && !preview && !canDownloadCv}
                  canDownload={canDownloadCv}
                  isExporting={isExporting}
                  onDownload={handleDownload}
                  footer={previewFooter}
                  mobileFullBleed
                  className={cn(
                    mobileTab !== "resume" && "hidden lg:flex",
                    mobileTab === "resume" && "flex"
                  )}
                />
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav locale={locale} />
      <CvNewSessionDialog
        open={newSessionDialogOpen}
        onConfirm={() => void handleRestart()}
        onCancel={() => setNewSessionDialogOpen(false)}
      />
    </div>
  );
}

function GateScreen({
  needsLogin,
  needsOnboarding,
  showProfileGate,
  locale,
  router,
  t,
}: {
  needsLogin: boolean;
  needsOnboarding: boolean;
  showProfileGate: boolean;
  locale: string;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslations<"cv">>;
}) {
  const banner = needsLogin
    ? { text: t("loginBanner"), href: `/${locale}/login`, cta: t("signIn") }
    : needsOnboarding
      ? { text: t("onboardingBanner"), href: `/${locale}/chat`, cta: t("completeProfile") }
      : showProfileGate
        ? { text: t("profileBanner"), href: `/${locale}/profile`, cta: t("goToProfile") }
        : null;

  if (!banner) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
        <p className="text-sm text-gray-700 mb-5">{banner.text}</p>
        <Button className="w-full" onClick={() => router.push(banner.href)}>
          {banner.cta}
        </Button>
      </div>
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
